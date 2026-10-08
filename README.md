# DevDiagnose

AI-powered internal bug analysis and tracking platform for software engineering
teams. Reports come in, the AI diagnoses root cause + suggested fixes, and QA/Dev
drive bugs through a kanban workflow to resolution.

Monorepo: **React + Vite (Tailwind) frontend** and a **FastAPI + MongoDB
Atlas backend**.
## Features

- **Bug reports** - guided form (title, description, steps, expected/actual,
  environment, severity, priority, category, screenshot evidence) with live
  client-side validation and the same rules enforced on the API.
- **AI analysis** - "Analyze with AI" sends the bug plus its project context
  (architecture, tech stack, business rules) to Groq and returns classification,
  severity/priority advice, root cause, a structured suggested fix
  (summary / steps / code), recommended tests, confidence and an honest
  `uncertainty` note. Thin reports get an "Insufficient information" answer
  instead of a fabricated diagnosis.
- **Kanban workflow** - `Draft → Submitted → Assigned → In Progress → Resolved →
  QA Validation → Closed`, with role-based transitions (Developer / QA / Admin),
  optional QA-less mode, withdraw/reject handling and a `needsAttention` flag.
- **Report editing** - reporter/assignees/team/admin can amend a report; every
  change bumps `reportRevision` so older AI analyses are marked stale and
  re-analyzed.
- **Projects** - 8-step project wizard (basic info, technology, team,
  environment, architecture, business rules, quality & references, review) plus
  project edit; project cards show open / high-severity / resolved /
  awaiting-validation counters.
- **Team & invitations** - admins invite by email; the invite link creates the
  member only when the employee completes their profile (first/last name +
  password). Invitations expire (72h) and are single-use.
- **Notifications** - targeted (per-user) or broadcast notifications with an
  unread badge in the shell.
- **Self-service settings** - change your own password with live rule feedback.

Bug visibility is enforced by the API, not the browser: Admin and QA read every
project and bug, while a developer only sees their own project teams plus bugs
they reported or were assigned. Out-of-scope reads return `404` rather than
`403`, so the API does not confirm that a record exists.

## Tech stack

| Layer      | Choice |
| ---------- | ------ |
| Frontend   | React 19 + TypeScript 5.7, Vite 6, Tailwind CSS v4, react-router 7, lucide-react |
| Backend    | FastAPI 0.115, Pydantic v2 (request validation), Uvicorn |
| Database   | MongoDB Atlas (PyMongo 4.10) - required, no local fallback |
| Auth       | HttpOnly session cookie (JWT via PyJWT) + bcrypt password hashes |
| AI         | Groq (`GROQ_MODEL`, default `openai/gpt-oss-120b`) |
| Mail       | stdlib `smtplib` for invitation emails (logs the link if SMTP is unset) |

## Repo layout

```
DevDiagnose/
├── frontend/                React + Vite + Tailwind v4 app
│   ├── vitest.config.ts     Test runner (jsdom + setup file)
│   └── src/
│       ├── lib/api.ts       API client (fetch wrapper, cookies, 422 handling)
│       ├── lib/validation.ts Shared input rules (mirrors backend schemas)
│       ├── lib/status-rules.ts  Status matrix (mirrors backend/status_rules.py)
│       ├── lib/data-context.tsx  Bootstrap data + visibility scoping + project stats
│       ├── components/      App shell, sidebar, topbar, kanban board, badges, ui/
│       ├── pages/           login, dashboard, bugs, bug-detail/, bug-new/,
│                            projects, project-detail, project-new/, my-work,
│                            notifications, employees, company, invite/, settings
│       ├── test/            Shared test helpers (API mock, fixtures, render)
│       └── __tests__/       Component and route tests (vitest + Testing Library)
└── backend/
    ├── requirements.txt     Pinned runtime dependencies
    ├── requirements-dev.txt Runtime + pytest
    ├── .env.example         Copy to .env; JWT_SECRET must be replaced
    ├── tests/               pytest suite (auth, invites, bug workflow, analysis, RBAC)
    └── app/
        ├── main.py          App entry (CORS + public/protected routers)
        ├── config.py        Settings from .env (MONGODB_URI, JWT_SECRET, ...)
        ├── db.py            Store facade: connect, seed/migrate entrypoints
        ├── auth.py          bcrypt hashing + JWT sign/verify
        ├── deps.py          get_current_user dependency (reads the auth cookie)
        ├── invites.py       Invite token generation/hashing + validation
        ├── mail.py          SMTP invitation mailer
        ├── schemas.py       Request-body models + validation rules
        ├── types.py         Response models (camelCase mirrors of the TS types)
        ├── status_rules.py  Status matrix, counters, visibility/permission rules
        ├── seed.py          Demo dataset
        ├── reseed.py        Guarded wipe + re-seed of the demo dataset
        ├── repositories/mongo.py  MongoStore: queries, indexes, secret stripping
        ├── services/bug_workflow.py  Bug create/edit/status/comment/analysis logic
        ├── services/seeding.py       Demo seed + schema migration
        ├── services/groq.py          AI analysis + context prompt builder
        └── routers/         auth, meta, invites, members, projects, bugs, notifications
```

## Tests

Backend (pytest - needs no database or secrets; `conftest.py` supplies dummy
test settings):

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest
```

The suite covers the status matrix, counters, visibility/triage/comment rules,
request validation and settings guards, plus auth, invitations, bug workflow
transitions and AI analysis - all driven through a fake in-memory store rather
than Mongo or a live Groq key.

Frontend (vitest + Testing Library):

```powershell
cd frontend
npm install
npm test          # vitest run
npm run test:watch  # watch mode
```

The frontend suite covers login, route guards, bug reporting, status
transitions, invitations and role-filtered navigation. Run `npx tsc --noEmit`
(or `npm run build`) for the type gate.

## Prerequisites

- Python 3.12+
- Node.js 20+
- A MongoDB Atlas cluster (free tier is fine) - **required**, the API refuses to
  start without a reachable database
- Optional: a Groq API key for AI analysis (without it the analyze endpoint
  returns a clear 503)

## Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and fill it in:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=DevDiagnose

# Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET=

# First Admin, used only while the members collection is empty. Set both or neither.
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_PASSWORD=
BOOTSTRAP_ADMIN_NAME=Admin

SEED_DEMO_DATA=false

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

APP_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@devdiagnose.app
```

- `MONGODB_URI` / `DB_NAME` - where all data lives. Read from `.env` **relative
  to the working directory**, so always start the API from `backend/`.
- `JWT_SECRET` - signs login tokens. **Required**: the API refuses to start
  without it, and it must be at least 16 characters and not look like a
  placeholder, so a value copied straight from `.env.example` is rejected.
- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` / `BOOTSTRAP_ADMIN_NAME` -
  create the first Admin when the members collection is empty. This is the only
  route to the first account: there is no self-registration and invitations
  require an existing Admin, so without these a fresh database has no way in.
  The password must satisfy the invite policy (8+ characters, one uppercase, one
  number, one symbol). Both must be set together, and they are ignored once any
  member exists.
- `SEED_DEMO_DATA` - off by default. Demo accounts are only created when this is
  explicitly `true` (see [Demo data](#demo-data)).
- `GROQ_API_KEY` - enables **Analyze with AI** (analysis returns 503 without it,
  unless the report is too thin to analyse - see [AI analysis](#ai-analysis)).
- `CORS_ORIGINS` - comma-separated allowed origins for the frontend.
- `APP_URL` - base URL used to build `/invite/<token>` links.
- `SMTP_*` - invitation email; leave `SMTP_HOST` empty to log the invite link
  instead of sending (handy locally - the API always returns the link so the UI
  can copy it).
- `ANALYZE_COOLDOWN_SECONDS` / `MAX_ANALYSES_PER_BUG` - bound repeated AI calls
  and per-document growth (defaults 20s and 10).

`backend/.env` is gitignored - never commit real credentials.

## Run the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000/api`
- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health` →
  `{"status": "ok", "backend": "mongo", "seeded": true}`

On startup the app connects to Atlas, creates indexes and runs an idempotent
schema migration. Seeding is also attempted from the read paths
(`seed_if_empty`), not just boot.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to
`http://localhost:8000`, so no extra configuration is needed for local
development. For a hosted backend set `VITE_API_URL` at build time
(`$env:VITE_API_URL="https://api.example.com/api"`) - the client falls back to
`/api` when it is unset.

Production build: `npm run build` (runs `tsc -b` then `vite build`) and serve
`frontend/dist`.

There is no separate `typecheck` script and no linter configured; `tsc -b` runs
as part of the production build and is the only type gate. `tsconfig.json` is
`strict` with `noUnusedLocals` / `noUnusedParameters`. Tests run with
`npm test` (vitest).

## Demo data

`app/seed.py` holds the demo dataset (workspace, projects, bugs across the whole
status flow). It is **off by default** and is only applied when
`SEED_DEMO_DATA=true`, so a fresh database never comes up with accounts whose
password is published in this repository.

To load the demo dataset into an empty database:

```powershell
cd backend
# in .env: SEED_DEMO_DATA=true
uvicorn app.main:app --reload --port 8000
```

To wipe everything and reload it at any time:

```powershell
cd backend
python -m app.reseed
```

`reseed` drops members, projects, bugs, notifications, activity, assignments,
invites and company settings, re-inserts `app/seed.py`, resets every password to
the demo password and recomputes the project bug counters.

`reseed` is destructive, so it refuses to run unless you confirm the database
name it is about to wipe, and it additionally requires
`DEVDIAGNOSE_ALLOW_RESEED=1` for any database that is not the well-known local
one. Treat it as a development tool.

> **There is no self-registration endpoint.** The first Admin is created either
> by the demo seed or by the `BOOTSTRAP_ADMIN_*` settings; every later member is
> created by an existing Admin through an invitation.

## Using the app

1. **Sign in** at `/login` with the bootstrap Admin account (or a demo account if
   you enabled the demo dataset).
2. **Dashboard** - scoped bug counts, status breakdown, recent activity.
3. **Report a bug** - `/bugs/new`: pick a project you belong to, fill the form
   (inline validation), attach a screenshot, submit.
4. **Analyze** - open the bug and press *Analyze with AI* to get root cause +
   suggested fix; discuss in comments; amend the report if needed (revision
   bumps, older analysis marked stale).
5. **Work the board** - `/bugs` kanban: assign, move status according to the
   role matrix, validate or reject at QA Validation, close.
6. **My work** (`/my-work`, QA and Developer only) - everything assigned to you
   or reported by you.
7. **Projects** - create with the wizard (Admin), open detail for stack, team,
   activity and counters; Admins can edit afterwards.
8. **Team (Admin)** - `/employees` invites by email and returns a copyable
   `/invite/<token>` link; `/company` sets name, workspace slug, QA toggle, logo.
9. **Settings** - change your password (rules are checked live).
10. **Invite link** - open `/invite/<token>` to set name + password, then log in.

## API reference

Public routes need no credentials; everything else requires the HttpOnly
session cookie set by `POST /api/auth/login` (the JWT is never handed to page
JavaScript, so no `Authorization` header is used - the client sends
`credentials: 'include'`). The public / protected split is declared in
`main.py:24-36`.

| Method | Path | Description | Auth |
| ------ | ---- | ----------- | ---- |
| GET  | `/api/health` | Liveness + backend + seeded flag | public |
| POST | `/api/auth/login` | `{email, password}` → `{user}`; sets the HttpOnly session cookie | public |
| POST | `/api/auth/logout` | Delete the session cookie | public |
| GET  | `/api/invites/{token}` | Validate an invite → `{valid, email, name, expiresAt}` | public |
| POST | `/api/invites/accept` | Set name + password → member becomes `Active` | public |
| GET  | `/api/bootstrap` | Current user, company, scoped members/projects/bugs, notifications, activity | cookie |
| PATCH| `/api/company` | Admin: name, workspace, `hasQA`, logo | Admin |
| GET  | `/api/projects` | List projects visible to the caller | cookie |
| GET  | `/api/projects/{id}` | Single project (404 if out of scope) | cookie |
| POST | `/api/projects` | Create project (wizard payload) | Admin |
| PATCH| `/api/projects/{id}` | Admin: edit project (name, description, stack, team, ...) | Admin |
| POST | `/api/projects/{id}/members` | Add a member to the project team | Admin |
| GET  | `/api/bugs` | List bugs visible to the caller | cookie |
| GET  | `/api/bugs/{id}` | Single bug (404 if out of scope) | cookie |
| POST | `/api/bugs` | Create bug report (201); reporter and status are server-set | cookie + project membership |
| PATCH| `/api/bugs/{id}` | Edit report fields, assignment, severity/priority, status | cookie + field-specific check |
| PATCH| `/api/bugs/{id}/status` | Role-checked workflow transition | cookie |
| POST | `/api/bugs/{id}/comments` | Add a comment (`{body}`; author is server-set) | cookie + bug access |
| POST | `/api/bugs/{id}/analyze` | Run AI analysis (503 without `GROQ_API_KEY`, 429 when rate-limited) | cookie + bug access |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword}` | cookie |
| GET  | `/api/members` | Full team directory | Admin |
| POST | `/api/members` | Admin: invite by email → `{email, inviteLink, expiresAt, emailSent}` | Admin |
| DELETE | `/api/members/{id}` | Admin: remove member (protected admin → 409) | Admin |
| GET  | `/api/notifications` | Notifications visible to the caller | cookie |
| POST | `/api/notifications/read-all` | Mark visible notifications read | cookie |

Failed field validation returns `422` with FastAPI's `detail` array; the client
surfaces the first message per field and also shows API errors inline.

## Data model

Collections use their string `id` as Mongo `_id`; secrets (`passwordHash`,
`inviteTokenHash`, `inviteSentAt`, `inviteExpiresAt`) are stripped before any
document leaves the API (`repositories/mongo.py: public_user`).

| Collection | Notes |
| ---------- | ----- |
| `members` | name, email, role (Developer/QA/Admin), avatarColor, status, bcrypt `passwordHash`, `protected` flag |
| `invites` | SHA-256 `tokenHash`, email, role, status (`pending` / `accepted` / `used`), expiry - the member doc is created only on accept |
| `company` | name, workspace slug, `hasQA` toggle, logo |
| `projects` | purpose/type, frontend/backend/database/services/auth/deployment, architecture, modules, apiPatterns, environments, browsers, platforms, businessRules, testingTools, conventions, constraints, repoUrl, docsUrl, `memberIds[]`, bug counters |
| `bugs` | ref, title, description, projectId, status, severity, priority, category, reporterId, `assigneeIds[]`, steps, expected/actual, environment, browserDevice, `evidence[]`, `comments[]`, `analyses[]`, `timeline[]`, `reportRevision`, resolvedBy/At, closedAt, `validatorId`, `needsAttention` |
| `bug_assignments` | assignment history mirroring `assigneeIds` |
| `notifications` | category, message, read, bugRef, optional `userIds[]` audience |
| `recentActivity` | short activity feed entries |

Indexes created on startup: unique `members.email`, `bugs(projectId, status)`,
`bug_assignments(bugId)`, `bug_assignments(developerId, status)`,
`notifications(read)`. Index creation errors are swallowed
(`repositories/mongo.py: _ensure_indexes`).

  `recentActivity` is only ever read, never written by the API - the collection is
  seeded data, and the activity entries the dashboard shows are built client-side
  (`data-context.tsx`) and disappear on reload. Because those rows carry no project
  or bug reference, the endpoint serves them to Admin and QA only rather than
  filtering them per project.

### Bug status flow

The enum is `Draft, Submitted, Assigned, In Progress, Resolved, QA Validation,
Closed` (`status_rules.py: ALL_STATUSES`). Note that `Resolved` precedes
`QA Validation`: a developer finishes the work first, and validation is what
follows.

- With **QA enabled** (`company.hasQA`), a developer's *Resolve* is redirected
  into **QA Validation**; QA then validates (→ Closed) or rejects (→ In Progress,
  `needsAttention = true`). Only Admin can reopen a Closed bug.
- With **QA off**, the same redirect happens but is labelled **Validation** and
  goes to the **reporter** - as long as the reporter is not the person who
  resolved it. Resolving your own bug with no QA workflow just leaves it
  `Resolved` (done). Developers may withdraw from Resolved back to In Progress.
- `Draft` is a valid create-time status and can be submitted by a team member.

The transition matrix lives in `backend/app/status_rules.py`
(`allowed_statuses`, `display_status`, `project_bug_counts`, `is_open`) and is
mirrored in `frontend/src/lib/status-rules.ts` (`allowedStatuses`,
`statusLabel`).

Kanban columns (`frontend/src/components/bug-board.tsx: boardColumns`):

| Column | QA on | QA off |
| ------ | ----- | ------ |
| Pending | Draft, Submitted, Assigned | same |
| In Progress | In Progress | same |
| Review | Resolved, QA Validation | QA Validation |
| Done | Closed | Resolved, Closed |

### Project counters

Recomputed on every create/patch/status change from the project's bugs
(`status_rules.py: project_bug_counts`):

- `openBugs` - status not Resolved/Closed
- `highSeverity` - Critical/High **and** still open
- `resolvedBugs` - not open
- `awaitingValidation` - status is QA Validation

The dashboard's own "Open" tile counts only Submitted/Assigned
(`pages/dashboard.tsx`), so it does not agree with `openBugs` for bugs that are
In Progress.

## AI analysis

`POST /api/bugs/{id}/analyze` (`app/services/groq.py`) builds a context prompt
from the bug and its project (business rules, architecture, tech stack) plus
human comments, calls Groq, and stores the result as an `analysis` document with
`reportRevision` (to detect staleness), `inputContext` (exact prompt snapshot),
`evidenceConsidered` and a structured `suggestedFix {summary, steps, code}`.

Reports that lack reproducible detail return an honest
`Insufficient information to diagnose` root cause with 5% confidence and no
invented code. That answer is produced locally by `has_actionable_content` /
`insufficient_analysis` **without calling the model at all**, so it also works
with no `GROQ_API_KEY` set. Adding a detailed comment and re-analyzing unlocks
the full diagnosis; with the key missing, the endpoint returns 503 instead.

Screenshots are display-only and never reach the model (nor the stored
`inputContext`). The AI's own comments are likewise excluded from the prompt.

Each bug keeps at most `MAX_ANALYSES_PER_BUG` analyses (default 10, oldest
dropped) and a single user cannot re-analyze the same bug more than once per
`ANALYZE_COOLDOWN_SECONDS` (default 20, returning 429). Both limits are
configurable.

## Security notes

What the API actually enforces:

- Passwords are bcrypt-hashed and never serialized; invite tokens are stored
  only as SHA-256 hashes. Invite acceptance is a single atomic
  `pending -> accepted` claim, so one link cannot be redeemed twice.
- Every non-public route goes through `get_current_user`, which reads the
  HttpOnly session cookie (`devdiagnose_token`: SameSite=Lax, 7-day expiry,
  `Secure` whenever `APP_URL` is https). The token is set only as a cookie -
  never in a response body - and its subject is re-read from the members
  collection on every request. A non-Active account is rejected at login.
- Admin-only actions (invite, member deletion, company update, project creation,
  project edit, project team edit) return 403 for other roles; deleting the
  protected admin returns 409.
- **Reporter and comment identity are server-derived.** `BugCreate` has no
  `reporterId` and no `status` field, and `CommentIn` carries only `body`, so a
  request body cannot report as another member, forge an `AI` comment, or create
  a bug directly in a status. New bugs always start at `Submitted`.
- **Reads are scoped server-side.** `/api/bootstrap`, `/api/projects`,
  `/api/bugs/{id}` and `/api/notifications` filter to the projects a member is on,
  plus any bug they reported or are assigned to. A bug outside that scope returns
  404 rather than 403, so it does not confirm the bug exists. The directory is
  trimmed to the people needed to render names; the full roster is Admin-only.
- Triage (`assigneeIds`, `severity`, `priority`) is restricted to the reporter,
  assignees, project team, QA or an Admin. The eight `REPORT_FIELDS` of an
  existing report are restricted to the reporter, assignees, project team or an
  Admin. Commenting follows the edit rule plus QA, who may read and triage every
  bug and so needs to be able to discuss them. Status transitions go through the
  role matrix and return 403 otherwise.
- Analysis and comments both re-check visibility on the target bug. Analysis is
  additionally rate-limited and capped, and assignees must be on the project team.
- `find_one_by` escapes its value before use in `$regex`
  (`repositories/mongo.py`).
- `JWT_SECRET` is required and rejected at boot if it is too short or looks like a
  placeholder. Demo seeding is off unless `SEED_DEMO_DATA=true`.

### Known gaps

- **No CI.** The backend suite (`pytest`) and frontend suite (`vitest`) run
  locally, and the frontend type gate runs in the production build, but
  nothing runs on push.
- **The analysis cooldown is per process.** It is an in-memory dict keyed by
  `(userId, bugId)`, so a multi-instance deployment can allow one analysis per
  instance per window. A shared store would be needed to make it global.
- **The activity feed is not per-bug.** Activity rows carry no bug reference, so
  they are served only to Admin and QA rather than being filtered per project.
- No backend linter is configured, and the frontend has no linter beyond `tsc`.

## Deployment

The two halves are deployed separately (there is no platform config in the
repo):

| Service   | How |
| --------- | --- |
| `backend/`  | Any ASGI host: `uvicorn app.main:app --port $PORT`, run with `backend/` as the working directory so `.env` resolves |
| `frontend/` | `npm run build`, then serve `frontend/dist` from any static host |

Environment variables for the backend:

- `JWT_SECRET` - required, at least 16 characters and not a placeholder. The API
  refuses to boot without it: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `MONGODB_URI` - required; there is no local fallback
- `APP_URL` - the frontend's origin: invitation links are built from it, and it
  decides whether the session cookie gets the `Secure` flag (set it to the real
  https domain in production)
- `CORS_ORIGINS` - the frontend origin(s), since the API is on a different domain
- `GROQ_API_KEY` - optional; without it the AI endpoint returns 503

`SEED_DEMO_DATA` is `false` by default, so a fresh database will not come up
with the demo accounts. To get a usable first login on a new database, set
`BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (both or neither) before
the first request. The API then creates that Admin once, when the members
collection is empty.

Set `VITE_API_URL` at build time to point the client at the deployed API
(`$env:VITE_API_URL="https://api.example.com/api"`); leave it unset when a
reverse proxy serves `/api` from the same origin as the frontend - that keeps
the browser on a single origin and `CORS_ORIGINS` unused. Note that
`vite.config.ts` sets no `base` path, so serving from a sub-path (GitHub Pages)
needs one.

## Troubleshooting

- **503 on analyze** - `GROQ_API_KEY` missing/invalid, or Groq is unreachable.
  (A report with no actionable detail returns an "insufficient information"
  analysis instead, without a 503.)
- **Backend exits on boot** - `MONGODB_URI` unset or the cluster unreachable;
  the API has no local fallback by design.
- **CORS errors** - add the frontend origin to `CORS_ORIGINS` and restart.
- **`.env` ignored** - it is loaded relative to the working directory; run the
  API from `backend/`.
- **Invite link 404/410** - token invalid, already accepted/used, or expired
  (default 72h); invite again from `/employees`.
  - **Empty dashboard** - wrong account: the API only returns projects and bugs for
    the teams the signed-in user belongs to. Sign in as an Admin or QA to see
    everything.
