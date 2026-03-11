Perfect. Below is a **clean, production-structured, multi-channel POC Markdown plan** you can directly give to Gemini CLI.

This version:

* Supports Slack + WhatsApp
* Introduces an ingestion layer
* Keeps classification engine platform-agnostic
* Is architecturally clean
* Is still POC-level (not overengineered)

You can copy-paste this as is.

---

# 📦 Multi-Channel AI Lead Classification POC

## 🎯 Objective

Build a Proof of Concept (POC) system that:

1. Receives messages from:

   * Slack (Events API)
   * WhatsApp (Meta Cloud API webhook)
2. Normalizes messages into a common internal format
3. Classifies messages using:

   * OpenAI embeddings (vector similarity)
   * LLM reasoning (GPT-4o-mini)
4. Stores classification results in PostgreSQL
5. Logs predicted label and confidence

No dashboard required.

---

# 🏗 High-Level Architecture

```
Slack Events API        Meta WhatsApp Webhook
        ↓                          ↓
   /slack/events            /meta/webhook
        ↓                          ↓
      Adapter Layer (Normalization)
                     ↓
        Unified Classification Engine
                     ↓
            PostgreSQL + pgvector
```

---

# 🛠 Tech Stack

## Backend

* Python 3.11+
* FastAPI
* SQLAlchemy
* PostgreSQL
* pgvector

## AI

* OpenAI Embeddings (text-embedding-3-small)
* GPT-4o-mini

## Dev

* Docker
* ngrok (local webhook exposure)

---

# 📁 Project Structure

```
ai-multichannel-poc/
│
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   │
│   ├── ingestion/
│   │   ├── slack.py
│   │   └── whatsapp.py
│   │
│   ├── core/
│   │   ├── classification_engine.py
│   │   ├── embedding_service.py
│   │   ├── vector_service.py
│   │   └── llm_service.py
│   │
│   └── utils/
│       └── normalization.py
│
├── requirements.txt
└── docker-compose.yml
```

---

# 🧠 Core Design Principle

The classification engine must NOT depend on:

* Slack
* WhatsApp
* Any specific platform

All platforms must normalize data into a common format.

---

# 📨 Unified Message Schema

Create an internal model:

```python
class NormalizedMessage:
    source: str           # "slack" | "whatsapp"
    sender_id: str
    text: str
    timestamp: datetime
```

Slack and WhatsApp ingestion layers must convert payloads into this structure.

---

# 🗄 Database Schema

Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Table: labels

```sql
CREATE TABLE labels (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    embedding VECTOR(1536),
    embedding_model TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Table: messages

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    source TEXT,
    sender_id TEXT,
    message_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Table: classifications

```sql
CREATE TABLE classifications (
    id UUID PRIMARY KEY,
    message_id UUID REFERENCES messages(id),
    predicted_label TEXT,
    embedding_score FLOAT,
    llm_confidence FLOAT,
    final_confidence FLOAT,
    reasoning TEXT,
    model_version TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 🧠 Classification Pipeline

## Step 1 — Store Incoming Message

When Slack or WhatsApp sends message:

* Normalize payload
* Store message in DB

---

## Step 2 — Generate Message Embedding

Use OpenAI:

```
text-embedding-3-small
```

---

## Step 3 — Vector Similarity Search

Query top 3 labels:

```sql
SELECT name,
       embedding <=> :message_embedding AS distance
FROM labels
ORDER BY embedding <=> :message_embedding
LIMIT 3;
```

Convert distance → similarity score.

---

## Step 4 — LLM Reasoning

Send:

* Message text
* Top 3 label names + descriptions

Prompt format:

```
You are a lead classification AI.

Available labels:
1. Label – Description
2. Label – Description
3. Label – Description

Classify the message into exactly one label.

Return strict JSON:
{
  "label": "",
  "confidence": 0-1,
  "reason": ""
}

Message:
"<message_text>"
```

Set:

* temperature = 0
* JSON response mode

---

## Step 5 — Final Confidence

Combine:

```
final_confidence =
(0.4 * embedding_similarity) +
(0.6 * llm_confidence)
```

If < 0.6 → mark for review.

---

## Step 6 — Store Classification

Insert into classifications table.

Log:

```
Source: Slack
Message: "I need refund"
Predicted: Refund
Confidence: 0.91
```

---

# 🔌 Slack Integration Requirements

1. Create Slack App
2. Enable Bot Token
3. Enable Event Subscriptions
4. Subscribe to:

   * message.channels
   * message.im
5. Handle URL verification challenge
6. Extract:

   * event["text"]
   * event["user"]
   * event["channel"]

Send normalized message to classification engine.

---

# 📱 WhatsApp Integration Requirements

1. Setup Meta App
2. Add WhatsApp product
3. Configure webhook
4. Handle GET verification
5. Extract:

   * entry[0].changes[0].value.messages[0].text.body
   * sender number

Normalize and send to classification engine.

---

# 🚀 Execution Plan

## Phase 1

* Setup database
* Implement labels + embeddings
* Implement classification engine

## Phase 2

* Implement Slack ingestion
* Test end-to-end via Slack

## Phase 3

* Implement WhatsApp ingestion
* Test via ngrok

---

# 🧪 Testing Messages

Test examples:

* "How much does it cost?" → Hot Lead
* "I'm facing login issue" → Support
* "I want my money back" → Refund
* "Buy crypto now!!!" → Spam

---

# ✅ Success Criteria

POC is successful when:

* Slack messages trigger classification
* WhatsApp messages trigger classification
* Classification engine works identically for both
* Logs show correct predicted labels
* System is platform-agnostic

---

# 🔮 Future Enhancements (Not in POC)

* Async queue workers
* Multi-tenant businesses
* Dashboard UI
* Manual override tracking
* Analytics metrics
* Auto-reply suggestions
* SLA routing

---

# 🧠 Architectural Goal

Build:

> Channel-Agnostic AI Message Intelligence Engine

NOT:

> WhatsApp Bot
> NOT:
> Slack Bot

---

If you want next, I can generate:

* A cleaner “startup-ready” version of this plan
* Or a simplified 1-day MVP version
* Or a more enterprise-grade production version

Tell me which direction you’re taking.
