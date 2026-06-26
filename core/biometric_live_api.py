"""
biometric_live_api.py — Real-time attendance log endpoint

Queries the IDMS SQL Server (TimeWatch) directly so the React frontend can
poll for new punch records without waiting for the 3-second sync loop to
copy them into the HRMS MySQL database first.

Endpoint
────────
GET /api/attendance/live
    ?limit=50          — max rows to return (1–500, default 50)
    ?since=<ISO-8601>  — return only records where io_time > this value
                         (use the last record's io_time to poll incrementally)

Example incremental poll from React:
    const url = `/api/attendance/live?limit=50&since=${lastSeenTime}`
    const { data } = await axios.get(url)
    // data.records is sorted newest-first; save data.records[0].io_time
    // as the next `since` value to avoid duplicates.

Connection
──────────
Reads the same IDMS_* environment variables used by biometric_sync.py.
A fresh pyodbc connection is opened per request (acceptable for a
polling endpoint; heavy load should add connection pooling separately).
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Generator, List, Optional

import pyodbc
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── IDMS connection config — same env vars as biometric_sync.py ──────────────
_SERVER   = os.getenv("IDMS_SERVER",   r"DESKTOP-EQ55Q8H\SQLEXPRESS")
_DATABASE = os.getenv("IDMS_DATABASE", "idms")
_USER     = os.getenv("IDMS_USER",     "sa")
_PASSWORD = os.getenv("IDMS_PASSWORD", "sss")
_DRIVER   = os.getenv("IDMS_DRIVER",   "ODBC Driver 17 for SQL Server")

_CONN_STR = (
    f"DRIVER={{{_DRIVER}}};"
    f"SERVER={_SERVER};"
    f"DATABASE={_DATABASE};"
    f"UID={_USER};"
    f"PWD={_PASSWORD};"
    "TrustServerCertificate=yes;"
    "Connection Timeout=10;"
)

router = APIRouter(prefix="/api/attendance", tags=["Live Attendance"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class AttendanceRecord(BaseModel):
    """One punch event enriched with the user's name from UserInfo."""
    user_id:    str             = Field(..., description="Biometric device enroll ID")
    first_name: Optional[str]  = Field(None, description="From UserInfo.FirstName (null if not enrolled)")
    last_name:  Optional[str]  = Field(None, description="From UserInfo.LastName")
    full_name:  str             = Field(..., description="Derived display name")
    io_time:    datetime        = Field(..., description="Punch timestamp from the device")
    device_id:  str             = Field(..., description="Device that recorded this punch")

    model_config = {"from_attributes": True}


class LiveAttendanceResponse(BaseModel):
    success:     bool
    count:       int                     = Field(..., description="Number of records returned")
    records:     List[AttendanceRecord]
    fetched_at:  str                     = Field(..., description="Server timestamp of this response")
    query_since: Optional[str]           = Field(None, description="Echo of the `since` filter applied")
    has_more:    bool                    = Field(..., description="True when count == limit (there may be more records)")


# ── Database dependency ───────────────────────────────────────────────────────

def _get_idms_conn() -> Generator[pyodbc.Connection, None, None]:
    """
    FastAPI dependency that opens a pyodbc connection, explicitly switches to
    the target database with USE, and closes the connection when the request
    is done.

    Why USE [idms] is required:
        DATABASE= in the ODBC connection string is a *hint*.  When the SQL
        Server login (e.g. 'sa') has 'master' as its default database, some
        ODBC driver versions honour the login default instead of the hint.
        USE is authoritative — it immediately switches the session context
        regardless of login defaults.
    """
    conn: Optional[pyodbc.Connection] = None
    try:
        conn = pyodbc.connect(_CONN_STR)

        # ── Authoritative DB switch ───────────────────────────────────────────
        _cur = conn.cursor()
        try:
            _cur.execute(f"USE [{_DATABASE}]")
            _cur.execute("SELECT DB_NAME(), @@SERVERNAME")
            row = _cur.fetchone()
            actual_db = row[0] if row else "UNKNOWN"
            server    = row[1] if row else "UNKNOWN"
            if actual_db.lower() != _DATABASE.lower():
                logger.error(
                    "[LIVE] *** WRONG DATABASE: connected to '%s', expected '%s' "
                    "— tbl_realtime_glog will not be found ***", actual_db, _DATABASE
                )
                print(
                    f"[LIVE] *** WRONG DATABASE: '{actual_db}' (expected '{_DATABASE}'). "
                    f"Check IDMS_DATABASE env var and 'sa' login default database. ***"
                )
            else:
                logger.debug("[LIVE] IDMS OK — %s / %s", server, actual_db)
                print(f"[LIVE] IDMS connected — server: {server}  database: {actual_db}")
        finally:
            _cur.close()

        yield conn

    except pyodbc.Error as exc:
        logger.error("[LIVE] IDMS connection failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=(
                f"Biometric database (IDMS) is unavailable. "
                f"Check IDMS_SERVER={_SERVER} and network connectivity. "
                f"Detail: {exc}"
            ),
        )
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


# ── Helper ────────────────────────────────────────────────────────────────────

def _build_record(row) -> AttendanceRecord:
    """
    Converts a pyodbc Row into an AttendanceRecord.

    The query now selects a single 'display_name' column from
    tbl_realtime_userinfo (user_name) rather than FirstName/LastName from the
    empty UserInfo table.  display_name goes into first_name; last_name is
    always None.  full_name is the display name, or "Unknown (ID: X)" when the
    LEFT JOIN found no matching row.
    """
    user_id      = str(row.user_id).strip()
    display_name = str(row.display_name).strip() if row.display_name else None

    full_name = display_name if display_name else f"Unknown (ID: {user_id})"

    return AttendanceRecord(
        user_id    = user_id,
        first_name = display_name,   # single-column name mapped to first_name
        last_name  = None,
        full_name  = full_name,
        io_time    = row.io_time,
        device_id  = str(row.device_id).strip(),
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

# ── Shared query template ─────────────────────────────────────────────────────
# Root-cause notes:
#
#   1. Fully-qualified table names ([idms].[dbo].[...]) are used here so that
#      the query resolves to the right database even if USE [idms] failed or the
#      session context is still 'master'.  Belt-and-suspenders with the USE in
#      _get_idms_conn().
#
#   2. "WHERE TRY_CAST(logs.user_id AS INT) > 0" filters out the user_id=0
#      rows visible in the SSMS screenshot.  Those are badge-not-found or
#      door-relay events — real employee punches always have a positive enroll_id.
#      TRY_CAST is safe for non-numeric IDs (returns NULL, excluded by > 0).
#
#   3. {since_clause} is an *optional AND fragment* — it expands to either ""
#      (no time filter) or "AND logs.io_time >= ?" for incremental polling.
#      Using AND (not a second WHERE) keeps the base filter intact.
# Name-lookup table: tbl_realtime_userinfo
#   Confirmed to have data; user_id directly maps to tbl_realtime_glog.user_id.
#   UserInfo (used in the original SSMS query) is empty on this installation —
#   confirmed by all-NULL FirstName/LastName in every result row.
#
# To override at runtime without touching this file:
#   $env:IDMS_USERINFO_TABLE    = "tbl_realtime_userinfo"   (or tbl_realtime_enroll_data)
#   $env:IDMS_USERINFO_ID_COL   = "user_id"
#   $env:IDMS_USERINFO_NAME_COL = "user_name"
_USERINFO_TABLE    = os.getenv("IDMS_USERINFO_TABLE",    "tbl_realtime_userinfo")
_USERINFO_ID_COL   = os.getenv("IDMS_USERINFO_ID_COL",   "user_id")
_USERINFO_NAME_COL = os.getenv("IDMS_USERINFO_NAME_COL", "user_name")

_BASE_SQL = """
    SELECT TOP (?)
        logs.user_id,
        CAST(ui.[{name_col}] AS NVARCHAR(200)) AS display_name,
        logs.io_time,
        logs.device_id
    FROM [{db}].[dbo].[tbl_realtime_glog] AS logs
    LEFT JOIN [{db}].[dbo].[{ui_table}] AS ui
           ON CAST(logs.user_id AS NVARCHAR(255)) = CAST(ui.[{ui_id}] AS NVARCHAR(255))
    WHERE TRY_CAST(logs.user_id AS INT) > 0
    {{since_clause}}
    ORDER BY logs.io_time DESC
""".format(
    db=_DATABASE,
    ui_table=_USERINFO_TABLE,
    ui_id=_USERINFO_ID_COL,
    name_col=_USERINFO_NAME_COL,
)  # bake table/column names in once at import time; only since_clause varies per call

def _run_query(cursor, sql: str, params: list, label: str) -> list:
    """
    Executes a parameterised query and returns the rows.

    Passes params as a sequence (the canonical pyodbc form) rather than
    *-unpacking, which avoids subtle arity bugs when the list has 1 element.

    Also prints the SSMS-ready debug SQL — copy-paste it to verify the query
    independently of the Python driver.
    """
    # Build a display-only version with the param values substituted so you
    # can copy it directly into SQL Server Management Studio.
    debug_sql = sql
    for p in params:
        display = f"'{p}'" if isinstance(p, (str, datetime)) else str(p)
        debug_sql = debug_sql.replace("?", display, 1)

    print(f"\n{'─'*60}")
    print(f"[LIVE:{label}] Executing query:")
    for line in debug_sql.strip().splitlines():
        print(f"  {line.strip()}")
    print(f"[LIVE:{label}] Raw params: {params!r}")

    cursor.execute(sql, params)   # ← list passed as sequence, NOT *-unpacked
    rows = cursor.fetchall()

    print(f"[LIVE:{label}] Rows returned: {len(rows)}")
    if rows:
        print(f"[LIVE:{label}] Latest io_time in result: {rows[0].io_time!r}")
        print(f"[LIVE:{label}] Oldest io_time in result: {rows[-1].io_time!r}")
    print(f"{'─'*60}\n")

    return rows


@router.get(
    "/live",
    response_model=LiveAttendanceResponse,
    summary="Fetch latest biometric punch records in real time",
    description=(
        "Queries tbl_realtime_glog joined with UserInfo directly from the "
        "IDMS SQL Server. Supports incremental polling via the `since` parameter. "
        "If the `since` filter returns 0 rows (e.g. due to a timezone offset), "
        "the endpoint automatically falls back to returning the 10 most recent "
        "records so the dashboard is never permanently empty."
    ),
)
def get_live_attendance(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
        description="Maximum records to return (1–500)",
    ),
    since: Optional[datetime] = Query(
        default=None,
        description=(
            "ISO-8601 datetime. When provided, only punches with "
            "io_time >= since are returned. Use the io_time of the last "
            "received record to poll incrementally."
        ),
        example="2026-06-12T10:30:00",
    ),
    conn: pyodbc.Connection = Depends(_get_idms_conn),
):
    # ── 1. Diagnostic header — visible in the FastAPI terminal ────────────────
    print(f"\n{'='*60}")
    print(f"[LIVE] GET /api/attendance/live")
    print(f"[LIVE]   since     = {since!r}  (type={type(since).__name__})")
    print(f"[LIVE]   limit     = {limit}")
    if since is not None:
        print(f"[LIVE]   since.tzinfo = {since.tzinfo!r}")
    print(f"[LIVE]   server now (Python) = {datetime.now().isoformat()}")
    print(f"{'='*60}")

    used_fallback = False

    try:
        cursor = conn.cursor()

        # ── 2. Main query — with or without the `since` filter ────────────────
        if since is not None:
            # AND (not WHERE) because the base SQL already has WHERE user_id > 0.
            # >= instead of > so the boundary record is re-fetched each poll;
            # the React hook deduplicates by _key so this is harmless.
            sql    = _BASE_SQL.format(since_clause="AND logs.io_time >= ?")
            params = [limit, since]
        else:
            sql    = _BASE_SQL.format(since_clause="")
            params = [limit]

        rows = _run_query(cursor, sql, params, label="MAIN")

        # ── 3. Fallback — prevents a permanently-empty dashboard ──────────────
        # If `since` was provided but matched 0 rows, the most common causes are:
        #   a) No new punches since the last poll (normal — return empty)
        #   b) Timezone offset between Python/FastAPI and SQL Server
        #   c) The `since` timestamp is in the future relative to DB server time
        #
        # Case (b) and (c) would keep the dashboard empty forever.
        # The fallback fetches the last 10 records unconditionally so the
        # dashboard always shows *something* while you investigate.
        if since is not None and len(rows) == 0:
            print(f"[LIVE] FALLBACK triggered — since filter returned 0 rows.")
            print(f"[LIVE] Returning last 10 records (no time filter) as safety net.")
            print(f"[LIVE] To diagnose: check GET /api/attendance/debug-time for offsets.")

            fallback_sql    = _BASE_SQL.format(since_clause="")
            fallback_params = [10]
            rows            = _run_query(cursor, fallback_sql, fallback_params, label="FALLBACK")
            used_fallback   = True

        records = [_build_record(r) for r in rows]

        return LiveAttendanceResponse(
            success     = True,
            count       = len(records),
            records     = records,
            fetched_at  = datetime.now().isoformat(),
            query_since = since.isoformat() if since else None,
            has_more    = (not used_fallback) and (len(records) == limit),
        )

    except pyodbc.Error as exc:
        logger.error("[LIVE] Query failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute attendance query: {exc}",
        )


# ── Timezone diagnostic endpoint ──────────────────────────────────────────────

@router.get(
    "/debug-time",
    summary="Compare Python server time vs SQL Server time to detect timezone offsets",
    description=(
        "Returns timestamps from Python (os.datetime.now), SQL Server GETDATE() "
        "and GETUTCDATE(), and the latest io_time in tbl_realtime_glog. "
        "Compare these values to identify timezone mismatches that could cause "
        "the since filter to silently exclude all records."
    ),
)
def debug_time(conn: pyodbc.Connection = Depends(_get_idms_conn)):
    """
    Paste the output of this endpoint into a note and compare:

      python_local    — what Python thinks 'now' is (naive local time)
      python_utc      — Python's UTC 'now'
      sql_local       — SQL Server GETDATE() (server's local time)
      sql_utc         — SQL Server GETUTCDATE() (always UTC)
      latest_io_time  — the most recent punch timestamp in tbl_realtime_glog
      offset_seconds  — python_local minus sql_local in seconds
                        (near 0 = no offset; ±3600 = 1-hour tz difference)

    If |offset_seconds| > 60 you have a timezone problem.
    """
    python_now = datetime.now()
    python_utc = datetime.utcnow()

    try:
        cursor = conn.cursor()

        cursor.execute("SELECT GETDATE(), GETUTCDATE()")
        row = cursor.fetchone()
        sql_local = row[0]
        sql_utc   = row[1]

        cursor.execute(
            f"SELECT TOP 1 io_time, device_id FROM [{_DATABASE}].[dbo].[tbl_realtime_glog] ORDER BY io_time DESC"
        )
        latest_row = cursor.fetchone()
        latest_io_time = latest_row[0] if latest_row else None
        latest_device  = latest_row[1] if latest_row else None

        # How far apart are Python local time and SQL Server local time?
        offset_seconds = round((python_now - sql_local).total_seconds(), 1)

        result = {
            "python_local":       python_now.isoformat(),
            "python_utc":         python_utc.isoformat(),
            "sql_server_local":   sql_local.isoformat() if sql_local else None,
            "sql_server_utc":     sql_utc.isoformat()   if sql_utc   else None,
            "latest_io_time":     latest_io_time.isoformat() if latest_io_time else None,
            "latest_device":      latest_device,
            "offset_seconds":     offset_seconds,
            "diagnosis": (
                "OK — clocks are in sync (< 60 s difference)"
                if abs(offset_seconds) < 60
                else (
                    f"WARNING — {abs(offset_seconds):.0f}s offset detected between "
                    f"Python ({python_now.strftime('%H:%M:%S')}) and "
                    f"SQL Server ({sql_local.strftime('%H:%M:%S') if sql_local else 'N/A'}). "
                    f"This will cause the `since` filter to miss records. "
                    f"Set IDMS_TZ_OFFSET_HOURS in .env to compensate, or ensure "
                    f"both the FastAPI host and SQL Server use the same timezone."
                )
            ),
        }

        # Also print to the terminal for immediate visibility
        print("\n[DEBUG-TIME]")
        for k, v in result.items():
            print(f"  {k:<22} = {v}")
        print()

        return result

    except pyodbc.Error as exc:
        raise HTTPException(status_code=500, detail=str(exc))
