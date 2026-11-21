from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import mysql.connector
from datetime import datetime

router = APIRouter(prefix="/api/teams", tags=["Team Management"])

from backend.config import DB_CONFIG

def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def _ensure_tables():
    """Create teams and team_members tables if they don't exist."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            team_name   VARCHAR(100) NOT NULL,
            manager_id  VARCHAR(50),
            description TEXT,
            created_by  VARCHAR(50),
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS team_members (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            team_id     INT NOT NULL,
            employee_id VARCHAR(50) NOT NULL,
            added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_team_member (team_id, employee_id),
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


try:
    _ensure_tables()
except Exception as e:
    print(f"[team_management] table init warning: {e}")


# ── Pydantic models ──────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    team_name:   str
    manager_id:  Optional[str] = None
    description: Optional[str] = None
    created_by:  Optional[str] = None

class MemberAction(BaseModel):
    employee_id: str

class ManagerUpdate(BaseModel):
    manager_id: str


# ── Helper ───────────────────────────────────────────────────────────────────

def _employee_exists(cur, employee_id: str) -> bool:
    cur.execute(
        "SELECT 1 FROM users WHERE user_id = %s LIMIT 1",
        (employee_id,)
    )
    return cur.fetchone() is not None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def get_all_teams():
    """Return all teams with member count and manager name."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT
                t.id,
                t.team_name,
                t.manager_id,
                u.full_name        AS manager_name,
                t.description,
                t.created_by,
                t.created_at,
                COUNT(tm.id)       AS member_count
            FROM teams t
            LEFT JOIN users         u  ON t.manager_id = u.user_id
            LEFT JOIN team_members  tm ON t.id = tm.team_id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        """)
        teams = cur.fetchall()
        cur.close()
        conn.close()
        for row in teams:
            if isinstance(row.get('created_at'), datetime):
                row['created_at'] = row['created_at'].isoformat()
        return {"success": True, "teams": teams, "count": len(teams)}
    except Exception as e:
        return {"success": False, "teams": [], "message": str(e)}


@router.post("/create")
def create_team(body: TeamCreate):
    """Create a new team."""
    if not body.team_name.strip():
        return {"success": False, "message": "team_name is required"}
    try:
        conn = get_db()
        cur = conn.cursor()
        # Validate manager if supplied
        if body.manager_id:
            cur.execute(
                "SELECT 1 FROM users WHERE user_id = %s LIMIT 1",
                (body.manager_id,)
            )
            if not cur.fetchone():
                cur.close(); conn.close()
                return {"success": False, "message": "manager_id does not match any user"}
        cur.execute(
            """INSERT INTO teams (team_name, manager_id, description, created_by)
               VALUES (%s, %s, %s, %s)""",
            (body.team_name.strip(), body.manager_id, body.description, body.created_by)
        )
        conn.commit()
        team_id = cur.lastrowid
        cur.close()
        conn.close()
        return {"success": True, "message": "Team created", "team_id": team_id}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/{team_id}/members")
def get_team_members(team_id: int):
    """Return all members of a team."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        # Verify team exists
        cur.execute("SELECT id, team_name FROM teams WHERE id = %s", (team_id,))
        team = cur.fetchone()
        if not team:
            cur.close(); conn.close()
            return {"success": False, "message": "Team not found", "members": []}

        cur.execute("""
            SELECT
                tm.id,
                tm.employee_id,
                u.full_name,
                u.role,
                u.email,
                tm.added_at
            FROM team_members tm
            JOIN users u ON tm.employee_id = u.user_id
            WHERE tm.team_id = %s
            ORDER BY u.full_name
        """, (team_id,))
        members = cur.fetchall()
        cur.close()
        conn.close()
        for m in members:
            if isinstance(m.get('added_at'), datetime):
                m['added_at'] = m['added_at'].isoformat()
        return {
            "success": True,
            "team_id": team_id,
            "team_name": team['team_name'],
            "members": members,
            "count": len(members),
        }
    except Exception as e:
        return {"success": False, "members": [], "message": str(e)}


@router.post("/{team_id}/add-member")
def add_team_member(team_id: int, body: MemberAction):
    """Add an employee to a team (no duplicates)."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("SELECT id FROM teams WHERE id = %s", (team_id,))
        if not cur.fetchone():
            cur.close(); conn.close()
            return {"success": False, "message": "Team not found"}

        if not _employee_exists(cur, body.employee_id):
            cur.close(); conn.close()
            return {"success": False, "message": "Employee not found"}

        # Duplicate guard via IGNORE
        cur2 = conn.cursor()
        cur2.execute(
            "INSERT IGNORE INTO team_members (team_id, employee_id) VALUES (%s, %s)",
            (team_id, body.employee_id)
        )
        conn.commit()
        added = cur2.rowcount > 0
        cur2.close(); cur.close(); conn.close()

        if added:
            return {"success": True, "message": "Member added"}
        return {"success": False, "message": "Employee is already in this team"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/{team_id}/remove-member")
def remove_team_member(team_id: int, body: MemberAction):
    """Remove an employee from a team."""
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT id FROM teams WHERE id = %s", (team_id,))
        if not cur.fetchone():
            cur.close(); conn.close()
            return {"success": False, "message": "Team not found"}

        cur.execute(
            "DELETE FROM team_members WHERE team_id = %s AND employee_id = %s",
            (team_id, body.employee_id)
        )
        conn.commit()
        removed = cur.rowcount > 0
        cur.close()
        conn.close()

        if removed:
            return {"success": True, "message": "Member removed"}
        return {"success": False, "message": "Employee was not in this team"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.delete("/{team_id}")
def delete_team(team_id: int):
    """Delete a team and cascade-remove all its members."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM teams WHERE id = %s", (team_id,))
        if not cur.fetchone():
            cur.close(); conn.close()
            return {"success": False, "message": "Team not found"}
        cur.execute("DELETE FROM teams WHERE id = %s", (team_id,))
        conn.commit()
        cur.close(); conn.close()
        return {"success": True, "message": "Team deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.put("/{team_id}/manager")
def update_team_manager(team_id: int, body: ManagerUpdate):
    """Set or replace the manager for a team."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM teams WHERE id = %s", (team_id,))
        if not cur.fetchone():
            cur.close(); conn.close()
            return {"success": False, "message": "Team not found"}
        cur.execute("UPDATE teams SET manager_id = %s WHERE id = %s", (body.manager_id, team_id))
        conn.commit()
        cur.close(); conn.close()
        return {"success": True, "message": "Manager updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── Employee dropdown ─────────────────────────────────────────────────────────

@router.get("/employees/list", tags=["Team Management"])
def list_employees_for_dropdown():
    """Lightweight employee list for dropdowns (id + name + role)."""
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT user_id AS employee_id, full_name, role, email
            FROM users
            WHERE role = 'employee'
              AND COALESCE(is_active, 1) = 1
            ORDER BY full_name
        """)
        employees = cur.fetchall()
        cur.close()
        conn.close()
        return {"success": True, "employees": employees, "count": len(employees)}
    except Exception as e:
        return {"success": False, "employees": [], "message": str(e)}
