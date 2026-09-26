# DevDiagnose

AI-powered internal bug analysis and tracking platform for software engineering
teams. Reports come in, the AI diagnoses root cause + suggested fixes, and QA/Dev
drive bugs through a kanban workflow to resolution.

Monorepo: **React + Vite (Tailwind v4) frontend** and a **FastAPI + MongoDB
Atlas backend**. Both sides share the same document shapes (camelCase) so the
frontend consumes the API 1:1.

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
- **Kanban workflow** - `Submitted → Assigned → In Progress → QA Validation →
  Resolved → Closed`, with role-based transitions (Developer / QA / Admin),
  optional QA-less mode, withdraw/reject handling and a `needsAttention` flag.
- **Report editing** - reporter/assignees/team/admin can amend a report; every
  change bumps `reportRevision` so older AI analyses are marked stale and
  re-analyzed.
- **Projects** - 8-step project wizard (purpose, stack, architecture, modules,
  environments, business rules, team) plus project edit; project cards show
  open / high-severity / resolved / awaiting-validation counters.
- **Visibility scoping** - developers only see bugs and projects for teams they
  belong to; QA and Admin see everything.
- **Team & invitations** - admins invite by email; the invite link creates the
  member only when the employee completes their profile (first/last name +
  password). Invitations expire (72h) and are single-use.
- **Notifications & activity** - targeted (per-user) or broadcast notifications,
  recent-activity feed, unread badge in the shell.
- **Self-service settings** - change your own password with live rule feedback.

## Tech stack

| Layer      | Choice |
| ---------- | ------ |
| Frontend   | React 19 + TypeScript, Vite 6, Tailwind CSS v4, react-router 7, lucide-react |
| Backend    | FastAPI, Pydantic v2 (request validation), Uvicorn |
| Database   | MongoDB Atlas (PyMongo) - required, no local fallback |
| Auth       | JWT (PyJWT) + bcrypt password hashes |
| AI         | Groq (`GROQ_MODEL`, default `openai/gpt-oss-120b`) |
| Mail       | stdlib `smtplib` for invitation emails (logs the link if SMTP is unset) |

## Repo layout

```
DevDiagnose/
├── frontend/                React + Vite + Tailwind v4 app
│   └── src/
│       ├── lib/api.ts       API client (fetch wrapper, token, 422 handling)
│       ├── lib/validation.ts Shared input rules (mirrors backend schemas)
│       ├── lib/data-context.tsx  Bootstrap data + visibility scoping + project stats
│       └── pages/           login, dashboard, bugs, bug-detail, bug-new,
│                            projects, project-detail, project-new, my-work,
│                            notifications, employees, company, invite, settings
└── backend/
    └── app/
        ├── main.py          App entry (CORS + public/protected routers)
        ├── config.py        Settings from .env (MONGODB_URI, GROQ_API_KEY, ...)
        ├── db.py            Mongo store: connect, indexes, seed, migrate, sanitize
        ├── auth.py          bcrypt hashing + JWT sign/verify, DEMO_PASSWORD
        ├── deps.py          get_current_user dependency
        ├── invites.py       Invite token generation/hashing + validation
        ├── mail.py          SMTP invitation mailer
        ├── schemas.py       Request-body models + validation rules
        ├── types.py         Response models (camelCase mirrors of the TS types)
        ├── status_rules.py  Status transition matrix + project bug counters
        ├── seed.py          Demo dataset
        ├── reseed.py        Wipe + re-seed the demo dataset
        ├── routers/         auth, meta, invites, members, projects, bugs, notifications
        └── services/groq.py AI analysis + context prompt builder
```

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

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

JWT_SECRET=dev-secret-change-me
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

APP_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@devdiagnose.app
```

- `MONGODB_URI` / `DB_NAME` - where all data lives.
- `GROQ_API_KEY` - enables **Analyze with AI** (analysis returns 503 without it).
- `JWT_SECRET` - signs login tokens; use a long random value outside dev.
- `CORS_ORIGINS` - comma-separated allowed origins for the frontend.
- `APP_URL` - base URL used to build `/invite/<token>` links.
- `SMTP_*` - invitation email; leave `SMTP_HOST` empty to log the invite link
  instead of sending (handy locally - the API always returns the link so the UI
  can copy it).

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

On startup the app connects to Atlas, creates indexes, seeds any empty
collection with the demo dataset and runs an idempotent schema migration.

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

## Demo data

Seeding is automatic and idempotent on startup (`app/db.py: seed_if_empty`).
To wipe everything and reload the demo dataset at any time:

```powershell
cd backend
python -m app.reseed
```

`reseed` drops members, projects, bugs, notifications, activity, assignments,
invites and company settings, re-inserts `app/seed.py`, resets every password to
the demo password and recomputes the project bug counters.

### Demo accounts

Every account uses the password **`demo1234`**.

| Name            | Email                     | Role      | On projects |
| --------------- | ------------------------- | --------- | ----------- |
| Ahmad Tester    | `ahmad25tester@gmail.com` | Admin     | (sees all)  |
| Omar Haddad     | `omar@northwind.dev`      | Developer | p1, p2      |
| Sara Nasser     | `sara@northwind.dev`      | QA        | p1, p3      |
| Layla Fahmi     | `layla@northwind.dev`     | Developer | p1          |
| Karim Mansour   | `karim@northwind.dev`     | Developer | p1, p2      |
| Rami Boulos     | `rami@northwind.dev`      | Developer | p1, p2, p3  |
| Hind Barakat    | `hind@northwind.dev`      | QA        | (no team)   |

Workspace: **Northwind Labs** (`northwind`), 3 projects, 11 demo bugs covering
the whole status flow.

## Using the app

1. **Sign in** at `/login` with a demo account.
2. **Dashboard** - scoped bug counts, status breakdown, recent activity.
3. **Report a bug** - `/bugs/new`: pick a project you belong to, fill the form
   (inline validation), attach a screenshot, submit.
4. **Analyze** - open the bug and press *Analyze with AI* to get root cause +
   suggested fix; discuss in comments; amend the report if needed (revision
   bumps, older analysis marked stale).
5. **Work the board** - `/bugs` kanban: assign, move status according to the
   role matrix, validate or reject at QA Validation, close.
6. **My work** - everything assigned to you (or reported by you).
7. **Projects** - create with the wizard, open detail for stack, team, activity
   and counters; admins can edit afterwards.
8. **Team (Admin)** - `/employees` invites by email and returns a copyable
   `/invite/<token>` link; `/company` sets name, workspace slug, QA toggle, logo.
9. **Settings** - change your password (rules are checked live).
10. **Invite link** - open `/invite/<token>` to set name + password, then log in.

## Input validation

The same rules run on the client (fast feedback) and on the API (authoritative
422 responses with a readable `msg`).

| Field | Rule |
| ----- | ---- |
| Bug title | required, 4-200 chars |
| Bug description | required, 10-20000 chars |
| Steps to reproduce | at most 50 items |
| Comment body | 1-5000 chars |
| Project / company name | 2-80 chars |
| Workspace slug | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3-40 chars (friendly 422) |
| Email | `^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$` (stored lowercased) |
| `repoUrl` / `docsUrl` | must start with `http://` or `https://`; `""` clears it |
| Business rules | each entry needs a non-empty title |
| Evidence image | `data:image/...` URL, max 1.5 MB; company logo max 2 MB |
| Password | 8+ chars with uppercase, a number and a symbol |

Failed field validation returns `422` with FastAPI's `detail` array; the client
surfaces the first message per field and also shows API errors inline.

## API reference

Public routes need no token; everything else requires
`Authorization: Bearer <token>` from `POST /api/auth/login`.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET  | `/api/health` | Liveness + backend + seeded flag - public |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` - public |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword}` - Bearer |
| GET  | `/api/invites/{token}` | Validate an invite → `{valid, email, ...}` - public |
| POST | `/api/invites/accept` | Set name + password → member becomes `Active` - public |
| GET  | `/api/bootstrap` | Current user, company, members, projects, bugs, notifications, activity - Bearer |
| PATCH| `/api/company` | Admin: name, workspace, `hasQA`, logo |
| GET  | `/api/projects` | List projects |
| GET  | `/api/projects/{id}` | Single project |
| POST | `/api/projects` | Create project (wizard payload) |
| PATCH| `/api/projects/{id}` | Admin: edit project (name, description, stack, team, ...) |
| POST | `/api/projects/{id}/members` | Add a member to the project team |
| GET  | `/api/bugs` | List bugs |
| GET  | `/api/bugs/{id}` | Single bug |
| POST | `/api/bugs` | Create bug report (201) |
| PATCH| `/api/bugs/{id}` | Edit report fields (bumps `reportRevision`) |
| PATCH| `/api/bugs/{id}/status` | Role-checked workflow transition |
| POST | `/api/bugs/{id}/comments` | Add a comment (QA/Developer/AI/System) |
| POST | `/api/bugs/{id}/analyze` | Run AI analysis (503 without `GROQ_API_KEY`) |
| GET  | `/api/members` | Team members |
| POST | `/api/members` | Admin: invite by email → `{email, inviteLink, expiresAt, emailSent}` |
| DELETE | `/api/members/{id}` | Admin: remove member (protected admin → 409) |
| GET  | `/api/notifications` | Notifications visible to the caller |
| POST | `/api/notifications/read-all` | Mark visible notifications read |

## Data model

Collections use their string `id` as Mongo `_id`; secrets (`passwordHash`,
`inviteTokenHash`) are stripped before any document leaves the API.

| Collection | Notes |
| ---------- | ----- |
| `members` | name, email, role (Developer/QA/Admin), avatarColor, status, bcrypt `passwordHash`, `protected` flag |
| `invites` | SHA-256 `tokenHash`, email, role, status (`pending`/`accepted`), expiry - the member doc is created only on accept |
| `company` | name, workspace slug, `hasQA` toggle, logo |
| `projects` | purpose/type, frontend/backend/database/services/auth/deployment, architecture, modules, apiPatterns, environments, browsers, platforms, businessRules, testingTools, conventions, constraints, repoUrl, docsUrl, `memberIds[]`, bug counters |
| `bugs` | ref, title, description, projectId, status, severity, priority, category, reporterId, `assigneeIds[]`, steps, expected/actual, environment, browserDevice, `evidence[]`, `comments[]`, `analyses[]`, `timeline[]`, `reportRevision`, resolvedBy/At, closedAt, `validatorId`, `needsAttention` |
| `bug_assignments` | assignment history mirroring `assigneeIds` |
| `notifications` | category, message, read, bugRef, optional `userIds[]` audience |
| `recentActivity` | short activity feed entries |

Indexes created on startup: unique `members.email`, `bugs(projectId, status)`,
`bug_assignments(bugId)`, `bug_assignments(developerId, status)`,
`notifications(read)`.

### Bug status flow

```
Submitted → Assigned → In Progress → QA Validation → Resolved → Closed
```

- With **QA enabled** (`company.hasQA`), a developer's *Resolve* goes to
  **QA Validation**; QA either validates (→ Closed) or rejects (→ In Progress,
  `needsAttention = true`). Only Admin can reopen a Closed bug.
- With **QA off**, the reporter validates their own fix (Resolved → Closed) and
  developers may withdraw a Resolved bug back to In Progress.
- Kanban columns: **Pending** = Submitted/Assigned, **In Progress**,
  **Review** = QA Validation, **Done** = Resolved/Closed.

The transition matrix lives in `backend/app/status_rules.py`
(`allowed_transitions`, `can_change_status`) and is mirrored in
`frontend/src/lib/status-rules.ts`.

### Project counters

Recomputed on every create/patch/status change from the project's bugs:

- `openBugs` - status not Resolved/Closed
- `highSeverity` - Critical/High **and** still open
- `resolvedBugs` - not open
- `awaitingValidation` - status is QA Validation

## AI analysis

`POST /api/bugs/{id}/analyze` (`app/services/groq.py`) builds a context prompt
from the bug and its project (business rules, architecture, tech stack) plus
human comments, calls Groq, and stores the result as an `analysis` document with
`reportRevision` (to detect staleness), `inputContext` (exact prompt snapshot),
`evidenceConsidered` and a structured `suggestedFix {summary, steps, code}`.

Reports that lack reproducible detail return an honest
`Insufficient information to analyze...` root cause with low confidence and no
invented code; adding a detailed comment and re-analyzing unlocks the full
diagnosis. Without `GROQ_API_KEY` the endpoint returns 503 with a clear message.

## Security notes

- Passwords are bcrypt-hashed and never serialized; invite tokens are stored
  only as SHA-256 hashes.
- Every non-public route goes through `get_current_user` (JWT).
- Admin-only actions (invites, member deletion, company/project edits) return
  403 for other roles; deleting the protected admin returns 409.
- Bug visibility and edits are scoped to project membership, reporter and
  assignees.

## Deployment

1. **Database** - create an Atlas cluster, a database user, and allow your
   host's IP; set `MONGODB_URI` + `DB_NAME`.
2. **Backend** - deploy `backend/` to any ASGI host (Render, Railway, Fly,
   Azure Container Apps, or a VM with `uvicorn app.main:app --port $PORT`).
   Set `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `CORS_ORIGINS` (your
   frontend origin), `APP_URL` (your frontend origin) and optionally `SMTP_*`.
   Run `python -m app.reseed` once if you want the demo dataset.
3. **Frontend** - `npm run build`, then serve `frontend/dist` from a static
   host (Vercel, Netlify, nginx, GitHub Pages) with `VITE_API_URL` pointing at
   the deployed API. Add that origin to `CORS_ORIGINS`.
4. Verify `GET /api/health` returns `"backend": "mongo"` and log in with the
   demo accounts (or invite your own team).

## Troubleshooting

- **503 on analyze** - `GROQ_API_KEY` missing/invalid, or Groq is unreachable.
- **Backend exits on boot** - `MONGODB_URI` unset or the cluster unreachable;
  the API has no local fallback by design.
- **CORS errors** - add the frontend origin to `CORS_ORIGINS` and restart.
- **Invite link 404/410** - token invalid or expired/used (default 72h); invite
  again from `/employees`.
- **Empty dashboard** - wrong account: a developer only sees projects they are a
  member of. Log in as `ahmad25tester@gmail.com` (Admin) to see everything.
