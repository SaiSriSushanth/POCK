import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from .database import engine, Base, SessionLocal
from .ingestion.whatsapp import router as whatsapp_router
from .ingestion.slack import router as slack_router
from .ingestion.instagram import router as instagram_router
from .ingestion.messenger import router as messenger_router
from .api.auth import router as auth_router
from .api.businesses import router as businesses_router
from .api.conversations import router as conversations_router
from .api.contacts import router as contacts_router
from .api.labels import router as labels_router
from .api.analytics import router as analytics_router
from .api.team import router as team_router
from .api.roles import router as roles_router
from .api.automation import router as automation_router
from .api.search import router as search_router
from .models import Label
from .core.llm_service import get_embedding

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Sentry (optional — only active when SENTRY_DSN is set) ──────────────────
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.2,
    )
    logger.info("Sentry initialized")

# ── pgvector + tables ────────────────────────────────────────────────────────
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

Base.metadata.create_all(bind=engine)

# ── Rate limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="POCK — Multi-Channel AI Message Intelligence")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ingestion webhooks
app.include_router(whatsapp_router)
app.include_router(slack_router)
app.include_router(instagram_router)
app.include_router(messenger_router)

# Dashboard API
app.include_router(auth_router)
app.include_router(businesses_router)
app.include_router(conversations_router)
app.include_router(contacts_router)
app.include_router(labels_router)
app.include_router(analytics_router)
app.include_router(team_router)
app.include_router(roles_router)
app.include_router(automation_router)
app.include_router(search_router)


@app.on_event("startup")
def seed_labels():
    db = SessionLocal()
    try:
        labels_to_seed = [
            {"name": "Hot Lead", "description": "Customer asking about pricing, purchase, or product details."},
            {"name": "Support", "description": "Technical issue, login help, or general assistance request."},
            {"name": "Refund", "description": "Customer requesting a refund, cancellation, or money back."},
            {"name": "Spam", "description": "Irrelevant content, promotional messages, or junk."},
        ]
        for label_data in labels_to_seed:
            existing = db.query(Label).filter(
                Label.name == label_data["name"],
                Label.business_id.is_(None),
            ).first()
            if not existing:
                logger.info(f"Seeding global label: {label_data['name']}")
                embedding = get_embedding(f"{label_data['name']}: {label_data['description']}")
                db.add(Label(
                    name=label_data["name"],
                    description=label_data["description"],
                    embedding=embedding,
                    business_id=None,
                ))
        db.commit()
    except Exception as e:
        logger.error(f"Error seeding labels: {e}")
    finally:
        db.close()


@app.get("/health")
def health_check():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "ok"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(status_code=503, content={"status": "unhealthy", "database": str(e)})
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "POCK API is running", "version": "mvp-phase-3"}
