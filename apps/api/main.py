import os
import random
import secrets
import hashlib
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

import httpx
from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, create_engine, delete, func, select
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from sqlalchemy.types import JSON


TraceStatus = Literal["success", "error", "warning"]
StepType = Literal["user_message", "llm_call", "tool_call", "retrieval", "final_response", "error"]
ToolStatus = Literal["success", "error"]

MODEL_PRICING: dict[str, dict[str, Decimal]] = {
    "gpt-4.1-mini": {"inputPer1M": Decimal("0.40"), "outputPer1M": Decimal("1.60")},
    "gpt-4o-mini": {"inputPer1M": Decimal("0.15"), "outputPer1M": Decimal("0.60")},
    "claude-3.5-haiku": {"inputPer1M": Decimal("0.80"), "outputPer1M": Decimal("4.00")},
    "mock-fast": {"inputPer1M": Decimal("0.05"), "outputPer1M": Decimal("0.10")},
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "ai-agent-observability-api"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    demo_mode: bool = Field(default=True, alias="DEMO_MODE")
    database_url: str = Field(
        default="postgresql://observability:observability@localhost:5432/observability",
        alias="DATABASE_URL",
    )
    cors_origins: str = Field(
        default="http://localhost:5173,https://YOUR_GITHUB_USERNAME.github.io,https://YOUR_GITHUB_USERNAME.github.io/ai-agent-observability-dashboard",
        alias="CORS_ORIGINS",
    )
    port: int = Field(default=8000, alias="PORT")
    ingest_api_key: str | None = Field(default=None, alias="OBSERVABILITY_INGEST_API_KEY")
    openai_session_encryption_key: str | None = Field(default=None, alias="OPENAI_SESSION_ENCRYPTION_KEY")
    openai_session_hash_secret: str | None = Field(default=None, alias="OPENAI_SESSION_HASH_SECRET")
    openai_session_ttl_minutes: int = Field(default=60, alias="OPENAI_SESSION_TTL_MINUTES")
    openai_default_model: str = Field(default="gpt-4o-mini", alias="OPENAI_DEFAULT_MODEL")
    openai_allowed_models: str = Field(default="gpt-4o-mini,gpt-4.1-mini", alias="OPENAI_ALLOWED_MODELS")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+psycopg://", 1)
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local", "test"}

    @property
    def openai_ttl(self) -> timedelta:
        return timedelta(minutes=max(5, min(self.openai_session_ttl_minutes, 24 * 60)))

    @property
    def openai_allowed_model_list(self) -> list[str]:
        return [model.strip() for model in self.openai_allowed_models.split(",") if model.strip()]

    @property
    def openai_cookie_secure(self) -> bool:
        return not self.is_development

    @property
    def openai_cookie_samesite(self) -> Literal["lax", "none"]:
        return "lax" if self.is_development else "none"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


class Base(DeclarativeBase):
    pass


json_column_type = JSONB().with_variant(JSON(), "sqlite")


class AITrace(Base):
    __tablename__ = "ai_traces"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    app_name: Mapped[str] = mapped_column(String(120), index=True)
    session_id: Mapped[str] = mapped_column(String(160), index=True)
    user_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    operation: Mapped[str] = mapped_column(String(180), index=True)
    model: Mapped[str] = mapped_column(String(120), index=True)
    provider: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(24), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    latency_ms: Mapped[int] = mapped_column(default=0)
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    total_tokens: Mapped[int] = mapped_column(default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), default=Decimal("0"))
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", json_column_type, nullable=True)

    steps: Mapped[list["TraceStep"]] = relationship(
        back_populates="trace", cascade="all, delete-orphan", order_by="TraceStep.started_at"
    )
    tool_calls: Mapped[list["ToolCall"]] = relationship(
        back_populates="trace", cascade="all, delete-orphan", order_by="ToolCall.created_at"
    )


class TraceStep(Base):
    __tablename__ = "trace_steps"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    trace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("ai_traces.id", ondelete="CASCADE"), index=True)
    step_type: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(180))
    input: Mapped[str | None] = mapped_column(Text, nullable=True)
    output: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", json_column_type, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(nullable=True)
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)

    trace: Mapped[AITrace] = relationship(back_populates="steps")
    tool_calls: Mapped[list["ToolCall"]] = relationship(back_populates="step")


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    trace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("ai_traces.id", ondelete="CASCADE"), index=True)
    step_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("trace_steps.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tool_name: Mapped[str] = mapped_column(String(160), index=True)
    input: Mapped[dict[str, Any]] = mapped_column(json_column_type)
    output: Mapped[dict[str, Any] | None] = mapped_column(json_column_type, nullable=True)
    status: Mapped[str] = mapped_column(String(24), index=True)
    latency_ms: Mapped[int] = mapped_column(default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    trace: Mapped[AITrace] = relationship(back_populates="tool_calls")
    step: Mapped[TraceStep | None] = relationship(back_populates="tool_calls")


class OpenAISession(Base):
    __tablename__ = "openai_sessions"

    session_id_hash: Mapped[str] = mapped_column(String(128), primary_key=True)
    encrypted_api_key: Mapped[str] = mapped_column(Text)
    key_hint: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


engine = create_engine(settings.sqlalchemy_database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]


def require_ingest_api_key(
    x_observability_api_key: Annotated[str | None, Header(alias="X-Observability-Api-Key")] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    configured_key = settings.ingest_api_key
    if not configured_key:
        return

    bearer_prefix = "Bearer "
    bearer_token = authorization[len(bearer_prefix) :].strip() if authorization and authorization.startswith(bearer_prefix) else None
    supplied_key = x_observability_api_key or bearer_token
    if not supplied_key or not secrets.compare_digest(supplied_key, configured_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Valid ingest API key required")


IngestAuth = Annotated[None, Depends(require_ingest_api_key)]


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def utcnow() -> datetime:
    return datetime.now(UTC)


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["mock-fast"])
    cost = (Decimal(input_tokens) / Decimal(1_000_000) * pricing["inputPer1M"]) + (
        Decimal(output_tokens) / Decimal(1_000_000) * pricing["outputPer1M"]
    )
    return cost.quantize(Decimal("0.000001"))


class ToolCallCreate(BaseModel):
    tool_name: str
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] | None = None
    status: ToolStatus = "success"
    latency_ms: int = 0
    error_message: str | None = None
    created_at: datetime | None = None


class TraceStepCreate(BaseModel):
    step_type: StepType
    name: str
    input: str | None = None
    output: str | None = None
    metadata: dict[str, Any] | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    latency_ms: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    estimated_cost_usd: Decimal | None = None
    tool_calls: list[ToolCallCreate] = Field(default_factory=list)


class TraceCreate(BaseModel):
    app_name: str
    session_id: str
    user_id: str | None = None
    operation: str
    model: str
    provider: str = "mock"
    status: TraceStatus = "success"
    started_at: datetime | None = None
    ended_at: datetime | None = None
    latency_ms: int | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: Decimal | None = None
    error_message: str | None = None
    metadata: dict[str, Any] | None = None
    steps: list[TraceStepCreate] = Field(default_factory=list)


class ToolCallRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trace_id: UUID
    step_id: UUID | None
    tool_name: str
    input: dict[str, Any]
    output: dict[str, Any] | None
    status: str
    latency_ms: int
    error_message: str | None
    created_at: datetime


class TraceStepRead(BaseModel):
    id: UUID
    trace_id: UUID
    step_type: str
    name: str
    input: str | None
    output: str | None
    metadata: dict[str, Any] | None
    started_at: datetime
    ended_at: datetime | None
    latency_ms: int | None
    input_tokens: int | None
    output_tokens: int | None
    estimated_cost_usd: Decimal | None
    tool_calls: list[ToolCallRead] = Field(default_factory=list)


class TraceRead(BaseModel):
    id: UUID
    app_name: str
    session_id: str
    user_id: str | None
    operation: str
    model: str
    provider: str
    status: str
    started_at: datetime
    ended_at: datetime
    latency_ms: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost_usd: Decimal
    error_message: str | None
    metadata: dict[str, Any] | None
    steps: list[TraceStepRead] = Field(default_factory=list)
    tool_calls: list[ToolCallRead] = Field(default_factory=list)


class TraceListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[TraceRead]


class ToolMetric(BaseModel):
    tool: str
    count: int


class DemoGenerateResponse(BaseModel):
    created: int
    total_traces: int


class OpenAISessionCreateRequest(BaseModel):
    api_key: str = Field(min_length=20, max_length=300)


class OpenAISessionStatusResponse(BaseModel):
    connected: bool
    expires_at: datetime | None = None
    key_hint: str | None = None


class OpenAIRunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    model: str | None = None


class OpenAIRunResponse(BaseModel):
    trace_id: UUID
    trace: TraceRead
    response: str | None = None
    status: TraceStatus


def serialize_tool_call(tool_call: ToolCall) -> ToolCallRead:
    return ToolCallRead.model_validate(tool_call)


def serialize_step(step: TraceStep) -> TraceStepRead:
    return TraceStepRead(
        id=step.id,
        trace_id=step.trace_id,
        step_type=step.step_type,
        name=step.name,
        input=step.input,
        output=step.output,
        metadata=step.metadata_,
        started_at=step.started_at,
        ended_at=step.ended_at,
        latency_ms=step.latency_ms,
        input_tokens=step.input_tokens,
        output_tokens=step.output_tokens,
        estimated_cost_usd=step.estimated_cost_usd,
        tool_calls=[serialize_tool_call(tool_call) for tool_call in step.tool_calls],
    )


def serialize_trace(trace: AITrace, include_children: bool = True) -> TraceRead:
    return TraceRead(
        id=trace.id,
        app_name=trace.app_name,
        session_id=trace.session_id,
        user_id=trace.user_id,
        operation=trace.operation,
        model=trace.model,
        provider=trace.provider,
        status=trace.status,
        started_at=trace.started_at,
        ended_at=trace.ended_at,
        latency_ms=trace.latency_ms,
        input_tokens=trace.input_tokens,
        output_tokens=trace.output_tokens,
        total_tokens=trace.total_tokens,
        estimated_cost_usd=trace.estimated_cost_usd,
        error_message=trace.error_message,
        metadata=trace.metadata_,
        steps=[serialize_step(step) for step in trace.steps] if include_children else [],
        tool_calls=[serialize_tool_call(tool_call) for tool_call in trace.tool_calls] if include_children else [],
    )


def create_trace_record(db: Session, payload: TraceCreate) -> AITrace:
    started_at = payload.started_at or utcnow()
    ended_at = payload.ended_at or (started_at + timedelta(milliseconds=payload.latency_ms or 0))
    latency_ms = payload.latency_ms if payload.latency_ms is not None else max(0, int((ended_at - started_at).total_seconds() * 1000))
    total_tokens = payload.input_tokens + payload.output_tokens
    estimated_cost = payload.estimated_cost_usd or estimate_cost(payload.model, payload.input_tokens, payload.output_tokens)

    trace = AITrace(
        app_name=payload.app_name,
        session_id=payload.session_id,
        user_id=payload.user_id,
        operation=payload.operation,
        model=payload.model,
        provider=payload.provider,
        status=payload.status,
        started_at=started_at,
        ended_at=ended_at,
        latency_ms=latency_ms,
        input_tokens=payload.input_tokens,
        output_tokens=payload.output_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=estimated_cost,
        error_message=payload.error_message,
        metadata_=payload.metadata,
    )
    db.add(trace)
    db.flush()

    for step_payload in payload.steps:
        step_started_at = step_payload.started_at or started_at
        step_ended_at = step_payload.ended_at
        step_cost = step_payload.estimated_cost_usd
        if step_cost is None and (step_payload.input_tokens or step_payload.output_tokens):
            step_cost = estimate_cost(payload.model, step_payload.input_tokens or 0, step_payload.output_tokens or 0)
        step = TraceStep(
            trace_id=trace.id,
            step_type=step_payload.step_type,
            name=step_payload.name,
            input=step_payload.input,
            output=step_payload.output,
            metadata_=step_payload.metadata,
            started_at=step_started_at,
            ended_at=step_ended_at,
            latency_ms=step_payload.latency_ms,
            input_tokens=step_payload.input_tokens,
            output_tokens=step_payload.output_tokens,
            estimated_cost_usd=step_cost,
        )
        db.add(step)
        db.flush()
        for tool_payload in step_payload.tool_calls:
            db.add(
                ToolCall(
                    trace_id=trace.id,
                    step_id=step.id,
                    tool_name=tool_payload.tool_name,
                    input=tool_payload.input,
                    output=tool_payload.output,
                    status=tool_payload.status,
                    latency_ms=tool_payload.latency_ms,
                    error_message=tool_payload.error_message,
                    created_at=tool_payload.created_at or step_started_at,
                )
            )
    db.commit()
    db.refresh(trace)
    return trace


OPENAI_SESSION_COOKIE = "ai_openai_session"
OPENAI_SESSION_COOKIE_PATH = "/api/openai"
OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"


def openai_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def validate_json_request(request: Request) -> None:
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type != "application/json":
        raise openai_error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "json_required", "Send this request as application/json.")


def validate_mutating_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed = set(settings.allowed_origins)
    if "*" in allowed:
        raise openai_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "cors_misconfigured", "Credentialed OpenAI routes require explicit CORS origins.")
    if not origin:
        if settings.is_development:
            return
        raise openai_error(status.HTTP_403_FORBIDDEN, "origin_required", "Origin header is required for this credentialed request.")
    if origin.rstrip("/") not in allowed:
        raise openai_error(status.HTTP_403_FORBIDDEN, "origin_not_allowed", "This frontend origin is not allowed for OpenAI sessions.")


def ensure_openai_session_configured() -> None:
    if not settings.openai_session_hash_secret or len(settings.openai_session_hash_secret) < 32:
        raise openai_error(status.HTTP_503_SERVICE_UNAVAILABLE, "session_secret_missing", "OpenAI web sessions are not configured on this backend.")
    try:
        get_fernet()
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise openai_error(status.HTTP_503_SERVICE_UNAVAILABLE, "encryption_key_invalid", "OpenAI web session encryption is not configured correctly.") from exc


@lru_cache
def get_fernet() -> MultiFernet:
    keys = [key.strip() for key in (settings.openai_session_encryption_key or "").split(",") if key.strip()]
    if not keys:
        raise openai_error(status.HTTP_503_SERVICE_UNAVAILABLE, "encryption_key_missing", "OpenAI web session encryption is not configured.")
    fernets = [Fernet(key.encode("utf-8")) for key in keys]
    return MultiFernet(fernets)


def encrypt_api_key(api_key: str) -> str:
    ensure_openai_session_configured()
    return get_fernet().encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted_api_key: str) -> str:
    ensure_openai_session_configured()
    try:
        return get_fernet().decrypt(encrypted_api_key.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise openai_error(status.HTTP_503_SERVICE_UNAVAILABLE, "session_decrypt_failed", "Stored OpenAI session could not be decrypted; reconnect your key.") from exc


def hash_session_id(raw_session_id: str) -> str:
    ensure_openai_session_configured()
    return hashlib.sha256(f"{raw_session_id}:{settings.openai_session_hash_secret}".encode("utf-8")).hexdigest()


def validate_openai_key_shape(api_key: str) -> str:
    key = api_key.strip()
    if not key or len(key) < 20 or len(key) > 300:
        raise openai_error(status.HTTP_400_BAD_REQUEST, "invalid_api_key", "Enter a plausible OpenAI API key.")
    if not (key.startswith("sk-") or key.startswith("sk-proj-")):
        raise openai_error(status.HTTP_400_BAD_REQUEST, "invalid_api_key", "OpenAI API keys usually start with sk- or sk-proj-.")
    if any(ch.isspace() for ch in key):
        raise openai_error(status.HTTP_400_BAD_REQUEST, "invalid_api_key", "The API key cannot contain whitespace.")
    return key


def key_hint(api_key: str) -> str:
    return f"{api_key[:7]}…{api_key[-4:]}"


def cleanup_expired_openai_sessions(db: Session) -> None:
    db.execute(delete(OpenAISession).where(OpenAISession.expires_at <= utcnow()))
    db.commit()


def set_openai_cookie(response: Response, raw_session_id: str) -> None:
    response.set_cookie(
        OPENAI_SESSION_COOKIE,
        raw_session_id,
        max_age=int(settings.openai_ttl.total_seconds()),
        httponly=True,
        secure=settings.openai_cookie_secure,
        samesite=settings.openai_cookie_samesite,
        path=OPENAI_SESSION_COOKIE_PATH,
    )


def clear_openai_cookie(response: Response) -> None:
    response.delete_cookie(
        OPENAI_SESSION_COOKIE,
        path=OPENAI_SESSION_COOKIE_PATH,
        secure=settings.openai_cookie_secure,
        samesite=settings.openai_cookie_samesite,
        httponly=True,
    )


def get_current_openai_session(db: Session, raw_session_id: str | None, *, delete_expired: bool = True) -> OpenAISession | None:
    if not raw_session_id:
        return None
    session_row = db.get(OpenAISession, hash_session_id(raw_session_id))
    if session_row is None or session_row.revoked_at is not None:
        return None
    if session_row.expires_at <= utcnow():
        if delete_expired:
            db.delete(session_row)
            db.commit()
        return None
    return session_row


def normalize_openai_model(model: str | None) -> str:
    selected = (model or settings.openai_default_model).strip()
    allowed = settings.openai_allowed_model_list
    if selected not in allowed:
        raise openai_error(status.HTTP_400_BAD_REQUEST, "invalid_model", f"Choose one of: {', '.join(allowed)}.")
    return selected


def sanitize_provider_error(status_code: int | None, body: str | None = None) -> tuple[str, str]:
    text = (body or "").lower()
    if status_code == 401:
        return "openai_auth_failed", "OpenAI rejected the API key. Reconnect with a valid key."
    if status_code == 429:
        if "quota" in text or "insufficient_quota" in text:
            return "openai_quota_exceeded", "OpenAI reported insufficient quota for this key."
        return "openai_rate_limited", "OpenAI rate limited this request. Try again later."
    if status_code and 400 <= status_code < 500:
        return "openai_request_failed", "OpenAI rejected the request. Check the model and prompt."
    return "openai_unavailable", "OpenAI did not complete the request. Try again later."


async def call_openai_chat_completion(api_key: str, prompt: str, model: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        response = await client.post(
            OPENAI_CHAT_COMPLETIONS_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2},
        )
    if response.status_code >= 400:
        code, message = sanitize_provider_error(response.status_code, response.text[:1000])
        raise openai_error(status.HTTP_502_BAD_GATEWAY, code, message)
    return response.json()


def extract_openai_response_text(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if choices and isinstance(choices[0], dict):
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content
    return ""


def create_web_openai_trace(
    db: Session,
    session_row: OpenAISession,
    prompt: str,
    model: str,
    started_at: datetime,
    response_text: str | None,
    provider_data: dict[str, Any] | None,
    error_message: str | None,
) -> AITrace:
    ended_at = utcnow()
    usage = provider_data.get("usage", {}) if provider_data else {}
    input_tokens = int(usage.get("prompt_tokens") or 0)
    output_tokens = int(usage.get("completion_tokens") or 0)
    trace_status: TraceStatus = "error" if error_message else "success"
    latency_ms = max(0, int((ended_at - started_at).total_seconds() * 1000))
    safe_session_id = f"web_openai_{session_row.session_id_hash[:12]}"
    steps = [
        TraceStepCreate(step_type="user_message", name="Browser prompt", input=prompt, started_at=started_at, ended_at=started_at, latency_ms=0),
        TraceStepCreate(
            step_type="llm_call",
            name="OpenAI chat completion",
            input=prompt,
            output=response_text if response_text else None,
            metadata={"openai_response_id": provider_data.get("id") if provider_data else None, "source": "web_openai_session"},
            started_at=started_at,
            ended_at=ended_at,
            latency_ms=latency_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        ),
    ]
    if error_message:
        steps.append(TraceStepCreate(step_type="error", name="OpenAI run failed", output=error_message, started_at=ended_at, ended_at=ended_at, latency_ms=0))
    else:
        steps.append(TraceStepCreate(step_type="final_response", name="Final response", output=response_text, started_at=ended_at, ended_at=ended_at, latency_ms=0))
    return create_trace_record(
        db,
        TraceCreate(
            app_name="web-openai-runner",
            session_id=safe_session_id,
            operation="web_openai_prompt",
            model=model,
            provider="openai",
            status=trace_status,
            started_at=started_at,
            ended_at=ended_at,
            latency_ms=latency_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            error_message=error_message,
            metadata={
                "source": "web_openai_session",
                "key_hint": session_row.key_hint,
                "privacy_notice": "Prompt and response are stored as traces visible anywhere this dashboard/API is visible.",
            },
            steps=steps,
        ),
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="AI Agent Observability API",
    description="Backend API for AI agent traces, metrics and demo observability data.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"service": settings.service_name, "environment": settings.environment, "docs": "/docs"}


@app.post("/api/openai/sessions", response_model=OpenAISessionStatusResponse, tags=["openai"])
def create_openai_session(payload: OpenAISessionCreateRequest, request: Request, response: Response, db: DbSession) -> OpenAISessionStatusResponse:
    validate_json_request(request)
    validate_mutating_origin(request)
    cleanup_expired_openai_sessions(db)
    api_key = validate_openai_key_shape(payload.api_key)
    raw_session_id = secrets.token_urlsafe(48)
    session_hash = hash_session_id(raw_session_id)
    existing_raw_session_id = request.cookies.get(OPENAI_SESSION_COOKIE)
    existing_session = get_current_openai_session(db, existing_raw_session_id) if existing_raw_session_id else None
    if existing_session is not None:
        db.delete(existing_session)
        db.commit()
    now = utcnow()
    expires_at = now + settings.openai_ttl
    session_row = OpenAISession(
        session_id_hash=session_hash,
        encrypted_api_key=encrypt_api_key(api_key),
        key_hint=key_hint(api_key),
        created_at=now,
        expires_at=expires_at,
    )
    db.add(session_row)
    db.commit()
    set_openai_cookie(response, raw_session_id)
    return OpenAISessionStatusResponse(connected=True, expires_at=expires_at, key_hint=session_row.key_hint)


@app.get("/api/openai/session", response_model=OpenAISessionStatusResponse, tags=["openai"])
def get_openai_session_status(
    db: DbSession,
    ai_openai_session: Annotated[str | None, Cookie(alias=OPENAI_SESSION_COOKIE)] = None,
) -> OpenAISessionStatusResponse:
    session_row = get_current_openai_session(db, ai_openai_session)
    if session_row is None:
        return OpenAISessionStatusResponse(connected=False)
    return OpenAISessionStatusResponse(connected=True, expires_at=session_row.expires_at, key_hint=session_row.key_hint)


@app.delete("/api/openai/session", response_model=OpenAISessionStatusResponse, tags=["openai"])
def delete_openai_session(request: Request, response: Response, db: DbSession) -> OpenAISessionStatusResponse:
    validate_mutating_origin(request)
    session_row = get_current_openai_session(db, request.cookies.get(OPENAI_SESSION_COOKIE), delete_expired=False)
    if session_row is not None:
        db.delete(session_row)
        db.commit()
    clear_openai_cookie(response)
    return OpenAISessionStatusResponse(connected=False)


@app.post("/api/openai/runs", response_model=OpenAIRunResponse, tags=["openai"])
async def run_openai_prompt(payload: OpenAIRunRequest, request: Request, db: DbSession) -> OpenAIRunResponse:
    validate_json_request(request)
    validate_mutating_origin(request)
    cleanup_expired_openai_sessions(db)
    prompt = payload.prompt.strip()
    if not prompt:
        raise openai_error(status.HTTP_400_BAD_REQUEST, "invalid_prompt", "Enter a prompt before running OpenAI.")
    model = normalize_openai_model(payload.model)
    session_row = get_current_openai_session(db, request.cookies.get(OPENAI_SESSION_COOKIE))
    if session_row is None:
        raise openai_error(status.HTTP_401_UNAUTHORIZED, "openai_session_required", "Reconnect your OpenAI key before running a prompt.")
    started_at = utcnow()
    api_key = decrypt_api_key(session_row.encrypted_api_key)
    provider_data: dict[str, Any] | None = None
    response_text: str | None = None
    error_message: str | None = None
    try:
        provider_data = await call_openai_chat_completion(api_key, prompt, model)
        response_text = extract_openai_response_text(provider_data)
        if not response_text:
            error_message = "OpenAI returned no text response."
    except httpx.TimeoutException:
        error_message = "OpenAI request timed out after 30 seconds."
    except httpx.RequestError:
        error_message = "Could not reach OpenAI from the backend."
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        error_message = str(detail.get("message") or "OpenAI request failed.")
    session_row.last_used_at = utcnow()
    trace = create_web_openai_trace(db, session_row, prompt, model, started_at, response_text, provider_data, error_message)
    serialized = serialize_trace(trace)
    if error_message:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "openai_run_failed", "message": error_message, "trace_id": str(trace.id), "trace": serialized.model_dump(mode="json")},
        )
    return OpenAIRunResponse(trace_id=trace.id, trace=serialized, response=response_text, status="success")


@app.post("/api/traces", response_model=TraceRead, status_code=status.HTTP_201_CREATED, tags=["traces"])
def create_trace(payload: TraceCreate, db: DbSession, _: IngestAuth) -> TraceRead:
    return serialize_trace(create_trace_record(db, payload))


@app.get("/api/traces", response_model=TraceListResponse, tags=["traces"])
def list_traces(
    db: DbSession,
    app_name: str | None = None,
    model: str | None = None,
    status_: Annotated[str | None, Query(alias="status")] = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TraceListResponse:
    query = select(AITrace)
    count_query = select(func.count()).select_from(AITrace)
    filters = []
    if app_name:
        filters.append(AITrace.app_name == app_name)
    if model:
        filters.append(AITrace.model == model)
    if status_:
        filters.append(AITrace.status == status_)
    if search:
        pattern = f"%{search}%"
        filters.append(AITrace.operation.ilike(pattern) | AITrace.session_id.ilike(pattern))
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = db.scalar(count_query) or 0
    traces = db.scalars(query.order_by(AITrace.started_at.desc()).limit(limit).offset(offset)).unique().all()
    return TraceListResponse(total=total, limit=limit, offset=offset, items=[serialize_trace(trace, include_children=False) for trace in traces])


@app.get("/api/traces/{trace_id}", response_model=TraceRead, tags=["traces"])
def get_trace(trace_id: UUID, db: DbSession) -> TraceRead:
    trace = db.get(AITrace, trace_id)
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    return serialize_trace(trace)


@app.delete("/api/traces/{trace_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["traces"])
def delete_trace(trace_id: UUID, db: DbSession, _: IngestAuth) -> None:
    trace = db.get(AITrace, trace_id)
    if trace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found")
    db.delete(trace)
    db.commit()


@app.get("/api/metrics/overview", tags=["metrics"])
def metrics_overview(db: DbSession) -> dict[str, Any]:
    total_requests = db.scalar(select(func.count()).select_from(AITrace)) or 0
    total_tokens = db.scalar(select(func.coalesce(func.sum(AITrace.total_tokens), 0))) or 0
    total_cost = db.scalar(select(func.coalesce(func.sum(AITrace.estimated_cost_usd), 0))) or Decimal("0")
    avg_latency = db.scalar(select(func.coalesce(func.avg(AITrace.latency_ms), 0))) or 0
    errors = db.scalar(select(func.count()).select_from(AITrace).where(AITrace.status == "error")) or 0
    tool_calls = db.scalar(select(func.count()).select_from(ToolCall)) or 0
    active_apps = db.scalar(select(func.count(func.distinct(AITrace.app_name)))) or 0
    sessions = db.scalar(select(func.count(func.distinct(AITrace.session_id)))) or 0
    return {
        "total_requests": total_requests,
        "total_tokens": int(total_tokens),
        "total_cost": float(total_cost),
        "avg_latency_ms": round(float(avg_latency), 2),
        "error_rate": round((errors / total_requests) * 100, 2) if total_requests else 0,
        "tool_calls": tool_calls,
        "active_apps": active_apps,
        "sessions": sessions,
    }


@app.get("/api/metrics/timeseries", tags=["metrics"])
def metrics_timeseries(db: DbSession) -> list[dict[str, Any]]:
    day = func.date(AITrace.started_at)
    rows = db.execute(
        select(
            day.label("day"),
            func.count(AITrace.id),
            func.coalesce(func.sum(AITrace.total_tokens), 0),
            func.coalesce(func.sum(AITrace.estimated_cost_usd), 0),
            func.coalesce(func.avg(AITrace.latency_ms), 0),
        )
        .group_by(day)
        .order_by(day)
    ).all()
    return [
        {"date": str(row[0]), "requests": row[1], "tokens": int(row[2]), "cost": float(row[3]), "avg_latency_ms": round(float(row[4]), 2)}
        for row in rows
    ]


@app.get("/api/metrics/models", tags=["metrics"])
def metrics_models(db: DbSession) -> list[dict[str, Any]]:
    rows = db.execute(
        select(
            AITrace.model,
            func.count(AITrace.id),
            func.coalesce(func.sum(AITrace.input_tokens), 0),
            func.coalesce(func.sum(AITrace.output_tokens), 0),
            func.coalesce(func.sum(AITrace.total_tokens), 0),
            func.coalesce(func.sum(AITrace.estimated_cost_usd), 0),
            func.coalesce(func.avg(AITrace.latency_ms), 0),
        )
        .group_by(AITrace.model)
        .order_by(func.count(AITrace.id).desc())
    ).all()
    return [
        {
            "model": row[0],
            "requests": row[1],
            "input_tokens": int(row[2]),
            "output_tokens": int(row[3]),
            "total_tokens": int(row[4]),
            "cost": float(row[5]),
            "avg_latency_ms": round(float(row[6]), 2),
        }
        for row in rows
    ]


@app.get("/api/metrics/tools", response_model=list[ToolMetric], tags=["metrics"])
def metrics_tools(db: DbSession) -> list[ToolMetric]:
    rows = db.execute(
        select(ToolCall.tool_name, func.count(ToolCall.id))
        .group_by(ToolCall.tool_name)
        .order_by(func.count(ToolCall.id).desc(), ToolCall.tool_name)
    ).all()
    return [ToolMetric(tool=row[0], count=row[1]) for row in rows]


@app.get("/api/metrics/errors", tags=["metrics"])
def metrics_errors(db: DbSession) -> list[dict[str, Any]]:
    error_type = func.coalesce(AITrace.error_message, "unknown")
    rows = db.execute(
        select(error_type, AITrace.app_name, AITrace.operation, func.count(AITrace.id))
        .where(AITrace.status == "error")
        .group_by(error_type, AITrace.app_name, AITrace.operation)
        .order_by(func.count(AITrace.id).desc())
    ).all()
    return [{"error_type": row[0], "app_name": row[1], "operation": row[2], "count": row[3]} for row in rows]


def demo_trace(index: int) -> TraceCreate:
    apps = [
        ("travel-planning-agent", "plan_trip", ["search_flights", "compare_hotels"]),
        ("code-review-agent", "review_pull_request", ["inspect_diff", "lookup_docs"]),
        ("customer-support-agent", "resolve_ticket", ["search_knowledge_base", "create_ticket_note"]),
    ]
    app_name, operation, tools = random.choice(apps)
    model = random.choice(list(MODEL_PRICING.keys()))
    status_value: TraceStatus = random.choices(["success", "warning", "error"], weights=[78, 14, 8], k=1)[0]
    start = utcnow() - timedelta(days=random.randint(0, 13), hours=random.randint(0, 23), minutes=random.randint(0, 59))
    latency = random.randint(650, 9000)
    input_tokens = random.randint(350, 4200)
    output_tokens = random.randint(120, 1800)
    tool_latency = random.randint(120, 1700)
    tool_name = random.choice(tools)
    error_message = "tool_timeout" if status_value == "error" else None

    return TraceCreate(
        app_name=app_name,
        session_id=f"session-{random.randint(1000, 9999)}",
        user_id=f"demo-user-{random.randint(1, 8)}",
        operation=operation,
        model=model,
        provider="mock",
        status=status_value,
        started_at=start,
        ended_at=start + timedelta(milliseconds=latency),
        latency_ms=latency,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        error_message=error_message,
        metadata={"demo": True, "scenario_index": index},
        steps=[
            TraceStepCreate(step_type="user_message", name="User request", input="User asks the agent to complete a realistic workflow.", started_at=start, latency_ms=30),
            TraceStepCreate(
                step_type="llm_call",
                name="Plan next action",
                input="System and user prompt redacted for demo safety.",
                output="Agent selected the next tool and execution plan.",
                started_at=start + timedelta(milliseconds=80),
                latency_ms=random.randint(400, 1600),
                input_tokens=input_tokens // 2,
                output_tokens=output_tokens // 3,
            ),
            TraceStepCreate(
                step_type="tool_call",
                name=tool_name,
                input=f"Invoke {tool_name} with synthetic parameters.",
                output="Tool returned structured demo data." if status_value != "error" else "Tool failed before returning data.",
                started_at=start + timedelta(milliseconds=1900),
                latency_ms=tool_latency,
                tool_calls=[
                    ToolCallCreate(
                        tool_name=tool_name,
                        input={"query": operation, "demo": True},
                        output={"records": random.randint(2, 7)} if status_value != "error" else None,
                        status="error" if status_value == "error" else "success",
                        latency_ms=tool_latency,
                        error_message=error_message,
                        created_at=start + timedelta(milliseconds=1900),
                    )
                ],
            ),
            TraceStepCreate(
                step_type="final_response" if status_value != "error" else "error",
                name="Final response" if status_value != "error" else "Failure handling",
                output="Agent produced a concise final answer with sourced context." if status_value != "error" else "Agent surfaced a recoverable tool timeout.",
                started_at=start + timedelta(milliseconds=max(2000, latency - 900)),
                latency_ms=random.randint(300, 900),
                input_tokens=input_tokens // 2,
                output_tokens=output_tokens - (output_tokens // 3),
            ),
        ],
    )


@app.post("/api/demo/generate-traces", response_model=DemoGenerateResponse, tags=["demo"])
def generate_demo_traces(db: DbSession, _: IngestAuth, count: Annotated[int, Query(ge=1, le=200)] = 24) -> DemoGenerateResponse:
    return create_demo_traces(db, count)


def create_demo_traces(db: Session, count: int) -> DemoGenerateResponse:
    for index in range(count):
        create_trace_record(db, demo_trace(index))
    total = db.scalar(select(func.count()).select_from(AITrace)) or 0
    return DemoGenerateResponse(created=count, total_traces=total)


@app.post("/api/demo/reset", response_model=DemoGenerateResponse, tags=["demo"])
def reset_demo_data(db: DbSession, _: IngestAuth, count: Annotated[int, Query(ge=1, le=200)] = 24) -> DemoGenerateResponse:
    db.execute(delete(AITrace).where(AITrace.metadata_["demo"].as_boolean() == True))  # noqa: E712
    db.commit()
    return create_demo_traces(db, count)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", settings.port)), reload=True)
