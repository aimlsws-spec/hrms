"""Pydantic request schemas for the salary controller."""

from typing import Optional
from pydantic import BaseModel


class SalaryUpsertRequest(BaseModel):
    """
    Payload for POST /api/hr/salary.

    Only `employee_id` is required. Provide `ctc` alone to have the service
    auto-calculate the full breakdown, or supply individual components.
    """
    employee_id:         str
    ctc:                 Optional[float] = 0
    basic_salary:        Optional[float] = 0
    hra:                 Optional[float] = 0
    da:                  Optional[float] = 0
    transport_allowance: Optional[float] = 0
    medical_allowance:   Optional[float] = 0
    special_allowance:   Optional[float] = 0
    pf_deduction:        Optional[float] = 0
    esi_deduction:       Optional[float] = 0
    professional_tax:    Optional[float] = 0
    income_tax:          Optional[float] = 0
    effective_from:      Optional[str] = None
