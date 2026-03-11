# AI Leads POC — Onboarding & Business Integration Documentation

> **Purpose**: This document captures everything needed to go from the current POC state to a production-ready system where real businesses can onboard, connect their Instagram/WhatsApp accounts, and have their incoming messages automatically classified by the AI engine.
>
> **Keep this doc updated** as decisions are made and steps are completed. It is the single source of truth.

---

## Table of Contents

1. [Current POC State](#1-current-poc-state)
2. [What "Business Onboarding" Means](#2-what-business-onboarding-means)
3. [Prerequisites — What a Business Needs](#3-prerequisites--what-a-business-needs)
4. [Business Onboarding Flow (Target Design)](#4-business-onboarding-flow-target-design)
5. [Meta App Verification — Step-by-Step](#5-meta-app-verification--step-by-step)
6. [Permissions We Need from Meta](#6-permissions-we-need-from-meta)
7. [Production Architecture vs POC](#7-production-architecture-vs-poc)
8. [Open Decisions & Action Items](#8-open-decisions--action-items)

---

## 1. Current POC State

### What Is Built

The AI Leads POC is a multi-channel message ingestion and classification system. When a customer sends a message to a business via Instagram, WhatsApp, Facebook Messenger, or Slack, the system:

1. Receives the message via a Meta webhook
2. Normalizes it to a unified schema
3. Classifies it using a hybrid AI pipeline (vector embeddings + GPT-4o-mini)
4. Stores the result with a confidence score and reasoning
5. Returns an instant 200 OK to Meta (so webhooks don't time out)

**Classification Labels**: Hot Lead, Support, Refund, Spam

### Tech Stack

| Layer | Technology |
|---|---|
| API Server | Python / FastAPI |
| Database | PostgreSQL + pgvector |
| AI Classification | OpenAI (text-embedding-3-small + gpt-4o-mini) |
| Channels | WhatsApp, Instagram DM, Facebook Messenger, Slack |
| Local Tunnel | ngrok (for webhook testing) |
| Infrastructure | Docker Compose |

### Webhook Endpoints (Current)

| Platform | Verification | Messages |
|---|---|---|
| WhatsApp | `GET /meta/webhook` | `POST /meta/webhook` |
| Instagram | `GET /meta/instagram/webhook` | `POST /meta/instagram/webhook` |
| Messenger | `GET /meta/messenger/webhook` | `POST /meta/messenger/webhook` |

### Current Limitations (Dev Mode)

- **Test accounts only**: WhatsApp can only send messages to phone numbers explicitly added as test numbers in the Meta Developer Portal.
- **Instagram / Messenger**: Only accounts added as Test Users in the Meta app can trigger real webhook events.
- **Single-tenant**: The app has one hardcoded set of credentials (one WhatsApp phone number, one Instagram account). It cannot serve multiple businesses simultaneously.
- **No business login**: There is no UI or OAuth flow. Tokens are set manually in `.env`.
- **No token management**: Access tokens do not auto-refresh. They expire and need manual rotation.
- **Meta App is in Development Mode**: Real users/businesses cannot interact with it until the app passes Meta's App Review.

### How to Run the POC Locally

```bash
# 1. Start PostgreSQL with pgvector
docker-compose up -d

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy and fill environment variables
cp .env.example .env
# Fill in: DATABASE_URL, OPENAI_API_KEY, WHATSAPP_VERIFY_TOKEN,
#          INSTAGRAM_ACCESS_TOKEN, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET

# 4. Start the FastAPI server
uvicorn app.main:app --reload --port 8000

# 5. Expose locally via ngrok (for Meta webhooks)
ngrok http 8000

# 6. Set the ngrok HTTPS URL as the webhook URL in Meta Developer Portal
#    e.g., https://abc123.ngrok.io/meta/webhook
```

---

## 2. What "Business Onboarding" Means

In the production version of this app, we want **any business** to be able to sign up and connect their own Instagram / WhatsApp / Facebook Page — without us doing any manual configuration for them.

Here is the high-level vision:

```
Business visits our app
        │
        ▼
Clicks "Connect with Facebook"
        │
        ▼
Facebook Login (OAuth) popup opens
        │
        ▼
Business grants permissions
(their Pages, WhatsApp numbers, Instagram accounts)
        │
        ▼
Our app receives a long-lived access token for that business
        │
        ▼
We subscribe our webhooks to their account
        │
        ▼
Messages from their customers now flow into our system
and get classified automatically
```

This is possible because Meta provides a standard OAuth flow called **"Facebook Login for Business"** (formerly Business Login / SSO). Once a business authenticates, Meta gives us a token scoped to that specific business's assets.

---

## 3. Prerequisites — What a Business Needs

Before a business can onboard into our app, they must have the following on their side:

### For WhatsApp

- A **WhatsApp Business Account (WABA)** registered in Meta Business Manager
- A **phone number** verified and active in that WABA
- Their WABA must be **associated with a Meta Business Manager** (formerly Facebook Business Manager)

### For Instagram

- An **Instagram Professional Account** (Business or Creator type)
- That Instagram account must be **linked to a Facebook Page**
- The Facebook Page must be owned by a **Meta Business Manager** that the user has admin access to

### For Facebook Messenger

- A **Facebook Page** (any type: business, brand, etc.)
- Admin or editor access to that Page via **Meta Business Manager**

### For Our App (Meta Requirements)

- Our Meta App must be **approved (Live mode)** before real businesses can authenticate through it
- Our app must have the correct **permissions approved by Meta** (see Section 6)

---

## 4. Business Onboarding Flow (Target Design)

> **Decision Pending**: We have not yet decided whether to use Facebook Login (OAuth/SSO) or manual token entry as the primary approach. Both are documented below. We recommend **Option A (OAuth)** for production and **Option B (Manual)** as an interim during the POC-to-production transition.

---

### Option A — Facebook Login / OAuth (Recommended for Production)

This is the proper, scalable approach. Businesses self-serve through our UI.

**Step-by-step flow:**

1. **Business visits our app** and clicks "Connect your Meta Accounts"
2. **OAuth popup opens** — Meta's standard Facebook Login dialog
3. **Business logs in** with their Facebook account (the one that has admin access to their Pages/WABA)
4. **Permissions dialog** — Business sees exactly what permissions they're granting (read messages, manage WhatsApp, etc.)
5. **Business clicks Allow**
6. **Meta returns a short-lived User Access Token** to our backend (via OAuth redirect)
7. **We exchange it for a long-lived Page/WABA token** and store it securely per business in our database
8. **We call Meta's Subscribed Apps API** to register our webhooks against their specific Page / WABA / Instagram account
9. **Done** — messages from their customers now arrive at our existing webhook endpoints, tagged with their Page/Account ID so we can route it to the right business

**What we need to build for Option A:**
- Frontend: "Connect with Facebook" button + OAuth redirect handling
- Backend: OAuth callback endpoint, token exchange logic, token storage per business
- Database: `businesses` table (business ID, name, token, connected accounts)
- Meta: App must be approved in Live mode with correct permissions

---

### Option B — Manual Token Entry (Interim / POC Approach)

This is faster to implement but not scalable. Suitable while the Meta App is still in Dev mode.

**Step-by-step flow:**

1. Business provides us their **Page Access Token** (generated from Meta Developer Portal by their admin)
2. We add it manually to our system's configuration or a simple internal admin UI
3. We configure our webhook to listen for their specific Page ID / WABA ID
4. Messages start flowing in

**Limitation**: Every new business requires a manual step from our team. This does not scale and cannot be self-serve.

---

## 5. Meta App Verification — Step-by-Step

> **Context**: Our Meta App is currently in **Development Mode**. This means only test users and test phone numbers added manually by us can interact with it. To allow real businesses to use our app, Meta must review and approve it — this is called **App Review**.

### Phase 1: Prepare the App (Before Submission)

#### 1.1 Complete the App Settings in Meta Developer Portal

Go to [developers.facebook.com](https://developers.facebook.com) → Your App → Settings:

- [ ] **App Icon** — Upload a clear, professional app icon (1024x1024 px)
- [ ] **App Name** — Must be the real product name (not "test" or "poc")
- [ ] **App Description** — Clear description of what the app does and who it's for
- [ ] **Privacy Policy URL** — A publicly accessible privacy policy page (required). Must cover data handling for WhatsApp messages, Instagram DMs, etc.
- [ ] **Terms of Service URL** — Publicly accessible terms of service
- [ ] **App Domain** — The domain where your app is hosted (not localhost, not ngrok)
- [ ] **Data Deletion Callback URL or Instructions** — Required for apps using Facebook Login. Tells Meta how a user can request their data be deleted.

#### 1.2 Set Up a Production Server

The app must be hosted on a real domain (not ngrok or localhost) before submission:

- [ ] Deploy the FastAPI backend to a cloud server (AWS, GCP, Render, Railway, etc.)
- [ ] Set up HTTPS with a valid SSL certificate (Meta requires HTTPS for all webhook URLs)
- [ ] Update all webhook URLs in Meta Developer Portal to point to the production domain
- [ ] Verify all webhooks are returning correct challenge responses

#### 1.3 Set Up Business Manager

- [ ] Create or use an existing **Meta Business Manager** account at [business.facebook.com](https://business.facebook.com)
- [ ] Link the Meta App to your Business Manager (App Settings → Advanced → Business Manager)
- [ ] Add a real **Facebook Page** and/or **WhatsApp Business Account** under your Business Manager (for testing during review)

---

### Phase 2: Request Permissions (Add Products)

In the Meta Developer Portal, add the following Products to your app and request the specific permissions:

#### For WhatsApp
- Add Product: **WhatsApp** → WhatsApp Business Platform
- Permissions to request:
  - `whatsapp_business_messaging` — to send/receive WhatsApp messages
  - `whatsapp_business_management` — to manage WhatsApp Business Accounts

#### For Instagram
- Add Product: **Instagram** → Instagram Graph API
- Permissions to request:
  - `instagram_basic` — basic profile access
  - `instagram_manage_messages` — to read and respond to Instagram DMs

#### For Messenger / Facebook Pages
- Add Product: **Messenger**
- Permissions to request:
  - `pages_messaging` — to send/receive messages on Facebook Pages
  - `pages_read_engagement` — to read page content and messages
  - `pages_manage_metadata` — to subscribe webhooks to pages

#### For Business Login (SSO)
- Add Product: **Facebook Login for Business** (under Facebook Login)
- Permissions to request:
  - All of the above, scoped through the OAuth flow

---

### Phase 3: Record Screen Recordings (Required for Submission)

Meta requires **screen recordings** demonstrating that your app uses each permission legitimately. These are the most important part of the review submission.

**For each permission you request, you need a screen recording showing:**

1. The use case in action (e.g., a customer sends a WhatsApp message → your app receives it and classifies it)
2. How the data is used and not misused
3. The permission being used within the context of your stated business purpose

**Recording Requirements (from Meta):**
- Must be in English (or provide subtitles)
- Must clearly show the entire flow from start to finish
- Must not show test data that looks suspicious
- Recommended format: MP4, maximum 50MB per video

**Suggested Recordings to Prepare:**

| Permission | What to Record |
|---|---|
| `whatsapp_business_messaging` | Customer sends WhatsApp message → webhook fires → message classified in your dashboard |
| `instagram_manage_messages` | Customer sends Instagram DM → webhook fires → message classified |
| `pages_messaging` | Customer sends Facebook Messenger message → webhook fires → classified |
| `Facebook Login for Business` | Business admin clicks "Connect with Facebook" → OAuth popup → grants permissions → their account appears connected in your dashboard |

**Tips:**
- Use a clean browser with no personal info visible
- Record at 1080p or higher
- Include a voiceover or on-screen text explaining each step
- Test users must actually send messages during the recording (not simulated)

---

### Phase 4: Write the Permission Justifications

For each permission in the App Review submission form, Meta asks:

> *"How does your app use this permission? Provide a step-by-step description."*

**Template:**

> Our app [App Name] is an AI lead classification tool for businesses. When a business customer onboards, they connect their [WhatsApp/Instagram/Facebook Page] via Facebook Login. The permission `[permission_name]` is used to [receive/send] messages from their customers. These messages are analyzed by our AI system to classify them into categories (Hot Lead, Support, Refund, Spam) so the business can prioritize responses. We do not use this data for advertising or share it with third parties.

Write one detailed justification per permission.

---

### Phase 5: Submit for App Review

1. Go to Meta Developer Portal → Your App → **App Review** → **Permissions and Features**
2. For each permission, click **"Request Advanced Access"**
3. Fill in the justification text and upload your screen recording
4. Click **Submit for Review**

**Review Timeline**: Meta typically takes 5–15 business days. Complex reviews (especially WhatsApp Business API) can take longer. You may receive follow-up questions from Meta's review team.

**What Happens After Approval:**
- Your app switches to **Live Mode**
- Real businesses can now authenticate via Facebook Login
- Real WhatsApp numbers (not just test numbers) can send messages to businesses using your app
- All permissions you requested become available via the OAuth flow

---

## 6. Permissions We Need from Meta

Summary of all permissions required:

| Permission | Platform | Why We Need It |
|---|---|---|
| `whatsapp_business_messaging` | WhatsApp | Receive/send WhatsApp messages for business accounts |
| `whatsapp_business_management` | WhatsApp | Manage WABA settings and phone numbers |
| `instagram_manage_messages` | Instagram | Read Instagram DMs sent to business accounts |
| `instagram_basic` | Instagram | Read basic profile info of the Instagram account |
| `pages_messaging` | Messenger | Receive messages sent to Facebook Pages |
| `pages_read_engagement` | Messenger | Read Page messages and engagement data |
| `pages_manage_metadata` | Messenger | Subscribe our webhook to a Page |
| `business_management` | All (SSO) | Access business assets via Facebook Login |

---

## 7. Production Architecture vs POC

### POC Architecture (Now)

```
[Single hardcoded business]
         │
         ▼
Meta Webhooks ──► FastAPI Server ──► Classification Engine ──► PostgreSQL
         │
    (one token, one account, set in .env)
```

### Production Architecture (Target)

```
[Business A] ─── Facebook Login ───┐
[Business B] ─── Facebook Login ───┤
[Business C] ─── Facebook Login ───┤
                                   ▼
                         Our App Backend
                         ┌──────────────────────────────┐
                         │  OAuth Handler               │
                         │  Token Store (per business)  │
                         │  Webhook Router              │
                         │  Classification Engine       │
                         │  Results DB (multi-tenant)   │
                         └──────────────────────────────┘
                                   │
                         PostgreSQL (per-business data)
```

### Key Differences to Build

| Area | POC | Production |
|---|---|---|
| Tokens | One token in `.env` | Per-business token stored in DB, encrypted |
| Accounts | Single hardcoded account | Any business can connect their account |
| Webhooks | Single global webhook | Same webhook endpoints, but messages routed by Page ID / WABA ID |
| Auth | None | Facebook Login (OAuth 2.0) |
| Database | Single-tenant tables | Multi-tenant: all tables have a `business_id` column |
| Token Refresh | Manual | Automated (long-lived tokens last 60 days, need refresh logic) |
| UI | None | Dashboard for businesses to see classified messages + connection status |

### Database Changes Needed for Production

The current schema (messages, classifications, labels) will need a `businesses` table and `business_id` foreign keys:

```sql
-- New table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    facebook_user_id TEXT,
    whatsapp_phone_number TEXT,
    instagram_account_id TEXT,
    page_id TEXT,
    access_token TEXT NOT NULL,  -- store encrypted
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add to existing tables
ALTER TABLE messages ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE labels ADD COLUMN business_id UUID REFERENCES businesses(id);
```

---

## 8. Open Decisions & Action Items

### Decisions Pending

| # | Decision | Options | Status |
|---|---|---|---|
| 1 | Business onboarding method | A) Facebook Login (OAuth) vs B) Manual token entry | Pending |
| 2 | Hosting platform for production | AWS / GCP / Render / Railway / etc. | Pending |
| 3 | Frontend framework | React, Next.js, or simple HTML | Pending |
| 4 | Token encryption strategy | AWS KMS / Vault / Fernet | Pending |

### Action Items (Ordered by Priority)

#### Before Meta App Review Submission
- [ ] Register a real domain and deploy the backend to production (HTTPS required)
- [ ] Write a Privacy Policy and publish it at a public URL
- [ ] Write Terms of Service and publish at a public URL
- [ ] Add a Data Deletion endpoint or instructions page
- [ ] Link the Meta App to a Business Manager account
- [ ] Add all required products (WhatsApp, Instagram, Messenger, Facebook Login for Business) in the Meta Developer Portal
- [ ] Set up a real WhatsApp Business Account and Instagram Business Account for testing during review
- [ ] Record screen recordings for each permission (see Section 5, Phase 3)
- [ ] Write permission justification text for each permission
- [ ] Submit all permissions for App Review

#### For Business Onboarding (Build)
- [ ] Decide on Option A vs Option B (see Section 4)
- [ ] If Option A: Build OAuth callback endpoint and token exchange logic
- [ ] If Option A: Build "Connect with Facebook" button in the UI
- [ ] Add `businesses` table to database schema
- [ ] Add `business_id` to messages and classifications tables
- [ ] Build webhook routing logic (map incoming Page ID / WABA ID → business record)
- [ ] Build token storage with encryption
- [ ] (Later) Build token refresh logic for expiring tokens

---

*Last updated: 2026-03-01*
*Author: Sushanth / Claude*
