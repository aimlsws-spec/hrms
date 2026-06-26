"""
Payslip controller — thin FastAPI router for /api/payslip/*.

Query-param endpoints (no request bodies, so no schema layer). Delegates to the
service; routes are identical to the legacy payslip_api.py.
"""

from fastapi import APIRouter
from ..services import payslip_service

router = APIRouter()


@router.get("/api/payslip/slip-url")
def payslip_slip_url(employee_id: str = "", month: int = 0, year: int = 0):
    return payslip_service.slip_url(employee_id, month, year)


@router.get("/api/payslip/generate")
def payslip_generate(employee_id: str = "", month: int = 0, year: int = 0):
    return payslip_service.generate(employee_id, month, year)


@router.get("/api/payslip/all")
def payslip_all(month: int = 0, year: int = 0):
    return payslip_service.list_all(month, year)
