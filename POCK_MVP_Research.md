# POCK — Multi-Channel AI Message Intelligence Platform
## Complete MVP Implementation Research Document
> Based on POC: WhatsApp • Messenger • Slack • Instagram
> March 2026 | Confidential — Internal Use Only

---

## 1. Executive Summary

POCK is a channel-agnostic AI message intelligence engine that aggregates business communications from WhatsApp, Messenger, Instagram, and Slack into a unified platform. The POC has proven the core classification pipeline — messages are received, normalized, embedded via OpenAI, vector-matched, and classified by GPT-4o-mini with hybrid confidence scoring.

This document defines the complete roadmap to evolve the POC into a commercially viable MVP that businesses can self-onboard onto, manage their communications from, and derive real value through AI-driven prioritization and automation.

> **POC ✓** — Core AI classification engine is working across all 4 channels. FastAPI backend, PostgreSQL + pgvector, and Docker setup are production-grade. The NormalizedMessage normalization layer is the right architectural foundation.

> **MVP Goal** — Add multi-tenancy, a business dashboard, team inbox management, OAuth onboarding, and smart AI features on top of the working classification engine — without breaking what already works.

---

## 2. What Your POC Has Built

### 2.1 Architecture Strengths

The following components in the POC are production-ready and should be carried forward into the MVP unchanged:

- Channel-agnostic classification engine (`classification_engine.py`) — receives `NormalizedMessage`, runs the full AI pipeline
- Hybrid confidence scoring — 40% vector similarity + 60% LLM confidence is a solid approach
- pgvector integration — vector similarity search with cosine distance is correctly implemented
- Normalization layer (`NormalizedMessage` schema) — clean abstraction between channel ingestion and AI engine
- Separate ingestion routers per channel — correct separation of concerns
- Duplicate Slack event deduplication — in-memory cache in `slack.py` is a good POC solution
- Background task processing for Slack — `BackgroundTasks` ensures Slack's 3-second response window is met

### 2.2 Current Limitations to Address in MVP

| Limitation | Current State | MVP Solution |
|---|---|---|
| Multi-tenancy | Single business, hardcoded in `.env` | `businesses` table + `business_id` on all records |
| Authentication | None — tokens set manually | Facebook OAuth + JWT auth for dashboard |
| Token management | Manual rotation required | Automated long-lived token refresh |
| Classification labels | 4 hardcoded labels | Per-business configurable labels |
| Dashboard | None — CLI logs only | React/Next.js dashboard for business users |
| Team inbox | None | Shared inbox with assignment + status |
| Auto-reply | None | AI draft reply suggestions |
| Analytics | None | Message volume, response time, label distribution |
| Webhook routing | Global — one business | Route by Page ID / WABA ID to correct business |

---

## 3. MVP Scope & Feature Modules

The MVP is structured into 6 core modules. Each module builds on the existing POC without requiring architectural changes to the classification engine.

---

### Module 1: Multi-Tenancy & Business Onboarding

#### 1a. Database: Multi-Tenant Schema

Add a `businesses` table and `business_id` foreign key to all existing tables. This is the most critical migration from POC to MVP.

```sql
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  facebook_user_id TEXT,
  whatsapp_waba_id TEXT,
  whatsapp_phone_number TEXT,
  instagram_account_id TEXT,
  page_id TEXT,
  slack_team_id TEXT,
  access_token TEXT NOT NULL,  -- encrypted
  token_expires_at TIMESTAMP,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW()
);
```

All existing tables require a `business_id` column:

```sql
ALTER TABLE messages ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE classifications ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE labels ADD COLUMN business_id UUID REFERENCES businesses(id);
```

#### 1b. Facebook OAuth Onboarding Flow

Businesses self-onboard by clicking "Connect with Facebook". The backend handles the OAuth handshake and stores a long-lived access token per business.

1. Business clicks "Connect with Facebook" in the dashboard UI
2. Frontend redirects to Meta's OAuth dialog with required permissions
3. Business logs in with their Facebook admin account and grants permissions
4. Meta redirects back to our callback URL with a short-lived code
5. Backend exchanges code for a short-lived user token (`POST /oauth/access_token`)
6. Backend exchanges short-lived token for a 60-day long-lived token
7. Backend fetches business's connected Pages, WABA IDs, Instagram accounts
8. Backend stores business record with encrypted token and account IDs
9. Backend calls Meta's Subscribed Apps API to subscribe webhooks to their Page/WABA
10. Business sees their channels as "Connected" in the dashboard

#### 1c. Webhook Routing (Critical Change)

Currently all webhook events go to a single handler. In the MVP, incoming webhook events must be routed to the correct business based on the Page ID, WABA ID, or Instagram Account ID in the payload.

> **Pattern**: When a WhatsApp message arrives → extract WABA ID from payload → query `businesses` table WHERE `whatsapp_waba_id = extracted_id` → retrieve business record → tag `NormalizedMessage` with `business_id` → pass to classification engine.

---

### Module 2: Team Shared Inbox

This is the primary UI feature that businesses interact with daily. Unlike Kinso (which is personal), POCK targets business teams with shared ownership of conversations.

#### 2a. Database: Team & Conversation Tables

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'agent',  -- 'admin' | 'agent' | 'viewer'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  contact_id UUID REFERENCES contacts(id),
  source TEXT,  -- 'whatsapp' | 'slack' | 'instagram' | 'messenger'
  status TEXT DEFAULT 'open',  -- 'open' | 'pending' | 'resolved'
  assigned_to UUID REFERENCES team_members(id),
  priority TEXT,  -- 'high' | 'medium' | 'low'
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  author_id UUID REFERENCES team_members(id),
  note_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2b. Inbox Features to Build

- Conversation list view — sorted by AI priority score (`final_confidence`), filterable by status/channel/label
- Assign conversation to team member — dropdown in conversation view
- Status management — Open / Pending / Resolved toggle buttons
- Internal notes — @mention team members, not visible to customer
- SLA timer — show how long a conversation has been waiting for a reply
- Bulk actions — mark multiple conversations as resolved, reassign in bulk

---

### Module 3: Contact Intelligence (CRM Lite)

Each sender across all channels should resolve to a unified contact profile. This is a major differentiator vs managing per-channel sender IDs.

#### 3a. Database: Contacts & Contact Channels

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  display_name TEXT,
  email TEXT,
  phone TEXT,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contact_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  channel TEXT,  -- 'whatsapp' | 'instagram' | 'messenger' | 'slack'
  external_id TEXT,  -- platform-specific sender ID
  UNIQUE (channel, external_id)
);
```

#### 3b. Contact Features

- Auto-create contact on first message from new sender
- Cross-channel linking — if same phone appears on WhatsApp and Messenger, merge into one contact
- Contact profile page — full message history across all channels in one timeline
- Manual tagging — add custom tags like "VIP", "Enterprise", "At Risk"
- Contact notes — free-text notes for internal context

---

### Module 4: AI Features (Building on POC Engine)

The POC's classification engine is the core IP. The MVP extends it with additional AI-powered features that directly add business value.

#### 4a. Configurable Labels (Per Business)

The POC hardcodes 4 labels (Hot Lead, Support, Refund, Spam). In the MVP, each business should define their own label set from the dashboard.

Implementation: when a business creates a label, generate its embedding immediately and store it with the `business_id`. The classification engine queries only that business's labels.

#### 4b. AI Draft Reply Suggestions

After classification, generate a draft reply that matches the business's tone. This is the highest-value AI feature for driving daily engagement.

> **Prompt Strategy**: Feed the classification result, the full conversation history (last 5 messages), and any available contact context into GPT-4o-mini. Instruct it to draft a reply in a professional but conversational tone. Store the draft alongside the classification result. The agent can accept, edit, or discard it.

#### 4c. Priority Scoring

Extend the existing `final_confidence` score into a `priority_score` that considers:

- Classification label weight (Hot Lead = highest, Spam = lowest)
- Time since message arrived (older unread = escalated priority)
- Contact tier (VIP contacts get boosted priority)
- Sentiment negativity (negative sentiment = higher urgency)

#### 4d. Daily Briefing (Async Job)

Each morning, generate a briefing for each business using GPT-4o-mini: unresolved conversations by priority, new leads received yesterday, team performance stats. Deliver via email or in-app notification.

#### 4e. Universal Semantic Search

Allow business users to search across all conversations using natural language (not just keywords).

Implementation: embed the search query and run a vector similarity search across the `messages` table filtered by `business_id`. Return top matching messages with their conversation context.

---

### Module 5: Automation & Workflows

Automation is where businesses save significant time and where the product becomes sticky.

#### 5a. Database: Automation Rules

```sql
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL,
  trigger_label TEXT,       -- e.g. 'Hot Lead'
  trigger_channel TEXT,     -- optional: only trigger on specific channel
  action_type TEXT,         -- 'auto_reply' | 'assign_to' | 'set_priority' | 'add_tag' | 'notify_team'
  action_config JSONB,      -- flexible config per action type
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 5b. Automation Actions to Support

- **Auto-reply** — send a templated message back to the sender when a specific label is detected
- **Auto-assign** — assign conversations with label "Hot Lead" to the sales team member
- **Auto-tag** — add a tag to the contact when classified as a specific label
- **Priority escalation** — mark conversations as "High Priority" based on label + time
- **Team notification** — send a Slack or email alert when a critical classification is made
- **Out-of-hours responder** — if message arrives outside business hours, auto-reply with availability

---

### Module 6: Analytics Dashboard

Analytics close the loop for business owners — they can see ROI and team performance at a glance.

#### 6a. Key Metrics to Track

| Metric | Description | Data Source |
|---|---|---|
| Message Volume | Total messages by channel, by day/week/month | `messages` table |
| Label Distribution | % of messages per classification label | `classifications` table |
| Avg Response Time | Time between message arrival and first agent reply | `messages` + `conversations` |
| Resolution Rate | % of conversations resolved within SLA target | `conversations` table |
| AI Confidence Avg | Average `final_confidence` score over time | `classifications` table |
| Top Contacts | Contacts who message most frequently | `contact_channels` + `messages` |
| Team Performance | Messages handled per agent, avg resolution time | `conversations` + `team_members` |
| Channel Comparison | Which channel has most volume, best leads | `messages` grouped by `source` |

---

## 4. MVP Technical Architecture

### 4.1 Full System Architecture

```
WhatsApp / Messenger / Instagram / Slack
         ↓
    Meta Webhooks / Slack Events API
         ↓
    Ingestion Layer (existing routers, extended with business routing)
         ↓
    Normalization Layer (NormalizedMessage + business_id)
         ↓
    Message Queue (Redis + Celery)  [NEW]
         ↓
    Classification Engine (unchanged POC engine)
         ↓
    PostgreSQL + pgvector (multi-tenant)
         ↓
    REST API (FastAPI extended) ↔ React Dashboard
         ↓
    Background Jobs: Briefing, Token Refresh, SLA Timers
```

### 4.2 New Backend Components

#### Message Queue (Redis + Celery)

The POC uses `BackgroundTasks` (in-memory) for async processing. For the MVP with multiple businesses and higher message volume, replace this with Celery + Redis as the broker. Handles async classification, briefing generation, and auto-reply sending without blocking webhook responses.

#### JWT Authentication

Add JWT-based authentication for the dashboard API. Team members log in with email/password. The JWT contains their `team_member_id` and `business_id`, which scopes all database queries to the correct business.

```
POST /auth/register    → create team_member record, return JWT
POST /auth/login       → verify credentials, return JWT
GET  /auth/me          → return current team_member from JWT
```

#### Token Encryption

Business access tokens stored in the database must be encrypted at rest. Use Python's `cryptography` library (Fernet symmetric encryption) with the encryption key stored as an environment variable. Never store plaintext tokens.

```python
from cryptography.fernet import Fernet

def encrypt_token(token: str) -> str:
    f = Fernet(settings.ENCRYPTION_KEY)
    return f.encrypt(token.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    f = Fernet(settings.ENCRYPTION_KEY)
    return f.decrypt(encrypted.encode()).decode()
```

### 4.3 Frontend: Dashboard

Recommended stack: **Next.js + Tailwind CSS**

| Dashboard Page | Key Components |
|---|---|
| Login / Onboarding | Email/password login, "Connect with Facebook" OAuth button, channel connection status |
| Inbox (Main View) | Conversation list with AI label badges, priority indicators, channel icons, assignment status |
| Conversation Detail | Full message thread, AI classification result, draft reply panel, internal notes, contact sidebar |
| Contacts | Contact list with search, contact profile page with cross-channel history |
| Automation | Rule builder UI: if label X on channel Y → do action Z |
| Analytics | Charts for message volume, label distribution, team performance, response times |
| Settings | Label configuration, team member management, channel connections, billing |

### 4.4 Updated Project Structure

```
pock/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py                    # extend with new tables
│   ├── schemas.py
│   │
│   ├── ingestion/                   # existing — extend with business routing
│   │   ├── whatsapp.py
│   │   ├── slack.py
│   │   ├── instagram.py
│   │   └── messenger.py
│   │
│   ├── core/                        # existing — unchanged
│   │   ├── classification_engine.py
│   │   ├── llm_service.py
│   │   ├── vector_service.py
│   │   └── embedding_service.py
│   │
│   ├── api/                         # NEW — REST API for dashboard
│   │   ├── auth.py
│   │   ├── businesses.py
│   │   ├── conversations.py
│   │   ├── contacts.py
│   │   ├── labels.py
│   │   ├── automation.py
│   │   └── analytics.py
│   │
│   ├── services/                    # NEW — business logic layer
│   │   ├── oauth_service.py         # Facebook OAuth token exchange
│   │   ├── token_service.py         # encryption + refresh
│   │   ├── reply_service.py         # AI draft reply generation
│   │   ├── briefing_service.py      # daily briefing generation
│   │   └── search_service.py        # semantic search
│   │
│   ├── workers/                     # NEW — Celery tasks
│   │   ├── celery_app.py
│   │   ├── classification_task.py
│   │   ├── briefing_task.py
│   │   └── token_refresh_task.py
│   │
│   └── utils/
│       └── normalization.py         # existing — unchanged
│
├── frontend/                        # NEW — Next.js dashboard
│   ├── pages/
│   ├── components/
│   └── ...
│
├── requirements.txt                 # extend with new packages
├── docker-compose.yml               # extend with Redis + Celery
└── .env.example
```

### 4.5 Extended requirements.txt

```
# Existing
fastapi
uvicorn
sqlalchemy
psycopg2-binary
pgvector
openai
python-dotenv
pydantic
pydantic-settings
requests

# New for MVP
celery[redis]
redis
cryptography
python-jose[cryptography]    # JWT
passlib[bcrypt]              # password hashing
httpx                        # async HTTP client for Meta API calls
alembic                      # database migrations
```

### 4.6 Extended docker-compose.yml

```yaml
services:
  db:
    image: ankane/pgvector:latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: aileadspoc
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  worker:
    build: .
    command: celery -A app.workers.celery_app worker --loglevel=info
    depends_on:
      - db
      - redis
    env_file: .env

  beat:
    build: .
    command: celery -A app.workers.celery_app beat --loglevel=info
    depends_on:
      - redis
    env_file: .env

volumes:
  postgres_data:
```

### 4.7 Extended .env.example

```env
# Existing
DATABASE_URL=postgresql://postgres:password@localhost:5432/aileadspoc
OPENAI_API_KEY=your_openai_api_key_here
WHATSAPP_VERIFY_TOKEN=your_whatsapp_verify_token_here
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token_here

# New for MVP
REDIS_URL=redis://localhost:6379/0
ENCRYPTION_KEY=your_fernet_key_here         # generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
JWT_SECRET_KEY=your_jwt_secret_here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080                    # 7 days

# Meta OAuth
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/facebook/callback
```

---

## 5. Implementation Roadmap

### Phase 1 — Foundation (4–6 weeks)
*Multi-tenancy, OAuth onboarding, basic dashboard*

- [ ] Add `businesses`, `team_members`, `conversations`, `contacts`, `contact_channels` tables
- [ ] Add `business_id` foreign keys to `messages`, `classifications`, `labels`
- [ ] Set up Alembic for database migrations
- [ ] Build Facebook OAuth callback endpoint (`/auth/facebook/callback`)
- [ ] Implement token exchange: short-lived → long-lived Meta token
- [ ] Implement token encryption (Fernet) for stored access tokens
- [ ] Implement webhook routing — extract Page ID/WABA ID from payload → look up business record
- [ ] Build JWT auth endpoints: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- [ ] Add Redis to docker-compose and replace Slack in-memory dedup cache with Redis
- [ ] Set up Celery worker and move classification to async Celery task
- [ ] Scaffold Next.js dashboard with login page and basic inbox view

### Phase 2 — Core Product (3–4 weeks)
*Inbox, contacts, AI draft replies*

- [ ] Build shared inbox API: `GET /conversations`, `PATCH /conversations/{id}`
- [ ] Build conversation assignment and status management endpoints
- [ ] Build internal notes API: `POST /conversations/{id}/notes`
- [ ] Build contact management API: `GET/POST /contacts`, `GET /contacts/{id}/history`
- [ ] Per-business configurable labels — label CRUD API + re-embed on save
- [ ] Implement AI draft reply generation in `reply_service.py`
- [ ] Surface draft reply in classification result and expose via API
- [ ] Build basic analytics API: message volume, label distribution
- [ ] Connect Next.js inbox view to real API data

### Phase 3 — Automation & Advanced AI (3–4 weeks)
*Workflows, semantic search, briefings*

- [ ] Build automation rule engine — evaluate rules after each classification in the Celery task
- [ ] Implement `auto_reply` action — send message back via Meta Graph API / Slack API
- [ ] Implement `assign_to`, `add_tag`, `set_priority`, `notify_team` actions
- [ ] Implement priority scoring system incorporating label weight, time, and contact tier
- [ ] Implement daily briefing Celery Beat task (runs at 7am per business timezone)
- [ ] Build semantic search endpoint: `GET /search?q=...` using pgvector on messages table
- [ ] Build automation rule builder UI in the dashboard
- [ ] Complete analytics dashboard with charts

### Phase 4 — Production Readiness & Meta App Review (4–6 weeks)
*Deploy, secure, and get Meta approved*

- [ ] Deploy backend to cloud (AWS / GCP / Render / Railway) with HTTPS
- [ ] Set up automated token refresh for expiring Meta access tokens (60-day cycle)
- [ ] Write Privacy Policy and publish at a public URL
- [ ] Write Terms of Service and publish at a public URL
- [ ] Add data deletion instructions page (required by Meta)
- [ ] Link Meta App to a real Business Manager account
- [ ] Record screen recordings for each Meta permission (1080p MP4)
- [ ] Write permission justification text for each permission
- [ ] Submit all permissions for Meta App Review
- [ ] Add rate limiting and request validation (slowapi)
- [ ] Set up error monitoring (Sentry) and metrics (Prometheus)
- [ ] Load testing and performance optimization

---

## 6. Meta App Review — What You Need

> ⚠️ **Timeline Warning**: Meta App Review for WhatsApp Business API typically takes 10–20 business days and may require multiple rounds. Start preparation early — do not wait until the MVP is fully built.

### 6.1 Permissions Required

| Permission | Platform | Purpose |
|---|---|---|
| `whatsapp_business_messaging` | WhatsApp | Receive and send WhatsApp messages |
| `whatsapp_business_management` | WhatsApp | Manage WABA accounts and phone numbers |
| `instagram_manage_messages` | Instagram | Read Instagram DMs for business accounts |
| `instagram_basic` | Instagram | Read basic Instagram account profile info |
| `pages_messaging` | Messenger | Receive and send Facebook Page messages |
| `pages_read_engagement` | Messenger | Read Page message and engagement data |
| `pages_manage_metadata` | Messenger | Subscribe webhooks to Facebook Pages |
| `business_management` | All (OAuth) | Access business assets via Facebook Login |

### 6.2 Preparation Checklist

1. **Production server** — deploy to a real domain with HTTPS (not ngrok)
2. **Privacy Policy** — published at a public URL, covering WhatsApp/Instagram data handling
3. **Terms of Service** — published at a public URL
4. **App icon and description** — professional, no "test" or "poc" in the name
5. **Data deletion instructions** — a page explaining how users can request data deletion
6. **Meta Business Manager account** — app must be linked to a real business
7. **Screen recordings** — one per permission showing the feature in action (1080p, MP4, English)
8. **Permission justifications** — written explanation for each permission

### 6.3 Screen Recording Template

For each permission, record:
1. Customer sends a message on that channel
2. Webhook fires and message appears in your dashboard
3. AI classification is shown
4. The specific permission being used is clearly demonstrated

**Permission justification template:**
> "Our app POCK is an AI lead classification tool for businesses. When a business customer onboards, they connect their [WhatsApp/Instagram/Facebook Page] via Facebook Login. The permission `[permission_name]` is used to receive messages from their customers. These messages are analyzed by our AI system to classify them into categories (Hot Lead, Support, Refund, Spam) so the business can prioritize responses. We do not use this data for advertising or share it with third parties."

---

## 7. Complete Tech Stack

| Layer | Technology | Status |
|---|---|---|
| API Framework | Python / FastAPI | ✅ Existing POC |
| Database | PostgreSQL + pgvector | ✅ Existing POC |
| ORM | SQLAlchemy | ✅ Existing POC |
| Migrations | Alembic | 🔨 Build in Phase 1 |
| AI — Embeddings | OpenAI text-embedding-3-small | ✅ Existing POC |
| AI — Classification | GPT-4o-mini | ✅ Existing POC |
| AI — Draft Replies | GPT-4o-mini (new prompt) | 🔨 Build in Phase 2 |
| Task Queue | Celery + Redis | 🔨 Build in Phase 1 |
| Authentication | JWT (python-jose) | 🔨 Build in Phase 1 |
| Token Encryption | Python cryptography (Fernet) | 🔨 Build in Phase 1 |
| Frontend | Next.js + Tailwind CSS | 🔨 Build in Phase 1–2 |
| Frontend State | React Query + Zustand | 🔨 Build in Phase 1–2 |
| Containerization | Docker + Docker Compose | ✅ Existing POC |
| Cloud Hosting | AWS / GCP / Render | 🔨 Phase 4 |
| Monitoring | Sentry + Prometheus | 🔨 Phase 4 |

---

## 8. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Meta App Review rejection | High — blocks real users | Start submission early; prepare thorough recordings and justifications |
| Access token expiry | Medium — breaks live integrations | Implement automated refresh before 60-day expiry; alert on failure |
| OpenAI API costs at scale | Medium — margin pressure | Cache embeddings for repeated messages; batch low-priority classifications |
| Classification accuracy | Medium — user trust | Allow business admins to add custom labels and correction feedback |
| Slack deduplication at scale | Low-Medium — duplicate processing | Migrate from in-memory set to Redis-backed deduplication in Phase 1 |
| Multi-tenant data isolation | High — compliance risk | Enforce `business_id` on every DB query; add row-level security in PostgreSQL |

---

## 9. Immediate Next Steps

These are the actions to take in the next 2 weeks to kick off MVP development:

1. **Run database migrations** — add `businesses`, `team_members`, `conversations`, `contacts` tables and `business_id` foreign keys to existing tables
2. **Set up Redis locally** — add to `docker-compose.yml` and integrate Celery for async classification
3. **Build OAuth callback endpoint** — `/auth/facebook/callback` that exchanges code for long-lived token
4. **Implement webhook routing** — extract Page ID/WABA ID from each incoming payload and look up the correct business record
5. **Scaffold the Next.js dashboard** — login page + basic inbox view reading from the API
6. **Begin Meta App Review preparation** — register domain, write Privacy Policy, start recording screen captures

---

*POCK MVP Research Document | github.com/SaiSriSushanth/POCK | March 2026*
