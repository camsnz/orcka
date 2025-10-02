from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Invoice API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _env(key: str, fallback: str) -> str:
    import os

    value = os.getenv(key)
    return value if value else fallback


def build_payload() -> dict:
    build_time = _env("BUILD_TIME", datetime.now(timezone.utc).isoformat())
    git_sha = _env("GIT_SHA", "dev-snapshot")
    version = _env("SERVICE_VERSION", "0.0.0")

    dependencies = [
        {"name": "fastapi", "version": "0.115.6"},
        {"name": "uvicorn", "version": "0.32.1"},
        {"name": "httpx", "version": "0.27.2"},
    ]

    return {
        "serviceName": "Invoice API",
        "techStack": "Python 3.11 + FastAPI",
        "buildTime": build_time,
        "gitSha": git_sha,
        "buildVersion": version,
        "dependencies": dependencies,
    }


@app.get("/info")
async def info() -> dict:
    return build_payload()
