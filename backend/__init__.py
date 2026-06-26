"""
backend — MVC-structured package for the HRMS FastAPI app.

Layers:
  models/      data access (raw SQL, DB connection)
  services/    business logic (validation, calculations)
  schemas/     pydantic request/response models
  controllers/ thin FastAPI routers that wire HTTP -> service

Named `backend` (not `app`) because the FastAPI entrypoint is `app.py`
(uvicorn runs "app:app"); a package called `app/` would shadow it.

Migration is incremental: `hr_salary` is the reference feature. Each module
that gets migrated out of the monolithic app.py follows the same 4-layer split.
"""

import os
import sys

# Bridge: the not-yet-migrated flat modules (config, payroll_engine, …) live in
# core/ (a sibling of this package). Ensure it's importable even when backend is
# imported directly (e.g. tests), not only via app.py.
_CORE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core")
if _CORE not in sys.path:
    sys.path.insert(0, _CORE)
