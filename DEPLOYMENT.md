# HRMS Agent — Deployment Reference

Everything a deployer needs: architecture, prerequisites, environment
configuration, step-by-step setup, and every issue found/fixed during the
2026-09-11 audit of this codebase. `DATABASE_DOCUMENTATION.txt` and
`DATABASE_RESTORE_GUIDE.txt` remain the authoritative DB schema/restore
references — this file covers the rest of the stack.

## 1. Architecture

```
Browser
   |
   v
Frontend — React + Vite, built to static files, served by nginx
   | /api/*, /auth/*, /images/*, /health  (reverse-proxied)
   v
Backend — FastAPI on Uvicorn, port 8004
   |
   +--> MySQL 8.x ("hrms" database)   <- the ONLY datastore this app owns.
   |                                     Every table (employees, attendance,
   |                                     payroll, leave, settings, audit
   |                                     logs...) lives here, via
   |                                     mysql-connector-python exclusively.
   |
   +--> IDMS SQL Server (external biometric device vendor DB)
            Read-only. Third-party hardware's own database — not something
            we control or store our data in. See section 6.
```

Attendance data flow: biometric device → IDMS (SQL Server) → background
sync worker (polls every 3s) → `biometric_raw_logs` (MySQL) → `attendance`
table (MySQL).

## 2. Prerequisites

| Requirement | Verified version | Notes |
|---|---|---|
| Python | 3.11+ (tested on 3.14.4) | |
| Node.js + npm | 20+ (tested on 24.15.0) | |
| MySQL Server | 8.0.x | The application database |
| Git | any recent | |
| Microsoft ODBC Driver 17 for SQL Server | — | **Only if using the biometric/IDMS integration.** Install separately at the OS level — `pyodbc` (the Python package) is just a binding, not the driver itself. Windows: [download](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server). Linux: `msodbcsql17` + `unixodbc` via Microsoft's apt/yum repo. Without it, `biometric_sync.py`/`biometric_processor.py` fail to connect. |

## 3. Repository layout

```
backend/                  FastAPI app — entrypoint backend/app.py
backend/core/             Business logic modules (attendance, payroll, biometric...)
backend/controllers/      MVC-style routers (salary, etc. — partial migration)
backend/models/, schemas/, services/, views/
backend/templates/templates/   Jinja2 + docx templates (doubled folder — see note)
backend/images/images/         Static UI assets served at /images/*
frontend/                 React + Vite SPA, builds to frontend/dist/
frontend/nginx.conf       Reverse-proxy config for the built frontend
hrms_schema.sql, hrms_seed.sql, hrms_full_backup.sql   MySQL dumps
DATABASE_DOCUMENTATION.txt, DATABASE_RESTORE_GUIDE.txt   DB reference
.env.example               Template for the required .env file
```

**Doubled folders are intentional, not a mistake to "clean up":**
`backend/images/images`, `templates/templates`, `docs/docs`, `sql/sql`,
`data/data`, `scripts/scripts`, `generated_docs/generated_docs`,
`employee_data/employee_data`, `temp_doc/temp_doc` — code references these
exact doubled paths (e.g. `appointment_letter_generator.py`'s
`TEMPLATE_PATH`). Collapsing a level without updating every reference will
break document generation.

## 4. Environment variables

Copy `.env.example` → `.env` in the project root and fill in real values.
`.env` is gitignored — never commit it.

**MySQL (application database — required)**
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

**Biometric / IDMS (required only if using the device integration)**
`TIMEWATCH_DEVICE_IDS`, `TIMEWATCH_LOOKBACK_HOURS`,
`IDMS_SERVER`, `IDMS_DATABASE`, `IDMS_USER`, `IDMS_PASSWORD`, `IDMS_DRIVER`,
`IDMS_USER_TABLE`, `IDMS_USER_ID_COL`, `IDMS_USER_FIRST_NAME_COL`,
`IDMS_USER_LAST_NAME_COL`, `IDMS_USER_DEPT_COL`, `IDMS_USER_ACTIVE_FILTER`

Run `python core/idms_inspect.py` and `python core/inspect_tblemployee.py`
(from `backend/`, venv active) against the **real production** IDMS server
to discover the correct table/column names — every installation's schema
differs.

**Shift defaults for attendance processing**
`SHIFT_START_HOUR`, `SHIFT_START_MIN`, `SHIFT_END_HOUR`, `SHIFT_END_MIN`,
`GRACE_MINUTES`, `HALF_DAY_THRESHOLD_HOURS`

**WFH selfie evidence system (required)**
- `SELFIE_ENCRYPTION_KEY` — 64 hex chars (32 bytes). Generate with:
  ```
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
  Store securely. Losing it makes all stored selfies permanently unreadable;
  rotating it requires re-encrypting existing files under the new key first.
- `WFH_SELFIE_DIR` — defaults to `wfh_selfies`, created automatically.

**Email/OTP config** (`SMTP_SERVER`, `SMTP_PORT`, `EMAIL_USER`,
`EMAIL_PASSWORD`) — present in `.env.example` for completeness but
**currently unused by the backend** (no code path sends email). See
finding #7 below — the login "OTP" isn't actually delivered by email today.

## 5. Database setup (MySQL)

See `DATABASE_RESTORE_GUIDE.txt` for authoritative restore commands and
`DATABASE_DOCUMENTATION.txt` for the schema reference. Summary:

```sql
CREATE DATABASE hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```
```
mysql -u root -p hrms < hrms_full_backup.sql
```
(or `hrms_schema.sql` → `hrms_seed.sql` → `hrms_data.sql` separately — see
the restore guide for exact order).

Confirm `backend/config.py`'s `DB_CONFIG` values match your `.env`. Verified
in this audit: **there is no other database driver for the app's own data
anywhere in the codebase** — everything goes through `mysql-connector-python`.

## 6. The one intentional non-MySQL connection

The biometric attendance device ("IDMS"/TimeWatch) stores its own punch
logs on a Microsoft SQL Server instance shipped with the hardware (in this
environment: `DESKTOP-EQ55Q8H\SQLEXPRESS`). We don't control that schema and
can't make third-party hardware write to MySQL instead.

The backend connects **read-only** via `pyodbc`, and copies new punches into
our own MySQL table (`biometric_raw_logs`) within seconds. Everything this
application actually owns and serves — employees, attendance, payroll,
leave, documents — lives in MySQL. This is the standard way to integrate
vendor hardware without violating a "MySQL only" policy for systems you
control.

Code to change if the device is ever replaced with one that exposes MySQL
or a REST API directly:
- `backend/core/biometric_sync.py` (`_get_idms_db`, `BiometricWorker`)
- `backend/core/biometric_processor.py` (`_get_idms_db`, `_fetch_idms_user`)
- `backend/core/idms_inspect.py`, `backend/core/inspect_tblemployee.py` (diagnostics)
- `backend/app.py` (`_idms_earliest_punch`)

## 7. Findings from this audit — fixed

1. **CRITICAL — Unauthenticated source code & PII disclosure.**
   `app.py` mounted the entire backend working directory at `/images/*`
   (`StaticFiles(directory=".")`). Verified live: an unauthenticated
   request to `/images/app.py` or `/images/config.py` returned the full
   file; in production this would also have exposed
   `backend/employee_data/` (Aadhaar/PAN scans). Fixed to mount only
   `backend/images/images`. Verified: legit images still serve (200),
   source files now 404.

2. **Biometric sync was completely broken.** A prior automated refactor
   replaced every `pyodbc` connection to the IDMS SQL Server with
   `mysql.connector` calls pointed at the SQL Server hostname — which can
   never work (verified live: error 2005, "Unknown MySQL server host").
   Affected 5 files: `biometric_sync.py`, `biometric_processor.py`,
   `idms_inspect.py`, `inspect_tblemployee.py`, `app.py`. Restored `pyodbc`
   for the IDMS connection only (app data stays MySQL everywhere else via
   `mysql.connector`). Also fixed leftover MySQL-only SQL syntax
   (backtick-quoted identifiers, `LIMIT`, unqualified `CAST(...AS CHAR)`)
   that would have caused further SQL Server syntax errors. Verified live
   against the real IDMS server — connection now succeeds and runs real
   queries. Duplicate `import mysql.connector` lines from the same refactor
   also removed.

3. **Syntax error preventing import.**
   `backend/core/appointment_letter_generator.py` had a stray indented
   block at module level (`IndentationError`) — this module failed to
   import at all. Fixed; full backend now compiles clean and the app boots
   and serves real requests.

4. **`UnicodeEncodeError` crash risk on Windows.** Diagnostic
   print/logger calls use characters not in the Windows default console
   codepage (cp1252) — reproduced live as a crash inside the IDMS startup
   diagnostic. Fixed by forcing UTF-8 on stdout/stderr at the top of
   `app.py`, `idms_inspect.py`, and `inspect_tblemployee.py`
   (`errors='backslashreplace'` as a safety net). Recommend also setting
   `PYTHONUTF8=1` in the production service environment as defense in depth.

5. **Fresh clone was missing required files.** `backend/.gitignore`
   blanket-excluded `data/`, `docs/`, `scripts/`, `sql/`, and `images/` as
   "runtime artifacts" — but these hold source content the app needs:
   `backend/images/images/` is the static UI assets served at `/images/*`
   (so every icon/logo would 404 after a fresh clone), `backend/sql/sql/`
   holds SQL migration files, `backend/data/data/` holds JSON config read
   by `app.py`, `accountant_routes.py`, `settings_api.py`. Fixed the ignore
   rules to match how `backend/templates/templates/` was already handled.
   **Action needed:** these directories aren't committed yet — run
   `git add backend/images backend/sql backend/data backend/docs backend/scripts`
   and commit before your next deploy.

6. **Six duplicate route registrations (`Duplicate Operation ID` warnings),
   three of which were live functional bugs.** The same path+method was
   registered twice — once in a `core/*.py` router (included early) and
   again directly in `app.py` (registered later, so silently shadowed/dead).
   Verified with `app.openapi()` under `warnings.filterwarnings('error')`:
   all 6 warnings are now gone.
   - `get_late_summary` (`attendance_api.py`) — byte-for-byte duplicate;
     the dead copy was deleted.
   - `get_all_leave_requests`, `get_employee_leave_requests` — router
     versions already matched the frontend's documented response shape
     (`// Backend returns leave_requests for /all and requests for
     /employee/:id` in `frontend/src/api/leaves.ts`); dead `app.py` copies
     deleted.
   - `create_document_request`, `forward_to_accountant` — router versions
     already complete with proper validation; dead `app.py` copies deleted.
   - **`get_leave_calendar` — real functional bug.** The live router
     version (`attendance_api.py`) was a literal stub
     (`"Stub response matching CalendarData type"`, hardcoded empty
     arrays), while a complete, working implementation querying real leave
     data sat dead in `app.py`. The leave calendar widget has been
     silently rendering as empty in production. **Fixed:** moved the real
     query logic into the live router, added a matching real holidays
     query and computed Saturdays (the frontend `CalendarData` type
     expects `leaves`, `holidays`, `saturdays` — none of these were fully
     served before).
   - **`get_employee_prefill` — real functional bug.** The live router
     version returned only `full_name`/`employee_code`/`department`/`title`/
     `joining_date`. The frontend's `EmployeePrefillData` type (used by the
     Offer Letter / Experience Letter forms) expects `email`, `phone`,
     `address`, `annual_salary` too — fields only the dead `app.py` copy
     computed. **Fixed:** merged the richer implementation (address
     resolution via employee profile with city/state fallback, salary via
     CTC/gross lookup) into the live router.

7. **`holidays` table column names didn't match the actual schema —
   another live bug.** The real table only has columns
   `(id, date, name, description, created_at)`. Multiple places queried
   nonexistent `holiday_name`/`holiday_date`/`holiday_type` columns:
   - `app.py`'s `/api/leave/holidays` (used by the dashboard holidays
     widget) — always failed and silently fell back to 3 hardcoded fake
     holidays (Independence Day, Gandhi Jayanti, Christmas Day) instead of
     real data. **Fixed** to query the real columns.
   - `core/sandwich_leave_policy.py`'s `get_holidays()` — feeds
     `/api/leave/check-sandwich`, called from the leave application flow.
     Always raised "Unknown column 'holiday_date'". **Fixed.** Also
     switched it from a locally-hardcoded `DB_CONFIG` (with a divergent
     default database name, `hrms_complete` instead of `hrms`) to the
     shared `backend.config.DB_CONFIG`.
   - `core/settings_api.py`'s holiday CRUD endpoints
     (`GET/POST/PUT /api/settings/holidays/...`) — every call always failed
     with the same unknown-column error. **Fixed** to use real columns;
     `type` is accepted from callers for compatibility but stored in
     `description` since there's no `type` column — add a real migration
     for that if it needs to be first-class. Note: nothing in the current
     frontend actually calls this endpoint, so it was dead-in-practice
     even though reachable.
   - `core/gps_attendance.py` has the same divergent-default `DB_CONFIG`
     pattern, but its router is never imported/mounted anywhere in
     `app.py` — fully unreachable dead code, left as-is (nothing currently
     depends on it).

   Frontend: `npm run build` (tsc + vite build) completes with zero
   TypeScript/build errors — only a non-blocking Rollup warning about a
   1.1MB main chunk (performance suggestion, not an error).

## 8. Findings — not fixed, needs a team decision

These are architectural, not simple bugs — fixing them changes how the
frontend and backend talk to each other, so they were deliberately left for
the team to prioritize rather than silently rewritten.

1. **CRITICAL — no real session/authorization enforcement.** After
   `/auth/verify-otp` succeeds, the backend issues a "token" that is just
   the literal string `"token_<user_id>"` (`app.py`, `/auth/verify-otp`) —
   predictable, unsigned, not stored server-side. No endpoint in `app.py`
   validates an `Authorization` header, session cookie, or any token before
   serving data. Practically: any request that knows or guesses an ID can
   likely reach employee/payroll data directly, regardless of login state.
   Recommend real signed sessions/JWTs verified via a FastAPI dependency on
   every protected router before this goes to a real production audience.

2. **Login OTP is not a real second factor.** `/auth/login` generates an
   OTP and returns it directly in the JSON response body (never
   emailed/texted — the SMTP env vars are configured but unused).
   `/auth/verify-otp` then accepts *any* 6-digit code per its own comment
   — it never checks the OTP against anything. Recommend either wiring up
   real email/SMS delivery with server-side verification, or removing the
   OTP step and hardening primary auth (rate limiting, lockouts) —
   decide deliberately rather than relying on it as-is.

3. **Legacy plain-text password fallback.** `/login` compares
   `stored == request.password` when the stored value isn't bcrypt-hashed.
   Fine as a one-time migration bridge; confirm no accounts are still on
   plain-text passwords before go-live, then remove this branch.

These three warrant a dedicated security-hardening pass — happy to help as
a follow-up, or run `/security-review` for a deeper look.

## 9. Running the backend

**Run uvicorn with the working directory set to `backend/`** — the app
imports as `backend.*` (parent dir auto-added to `sys.path` by `app.py`)
AND writes several paths (`generated_docs`, `wfh_selfies`, `employee_data`,
etc.) relative to the process's current working directory.

```powershell
cd backend
python -m venv ..\venv              # one-time
..\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# ensure ..\.env exists (see section 4) — config.py loads it via python-dotenv
python -m uvicorn app:app --host 0.0.0.0 --port 8004
```

For production, don't use `python app.py` — its `__main__` block sets
`host="127.0.0.1"` and `reload=True` (a dev convenience). Run uvicorn
directly as above, behind a process manager.

Example systemd unit (Linux):

```ini
[Unit]
Description=HRMS Agent backend
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/opt/hrms_agent/backend
Environment=PYTHONUTF8=1
EnvironmentFile=/opt/hrms_agent/.env
ExecStart=/opt/hrms_agent/venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8004
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Health checks: `GET /health` and `GET /health/db` (both already implemented).

## 10. Running the frontend

```powershell
cd frontend
npm install
npm run build          # outputs to frontend/dist/
```

Serve `frontend/dist/` with the provided `frontend/nginx.conf`, which also
reverse-proxies `/api/`, `/auth/`, `/images/`, and `/health` to the backend.

**Note:** `frontend/nginx.conf` proxies to `http://backend:8004` — a
hostname that only resolves inside Docker Compose networking where the
backend service is literally named `backend`. If you're not deploying with
Docker, change every `proxy_pass http://backend:8004` in that file to the
real host/IP (e.g. `http://127.0.0.1:8004` if nginx and the backend share a
machine).

## 11. Post-deploy smoke test

- [ ] `GET /health` returns 200
- [ ] `GET /health/db` returns 200 (confirms MySQL connectivity)
- [ ] `GET /docs` loads the FastAPI schema
- [ ] `GET /images/<known-file>` returns the asset; `GET /images/app.py`
      returns 404 (regression check for finding #1)
- [ ] Login flow works end-to-end from the built frontend
- [ ] Leave calendar widget shows real leave/holiday data, not empty
      (regression check for finding #6)
- [ ] Dashboard holidays widget shows real holiday rows, not the 3
      hardcoded placeholders (regression check for finding #7)
- [ ] If using biometric integration: server log shows "IDMS SQL Server
      connection (re)established" without a "Unknown MySQL server host"
      error; run `python core/idms_inspect.py` against production IDMS to
      confirm `IDMS_USER_TABLE`/columns are correct for that specific device
- [ ] Generate one salary slip / appointment letter to confirm docx/PDF
      generation works (`docx2pdf` needs MS Word on Windows — confirm your
      target OS supports it)

## 12. Housekeeping (not blocking, worth a look)

- `backend/` contains its own nested `.git` directory (remote:
  `gitlab.com/iceberg8032511/hrms/hrms-backend`), left over from when
  `backend/` was a separate repository. It is **not** a registered git
  submodule — all backend files are tracked as normal blobs in the outer
  `hrms_agent` repo — so it doesn't affect what gets cloned/deployed, but
  it's confusing (`git status` inside `backend/` talks to a different
  remote) and worth removing if nobody needs that old history.
- Both `venv/` and `.venv/` exist at the repo root with duplicate installed
  environments. Neither is tracked in git, but having two is confusing for
  a new deployer — recommend standardizing on one.
- No automated test suite exists in this repo. "No errors" in this audit
  means: full backend compiles and imports cleanly, the server boots and
  serves real requests (verified against a live MySQL DB and a live IDMS
  SQL Server), the FastAPI schema builds with zero warnings across all 310
  routes, and the frontend production build has zero TypeScript/build
  errors — not that every business-logic path has been exercised.
  Recommend at least smoke-level tests for payroll and attendance
  calculations given their financial/compliance impact.
