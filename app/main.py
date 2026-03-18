from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from .models import Label
from .core.llm_service import get_embedding
from sqlalchemy import text

# Create tables and enable pgvector extension
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="POCK — Multi-Channel AI Message Intelligence")

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


@app.on_event("startup")
def seed_labels():
    """Seed global default labels (business_id=None) if they don't exist."""
    db = SessionLocal()
    try:
        labels_to_seed = [
            {"name": "Hot Lead", "description": "Customer asking about pricing, purchase, or product details."},
            {"name": "Support", "description": "Technical issue, login help, or general assistance request."},
            {"name": "Refund", "description": "Customer requesting a refund, cancellation, or money back."},
            {"name": "Spam", "description": "Irrelevant content, promotional messages, or junk."}
        ]

        for label_data in labels_to_seed:
            existing = db.query(Label).filter(
                Label.name == label_data["name"],
                Label.business_id.is_(None)
            ).first()
            if not existing:
                print(f"Seeding global label: {label_data['name']}...")
                embedding = get_embedding(f"{label_data['name']}: {label_data['description']}")
                db_label = Label(
                    name=label_data["name"],
                    description=label_data["description"],
                    embedding=embedding,
                    business_id=None,
                )
                db.add(db_label)

        db.commit()
    except Exception as e:
        print(f"Error seeding labels: {e}")
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "POCK API is running", "version": "mvp-phase-2"}
