import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .database import init_db
from .routers import auth, search, emails, export, collections, attachments

app = FastAPI(title="InboxForge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(emails.router, prefix="/api/emails", tags=["emails"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(collections.router, prefix="/api/collections", tags=["collections"])
app.include_router(attachments.router, prefix="/api/attachments", tags=["attachments"])


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "InboxForge"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
