from fastapi import FastAPI
from .database import engine, Base, SessionLocal
from .ingestion.whatsapp import router as whatsapp_router
from .ingestion.slack import router as slack_router
from .ingestion.instagram import router as instagram_router
from .ingestion.messenger import router as messenger_router
from .models import Label
from .core.llm_service import get_embedding
from sqlalchemy.orm import Session
from sqlalchemy import text
import os

# Create tables and enable pgvector
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Multi-Channel Lead Classification POC")

# Include the new ingestion routers
app.include_router(whatsapp_router)
app.include_router(slack_router)
app.include_router(instagram_router)
app.include_router(messenger_router)

@app.on_event("startup")
def seed_labels():
    db = SessionLocal()
    try:
        labels_to_seed = [
            {"name": "Hot Lead", "description": "Customer asking about pricing, purchase, or product details."},
            {"name": "Support", "description": "Technical issue, login help, or general assistance request."},
            {"name": "Refund", "description": "Customer requesting a refund, cancellation, or money back."},
            {"name": "Spam", "description": "Irrelevant content, promotional messages, or junk."}
        ]

        for label_data in labels_to_seed:
            existing = db.query(Label).filter(Label.name == label_data["name"]).first()
            if not existing:
                print(f"Seeding label: {label_data['name']}...")
                embedding = get_embedding(f"{label_data['name']}: {label_data['description']}")
                db_label = Label(
                    name=label_data["name"],
                    description=label_data["description"],
                    embedding=embedding
                )
                db.add(db_label)
        
        db.commit()
    except Exception as e:
        print(f"Error seeding labels: {e}")
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "Multi-Channel Lead Classification POC API is running"}
