import uuid
from datetime import datetime
from typing import Optional

from auth import require_admin
from db import get_db
from fastapi import APIRouter, Depends, HTTPException, Query
from models import RequestLog
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

router = APIRouter(prefix="/requests", tags=["requests"])


class RequestLogItem(BaseModel):
    id: uuid.UUID
    method: str
    path: str
    status_code: int
    latency_ms: float
    auth_type: str
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    run_id: Optional[str] = None
    app_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RequestLogDetail(RequestLogItem):
    request_body: Optional[str] = None
    response_body: Optional[str] = None


# Traffic worth surfacing on the dashboard: external API-key calls, plus local
# development traffic when auth is disabled. The dashboard's own JWT/refresh calls
# ("bearer"/"none") are intentionally excluded.
SURFACED_AUTH_TYPES = ("api_key", "admin_api_key", "disabled")

ENTITY_FILTERS = ("user_id", "agent_id", "run_id", "app_id")


@router.get("", response_model=list[RequestLogItem])
def list_requests(
    _auth=Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    user_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    run_id: Optional[str] = None,
    app_id: Optional[str] = None,
):
    stmt = (
        select(RequestLog)
        .where(RequestLog.auth_type.in_(SURFACED_AUTH_TYPES))
        .order_by(RequestLog.created_at.desc())
        .limit(limit)
    )
    entity_filters = {"user_id": user_id, "agent_id": agent_id, "run_id": run_id, "app_id": app_id}
    for key, value in entity_filters.items():
        if value:
            stmt = stmt.where(getattr(RequestLog, key) == value)

    return db.execute(stmt).scalars().all()


@router.get("/{request_id}", response_model=RequestLogDetail)
def get_request(request_id: uuid.UUID, _auth=Depends(require_admin), db: Session = Depends(get_db)):
    log = db.get(RequestLog, request_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Request log not found.")
    return log
