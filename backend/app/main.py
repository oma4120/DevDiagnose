import logging

from fastapi import Depends, FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import get_store
from app.deps import get_current_user
from app.routers import auth, bugs, invites, members, meta, notifications, projects

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="DevDiagnose Backend", version="1.0.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public: health, login, and invitation acceptance.
public = APIRouter(prefix="/api")
public.include_router(meta.router)
public.include_router(auth.router)
public.include_router(invites.router)

# Everything else requires a valid Bearer token.
private = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])
private.include_router(meta.private)
private.include_router(members.router)
private.include_router(projects.router)
private.include_router(bugs.router)
private.include_router(notifications.router)
app.include_router(public)
app.include_router(private)


@app.on_event("startup")
def on_startup() -> None:
    store = get_store()
    store.seed_if_empty()
    logging.info("DevDiagnose API ready (backend: %s).", store.backend.__class__.__name__)