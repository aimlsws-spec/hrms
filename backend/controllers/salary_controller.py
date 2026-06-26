"""
Salary controller — thin FastAPI router for /api/hr/salary.

Holds NO business logic: it parses/validates the request (via schema) and
delegates to the service layer. Routes are identical to the legacy
hr_salary_api.py so the frontend is unaffected.
"""

from fastapi import APIRouter
from ..schemas.salary_schema import SalaryUpsertRequest
from ..services import salary_service

router = APIRouter()


@router.get("/api/hr/salary")
def hr_get_all_salaries():
    """All active employees with their latest active salary (if any)."""
    try:
        return salary_service.list_salaries()
    except Exception:
        return []


@router.get("/api/hr/salary/{employee_id}")
def hr_get_employee_salary(employee_id: str):
    """Latest active salary for a single employee, or null."""
    try:
        return salary_service.get_employee_salary(employee_id)
    except Exception:
        return None


@router.post("/api/hr/salary")
async def hr_set_salary(payload: SalaryUpsertRequest):
    """Create or update the active salary record for an employee."""
    return salary_service.set_salary(payload.model_dump())
