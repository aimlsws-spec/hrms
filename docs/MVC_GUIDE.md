# MVC Structure — migration guide

The project is being moved to an MVC layout **incrementally**. The
**HR-salary feature** (`/api/hr/salary` + the dashboard "Set Salary" widget) is
the fully-migrated reference. Follow the same split for every other module.

Nothing is migrated big-bang: legacy modules keep working until each is moved
and verified.

---

## Backend — `backend/` package (FastAPI)

> Named `backend/`, **not** `app/`, because the entrypoint is `app.py` and
> uvicorn runs `"app:app"`; a package called `app/` would shadow it.

### Where files live now (root is folders-only)

The repo root holds only `app.py` (entry) + dotfiles. Everything else is foldered:

| Folder | Contents |
|--------|----------|
| `backend/` | migrated MVC code (models/services/schemas/views/controllers) |
| `core/` | flat backend modules **not yet migrated** (`config.py`, `payroll_engine.py`, all `*_api.py`/`*_routes.py`, generators, …) |
| `data/` | runtime JSON (`users_data.json`, `system_settings.json`, `tasks_data.json`) |
| `sql/` `docs/` `scripts/` `images/` `templates/` | schemas, docs, `.bat`, assets, jinja templates |

`app.py` puts `core/` on `sys.path` (and `backend/__init__.py` does too, for direct
imports), so the flat modules stay importable as `import analytics_api` / `from config import …`
while they await migration. **As each module is MVC-migrated it moves from `core/` into `backend/`.**
Data JSON is opened cwd-relative as `data/<file>.json` (cwd = repo root).

```
backend/
  models/        data access — raw SQL, DB connection. No business logic.
  services/      business logic — validation, calculations, orchestration.
  schemas/       pydantic request models (skip when an endpoint has no body, e.g. query-param GETs).
  views/         server-rendered HTML templates (only when a feature renders HTML, not JSON).
  controllers/   thin FastAPI routers: parse request -> call service -> return.
```

**Migrated feature 1 — salary:**
| Layer | File | Responsibility |
|-------|------|----------------|
| Model | `backend/models/salary_model.py` | SQL against `employees`/`employee_salaries` |
| Model | `backend/models/db.py` | shared `get_connection()` |
| Service | `backend/services/salary_service.py` | CTC→breakdown calc, gross/net, validation, serialization |
| Schema | `backend/schemas/salary_schema.py` | `SalaryUpsertRequest` |
| Controller | `backend/controllers/salary_controller.py` | `/api/hr/salary` routes |

**Migrated feature 2 — payslip** (shows the `views/` layer + no-schema case):
| Layer | File | Responsibility |
|-------|------|----------------|
| Model | `backend/models/payslip_model.py` | one-connection input fetch + lookups |
| Service | `backend/services/payslip_service.py` | attendance-based pay calc (via `payroll_engine`), response shaping |
| View | `backend/views/payslip_view.py` | `build_html()` — printable pay slip HTML |
| Controller | `backend/controllers/payslip_controller.py` | `/api/payslip/{generate,slip-url,all}` (query params, no schema) |

> Non-controller importers count too: `salary_slip_generator.py` imported the old
> `payslip_api._compute`; it now imports `backend.services.payslip_service.compute`.
> Always grep for *all* importers of a module before trashing it, not just `app.py`.

**Wiring:** `app.py` imports the controller's `router` and `include_router`s it
(same route paths as before, so the frontend is untouched):
```python
from backend.controllers.salary_controller import router as hr_salary_router
app.include_router(hr_salary_router)
```

**To migrate another module (e.g. payslip):**
1. Move its SQL into `backend/models/<feature>_model.py`.
2. Move its logic into `backend/services/<feature>_service.py`.
3. Add `backend/schemas/<feature>_schema.py` for request bodies.
4. Create `backend/controllers/<feature>_controller.py` with the **same routes**.
5. Swap the import/`include_router` in `app.py`; move the old `*_api.py` to `_trash`.
6. Verify endpoints with `curl` against the running server (port 8004).

**Rules:** controllers never touch SQL; models never import FastAPI; services
hold the rules and are framework-agnostic.

---

## Frontend — `frontend-react/src/` (React)

```
src/
  models/        data access + domain shaping (wraps the api/ client)
  controllers/   hooks holding state + actions (no JSX)
  views/         presentational components (consume a controller)
```

**Reference feature (salary / "Set Salary" dashboard widget):**
| Layer | File | Responsibility |
|-------|------|----------------|
| Model | `src/models/salaryModel.ts` | `fetchPending()`, `setSalaryFromCtc()` |
| Controller | `src/controllers/usePendingSalaries.ts` | state, actions, optimistic update |
| View | `src/views/PendingSalaryView.tsx` | rendering + local form UI state |

`DashboardPage` lazy-imports the **view**:
```ts
const PendingSalaryPanel = lazy(() => import('../views/PendingSalaryView'))
```

**To migrate another feature:**
1. Put API calls + domain rules in `src/models/<feature>Model.ts`
   (the existing `src/api/*.ts` clients remain the low-level HTTP layer).
2. Put React state/actions in `src/controllers/use<Feature>.ts`.
3. Put rendering in `src/views/<Feature>View.tsx`.
4. Repoint the page/route to the new view; move the old component to `_trash`.
5. `npx tsc --noEmit` to verify.

**Rules:** views contain no `axios`/`client` calls and no business rules;
controllers contain no JSX; models are the only place that knows endpoint URLs
and domain filters (e.g. "pending = !has_salary").

> Shared types (e.g. `EmployeeSalaryRecord`) still live in `src/api/hrSalaryApi.ts`
> because multiple features import them — the model re-exports them so each
> feature has a single import point.
