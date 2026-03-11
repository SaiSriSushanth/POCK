Perfect. Below is a **clean, implementation-ready Markdown plan** you can directly give to Gemini CLI (or any coding agent) to build your WhatsApp AI Lead Classification POC.

You can copy-paste this as is.

---

# 📦 AI WhatsApp Lead Classification POC – Implementation Plan

## 🎯 Objective

Build a Proof of Concept (POC) system that:

1. Receives WhatsApp messages via Meta WhatsApp Cloud API webhook
2. Stores incoming messages
3. Classifies messages into predefined labels using:

   * OpenAI Embeddings (vector similarity)
   * LLM reasoning (hybrid approach)
4. Logs predicted label and confidence

No dashboard required. CLI logs are sufficient.

---

# 🏗 System Architecture

```
Meta WhatsApp Cloud API
        ↓
FastAPI Webhook
        ↓
Store Message (PostgreSQL)
        ↓
Embedding Generation
        ↓
Vector Similarity (pgvector)
        ↓
LLM Classification
        ↓
Store Result
        ↓
Log Output
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

* OpenAI Embeddings API
* GPT-4o-mini (for classification)

## Dev Tools

* Docker
* ngrok (for local webhook testing)

---

# 📁 Project Structure

```
ai-lead-poc/
│
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── services/
│   │   ├── embedding_service.py
│   │   ├── vector_service.py
│   │   ├── classification_service.py
│   │   └── openai_service.py
│   └── webhook.py
│
├── requirements.txt
├── docker-compose.yml
└── README.md
```

---

# 🗄 Database Schema

## Enable pgvector

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
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Table: messages

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    phone TEXT,
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
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 🧠 Classification Logic

## Step 1 – Preload Labels

Hardcode 4 labels for POC:

* Hot Lead – Customer asking about pricing or purchase
* Support – Technical issue or help request
* Refund – Customer requesting refund or cancellation
* Spam – Irrelevant or promotional content

For each label:

* Generate embedding once
* Store in DB

---

## Step 2 – Webhook Endpoint

### GET /webhook

Verify Meta challenge.

### POST /webhook

Extract:

```
entry[0].changes[0].value.messages[0].text.body
```

Store:

* phone
* message_text

Trigger classification pipeline.

---

## Step 3 – Generate Message Embedding

Use OpenAI embedding model:

```
text-embedding-3-small
```

Store embedding temporarily (or optionally in DB).

---

## Step 4 – Vector Similarity Search

Query top 3 closest labels:

```sql
SELECT name,
       embedding <=> :message_embedding AS distance
FROM labels
ORDER BY embedding <=> :message_embedding
LIMIT 3;
```

Convert distance → similarity score.

---

## Step 5 – LLM Reasoning

Send only top 3 labels to GPT-4o-mini.

Prompt format:

```
You are a lead classification AI.

Available labels:
1. Label name – Description
2. Label name – Description
3. Label name – Description

Classify the following message into exactly one label.

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
* response_format = json_object

---

## Step 6 – Final Confidence

Combine:

```
final_confidence =
(0.4 * embedding_similarity) +
(0.6 * llm_confidence)
```

If final_confidence < 0.6:
→ Mark as “Needs Review”

---

## Step 7 – Store Classification

Insert into classifications table.

Log output:

```
Message: "I need a refund"
Predicted: Refund
Confidence: 0.91
Reason: User explicitly requesting money back
```

---

# 🔐 Webhook Requirements

* Must return HTTP 200 immediately
* Use ngrok for local testing
* Validate verify token
* Optional: Validate X-Hub-Signature-256

---

# 🚀 Execution Plan

## Phase 1

* Setup FastAPI
* Setup PostgreSQL
* Setup pgvector
* Create tables

## Phase 2

* Implement label embedding generation
* Implement vector similarity search

## Phase 3

* Implement OpenAI classification
* Implement confidence scoring

## Phase 4

* Connect webhook
* End-to-end testing via WhatsApp

---

# 🧪 Testing Plan

Test with messages like:

* "How much does it cost?" → Hot Lead
* "I am facing login issue" → Support
* "I want my money back" → Refund
* "Buy crypto now!!!" → Spam

Log classification accuracy manually.

---

# 💰 Cost Expectations

For 1,000 messages:

* Embeddings → very low cost
* GPT-4o-mini → low cost
* Total likely under $10–15 for testing

---

# ✅ Success Criteria

POC is successful when:

* WhatsApp message triggers classification
* Correct label is predicted
* Confidence is logged
* No blocking or crashes

---

# 🔮 Future Upgrades (Not in POC)

* Multi-tenant support
* Async queue workers
* Dashboard UI
* Manual override tracking
* Auto-reply suggestions
* SLA priority scoring

---

End of POC Implementation Plan.

---

If you want, I can now also generate:

* A **production-upgrade version** of this markdown
* Or a **cost-optimized version**
* Or a **fully enterprise-grade architecture plan**

Just tell me which direction you're taking.
