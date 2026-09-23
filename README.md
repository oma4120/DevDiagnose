# DevDiagnose

AI-powered internal bug analysis and tracking platform for software engineering
teams. Reports come in, the AI diagnoses root cause + suggested fixes, and QA/Dev
drive bugs through a kanban workflow to resolution.

Monorepo: **React + Vite (Tailwind v4) frontend** and a **FastAPI + MongoDB
(Atlas) backend**. Both sides share the same document shapes (camelCase) so the
frontend can consume the API 1:1.

## Repo layout

```
DevDiagnose/
├── frontend/          React + Vite + Tailwind v4 app
│   └── src/lib/api.ts Frontend API client (calls the FastAPI backend)
├── backend/           FastAPI service
│   ├── app/main.py    App entry (CORS + public/protected router mounting)
│   ├── app/config.py  Settings (MONGODB_URI, DB_NAME, GROQ_API_KEY, JWT_SECRET, CORS)
│   ├── app/auth.py    bcrypt password hashing + JWT sign/verify
│   ├── app/invites.py Invite token generation/hashing + link validation
│   ├── app/mail.py    SMTP mailer for invitations (stdlib smtplib)
│   ├── app/deps.py    Shared auth dependency (`get_current_user`)
│   ├── app/db.py      Store layer (Mongo with in-memory fallback + seeding + migration)
│   ├── app/types.py   Pydantic mirrors of the frontend TS types (responses)
│   ├── app/schemas.py Request-body models (create/patch/comment/status/auth)
│   ├── app/seed.py    Demo seed data (users, company, projects, bugs, …)
│   ├── app/routers/   auth, invites, projects, bugs, members, notifications, meta
│   └── app/services/  groq.py (AI analysis via Groq)
└── README.md
```

## Prerequisites

- Python 3.12+
- Node.js 20+
- A MongoDB Atlas cluster (or local Mongo) — free tier is fine
- Optional: a Groq API key for AI analysis

## Backend setup (first time)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Configure environment

Copy `backend/.env.example` to `backend/.env` and fill in:

```dotenv
# MongoDB connection string (Atlas or local)
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=devdiagnose

# Groq API key — without it "Analyze with AI" returns a 503
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Secret used to sign login JWTs — set a long random value outside dev
JWT_SECRET=dev-secret-change-me

# CORS origins for the Vite dev server
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Public base URL used to build email invitation links.
APP_URL=http://localhost:5173

# SMTP settings for the "invite by email" flow. Leave SMTP_HOST empty to
# log invitations instead of sending (handy for local development).
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@devdiagnose.app
```

`backend/.env` is gitignored — never commit real credentials.

## Run the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000/api`
- Interactive docs (Swagger): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

On startup the app pings your Atlas cluster. If it connects it seeds any empty
collections; if `MONGODB_URI` is missing/unreachable it falls back to in-memory
demo data so the server always boots. `/api/health` reports which backend is
active: `"backend":"mongo"` or `"backend":"memory"`.

## Run the frontend

```powershell
cd frontend
npm install
$env:VITE_API_URL="http://localhost:8000/api"   # PowerShell
npm run dev
```

Open `http://localhost:5173`. Without `VITE_API_URL` the client defaults to
`/api` (the Vite dev server proxies `/api` → `http://localhost:8000`), so
`npm run dev` is all you need when the backend runs on default ports.

## Authentication

All endpoints except `/api/health` and `/api/auth/login` require a JWT.
Invitation acceptance (`/api/invites/*`) is also public — those endpoints are
only reachable via the emailed token link:

1. `POST /api/auth/login` with `{"email", "password"}` → `{token, user}`.
2. Send `Authorization: Bearer <token>` on every other request.

Passwords are stored as bcrypt hashes (`members.passwordHash`, never
serialized over the API). All seeded users (`*@northwind.dev`) use the demo
password `demo1234`. The frontend keeps the token in `localStorage`
(`dd_token`) and the login page wires into this flow; `logout` clears it and
the route guard redirects unauthenticated users to `/login`.

## Invitations

Admins invite employees by email (Settings → Company) or add known employees
by name (Team page):

1. `POST /api/members {email, role}` records a pending invitation (an `invites`
   document — **no member is created yet**) storing only a SHA-256 token hash,
   then emails `<APP_URL>/invite/<token>` via SMTP. If `SMTP_HOST` is empty the
   link is logged instead, and the API always returns it so the UI can copy it.
2. The employee opens the link, sees a profile-setup form (first/last name +
   password, validated against the invite).
3. `POST /api/invites/accept` checks the token, expiry (default 72h) and
   status, then creates the member with the profile + bcrypt password as
   `Active` and marks the invitation `accepted`.
4. The employee is redirected to `/login` and signs in with their email +
   new password.

The member only exists after step 3 — sending an invitation never creates a
team member. Tokens are single-use and expire; a used/expired link returns
`404`/`410`. Admins may resend as many invitations as they like to an email
that has no member yet. `POST /api/members` and `POST /api/members/direct`
return `403` for non-admins and `409` once that email is already a member.

## API endpoints

| Method | Path                        | Description                                        |
| ------ | --------------------------- | -------------------------------------------------- |
| GET  | `/api/health`               | Liveness + active backend (`mongo`/`memory`) — public |
| POST | `/api/auth/login`           | Email + password → `{token, user}` — public        |
| GET  | `/api/bootstrap`            | Everything the app needs on load (user, company, members, projects, bugs, notifications, activity) — Bearer |
| GET  | `/api/projects`             | List projects                                      |
| GET  | `/api/projects/{id}`        | Single project                                     |
| POST | `/api/projects`             | Create project (8-step wizard payload)             |
| GET  | `/api/bugs`                 | List bugs                                          |
| GET  | `/api/bugs/{id}`            | Single bug                                         |
| POST | `/api/bugs`                 | Create bug report                                  |
| PATCH| `/api/bugs/{id}`            | Patch severity / priority / status                 |
| PATCH| `/api/bugs/{id}/status`     | Move bug through the flow (kanban column)          |
| POST | `/api/bugs/{id}/comments`   | Add a comment (QA/Developer/AI/System)             |
| POST | `/api/bugs/{id}/analyze`    | Run AI analysis (Groq); 503 without `GROQ_API_KEY` |
| GET  | `/api/members`              | Team members                                       |
| POST | `/api/members`              | Admin: invite an employee by email → `{email, inviteLink, expiresAt, emailSent}`; emails them a `/invite/{token}` setup link (no member created yet) |
| POST | `/api/members/direct`       | Admin: add an already-known employee by name → stored Active member, no email |
| GET  | `/api/invites/{token}`      | Validate an invite link → `{valid, email, expiresAt, name}` — public |
| POST | `/api/invites/accept`       | Set first/last name + password on an invited member → Active — public |
| GET  | `/api/notifications`        | Notification list                                  |
| POST | `/api/notifications/read-all` | Mark all notifications read                      |

All routes below the first two require `Authorization: Bearer <token>`.

## Data model

Collections are seeded/migrated automatically; the string `id` doubles as the
Mongo `_id`. Schemas live in `backend/app/types.py` (response) and
`backend/app/schemas.py` (request). Field names are camelCase to match the
frontend (`frontend/src/lib/types.ts`).

| Collection       | Fields |
| ---------------- | ------ |
| `members`        | id, name, firstName, lastName, email, role (Developer/QA/Admin), avatarColor, status (Active/Invited/Inactive), assignedBugs, resolvedBugs, lastActive, **passwordHash** (bcrypt, never serialized) |
| `invites`        | id, tokenHash (SHA-256, never serialized), email, role, status (`pending`/`accepted`/`used`), createdAt, expiresAt, acceptedAt, memberId — a pending invitation; the member doc is only created on accept |
| `projects`       | id, name, description, purpose, type, frontend[], backend[], database[], services[], auth[], deployment[], architecture, modules[], apiPatterns, environments, browsers[], platforms[], businessRules[], testingTools[], conventions, constraints, repoUrl, docsUrl, memberIds[], openBugs, highSeverity, resolvedBugs, awaitingValidation, updatedAt |
| `bugs`           | id, ref, title, description, projectId, status (Submitted→…→Closed), severity, priority, category, reporterId, assigneeIds[], stepsToReproduce[], expectedResult, actualResult, environment, browserDevice, createdAt, updatedAt, evidence[], comments[], analyses[], timeline[], resolvedBy, resolvedAt, closedAt |
| `bug_assignments`| id, bugId, developerId, assignedBy, assignedAt, unassignedAt, status (`active`/`completed`/`removed`) — mirrors `bugs.assigneeIds` and keeps assignment history |
| `notifications`  | id, category, message, at, read, bugRef |
| `recentActivity` | id, message, at |

Embedded shapes — `Evidence` (incl. `fileUrl`, `metadata`), `Comment`,
`TimelineEntry`, `AIAnalysis` (incl. structured `suggestedFix`
`{summary, steps, code}`, `uncertainty` string, `inputContext` snapshot),
`SuggestedFix`, `BusinessRule`, `EnvSpec` — are defined in
`backend/app/types.py`.

Mongo indexes are created on startup (`app/db.py`): unique `members.email`,
`bugs(projectId, status)`, `bug_assignments(bugId)`,
`bug_assignments(developerId, status)`, `notifications(read)`.

### Bug status flow

`Draft / Submitted → Assigned → In Progress → QA Validation → Resolved → Closed`

Kanban columns on the bugs page map: **Pending** = Draft/Submitted/Assigned,
**In Progress**, **Review** = QA Validation, **Done** = Resolved/Closed.

## Seeding / reset

Seeding is automatic and idempotent at startup (`app/db.py: seed_if_empty`).
To force a clean reseed:

```powershell
# drop the database, then restart the API — it re-seeds on boot
mongosh $env:MONGODB_URI --eval 'db.dropDatabase()'
```

## AI analysis

`POST /api/bugs/{id}/analyze` calls Groq (`app/services/groq.py`) with the bug's
full project context (business rules, architecture, tech stack) and returns
classification, severity/priority recommendation, root cause, a **structured
suggested fix** (`{summary, steps, code}`), recommended tests, confidence, a
single-string `uncertainty`, and the `evidenceConsidered` list. The actual
`inputContext` snapshot sent to the model is stored on the analysis document.
It requires `GROQ_API_KEY`; without it the endpoint returns a clear 503.

## Migration

On startup the app normalizes pre-existing documents to the current schema
(`app/db.py: Store.migrate`): it writes bcrypt `passwordHash` for seeded users,
adds `resolvedBy/resolvedAt/closedAt` on resolved/closed bugs,
drops `fileUrl`/`metadata` onto evidence, converts legacy `suggestedFix`
strings / `uncertainty` arrays to the structured shape, backfills
`bug_assignments` from `assigneeIds`, and creates the indexes above. It is
idempotent, so it is safe to run on an existing database.