"""Minimal HTTPS control-plane bridge exposing Modal Sandboxes to Cloudflare Workers.

Deploy with:
    modal deploy bridge/modal_sandbox_bridge.py

Required Modal Secret `mechane-sandbox-bridge-auth`:
    MECHANE_MODAL_BRIDGE_TOKEN=<shared-bearer-token>
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone
from typing import Any

import modal
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = modal.App("mechane-sandbox-bridge")
web_app = FastAPI(title="Mechane Modal Sandbox Bridge")
bridge_image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi>=0.115", "pydantic>=2.9")


class StartOrResumeRequest(BaseModel):
    app_name: str = "mechane-sandboxes"
    session_id: str
    image: str
    existing_sandbox_id: str | None = None
    snapshot_id: str | None = None
    cpu_cores: float | None = None
    memory_mb: int | None = None
    timeout_seconds: int | None = None
    env: dict[str, str] = {}


class StopRequest(BaseModel):
    should_snapshot: bool = True


def _require_bearer(authorization: str | None) -> None:
    expected = os.environ.get("MECHANE_MODAL_BRIDGE_TOKEN", "")
    if not expected or not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    presented = authorization[len("Bearer ") :]
    if not hmac.compare_digest(presented, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _sandbox_status(sandbox: modal.Sandbox) -> str:
    return "running" if sandbox.poll() is None else "stopped"


@web_app.post("/v1/sandboxes/start-or-resume")
def start_or_resume(body: StartOrResumeRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _require_bearer(authorization)
    if body.existing_sandbox_id:
        try:
            existing = modal.Sandbox.from_id(body.existing_sandbox_id)
            if existing.poll() is None:
                return {"sandbox_id": existing.object_id, "status": "running"}
        except Exception:
            pass

    target_app = modal.App.lookup(body.app_name, create_if_missing=True)
    if body.snapshot_id:
        image = modal.Image.from_id(body.snapshot_id)
    else:
        image = modal.Image.from_registry(body.image)

    kwargs: dict[str, Any] = {
        "app": target_app,
        "image": image,
        "env": body.env,
        "timeout": body.timeout_seconds or 3600,
    }
    if body.cpu_cores is not None:
        kwargs["cpu"] = body.cpu_cores
    if body.memory_mb is not None:
        kwargs["memory"] = body.memory_mb

    sandbox = modal.Sandbox.create("node", "/opt/mechane/worker-agent.mjs", **kwargs)
    return {"sandbox_id": sandbox.object_id, "status": "running"}


@web_app.get("/v1/sandboxes/{sandbox_id}")
def get_status(sandbox_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _require_bearer(authorization)
    try:
        sandbox = modal.Sandbox.from_id(sandbox_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Sandbox not found: {exc}") from exc
    return {"sandbox_id": sandbox.object_id, "status": _sandbox_status(sandbox)}


@web_app.post("/v1/sandboxes/{sandbox_id}/snapshot")
def snapshot_sandbox(sandbox_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _require_bearer(authorization)
    sandbox = modal.Sandbox.from_id(sandbox_id)
    snapshot = sandbox.snapshot_filesystem()
    return {
        "snapshot_id": snapshot.object_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@web_app.post("/v1/sandboxes/{sandbox_id}/stop")
def stop_sandbox(
    sandbox_id: str,
    body: StopRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_bearer(authorization)
    try:
        sandbox = modal.Sandbox.from_id(sandbox_id)
    except Exception:
        return {"snapshot_id": None}

    snapshot_id: str | None = None
    if body.should_snapshot and sandbox.poll() is None:
        snapshot = sandbox.snapshot_filesystem()
        snapshot_id = snapshot.object_id
    sandbox.terminate()
    return {"snapshot_id": snapshot_id}


@web_app.delete("/v1/sandboxes/{sandbox_id}")
def destroy_sandbox(sandbox_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _require_bearer(authorization)
    try:
        sandbox = modal.Sandbox.from_id(sandbox_id)
        sandbox.terminate()
    except Exception:
        pass
    return {"deleted": True}


@app.function(image=bridge_image, secrets=[modal.Secret.from_name("mechane-sandbox-bridge-auth")])
@modal.asgi_app()
def fastapi_app() -> FastAPI:
    return web_app
