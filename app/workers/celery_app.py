import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "pock",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.workers.classification_task",
        "app.workers.briefing_task",
        "app.workers.token_refresh_task",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "daily-briefing": {
        "task": "send_daily_briefing",
        "schedule": crontab(hour=8, minute=0),  # 8am daily
    },
    "refresh-meta-tokens": {
        "task": "refresh_meta_tokens",
        "schedule": crontab(hour=9, minute=0),  # 9am daily
    },
}
