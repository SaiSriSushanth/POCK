# POCK — Multi-Channel AI Message Intelligence

POCK is a shared inbox platform that receives messages from WhatsApp, Messenger, and Instagram, classifies them using AI (vector search + GPT-4o), generates draft replies, and lets your team respond directly from a single dashboard.

---

## What You Need Before Starting

| Requirement | Where to get it |
|---|---|
| Docker Desktop | https://www.docker.com/products/docker-desktop |
| Node.js 18+ | https://nodejs.org |
| ngrok | https://ngrok.com/download |
| OpenAI API key | https://platform.openai.com/api-keys |
| Meta Developer account | https://developers.facebook.com |

---

## 1. Clone the repo

```bash
git clone https://github.com/SaiSriSushanth/POCK.git
cd POCK
```

---

## 2. Set up ngrok

ngrok exposes your local backend to Meta's webhook callbacks.

```bash
ngrok http 8000
```

Copy the **Forwarding URL** (e.g. `https://abc123.ngrok-free.app`). You'll use this in the next steps.

---

## 3. Create a Meta App

1. Go to https://developers.facebook.com → **My Apps → Create App**
2. Choose **Business** as the app type
3. Add these products to your app:
   - **WhatsApp** → API Setup → add a test phone number
   - **Messenger**
   - **Instagram**

4. Under **WhatsApp → Configuration**, set:
   - Webhook URL: `https://<your-ngrok>/meta/webhook`
   - Verify Token: any string you choose (e.g. `mysecrettoken`)
   - Subscribe to the `messages` field

5. Note down:
   - App ID (top of the app dashboard)
   - App Secret (**Settings → Basic → App Secret**)

---

## 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in every value:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/aileadspoc
OPENAI_API_KEY=sk-...

WHATSAPP_VERIFY_TOKEN=mysecrettoken   # must match what you set in Meta webhook config

REDIS_URL=redis://localhost:6379/0

# Generate with the command below
ENCRYPTION_KEY=

JWT_SECRET_KEY=any-long-random-string
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_OAUTH_REDIRECT_URI=https://<your-ngrok>/businesses/oauth/facebook/callback

FRONTEND_URL=http://localhost:3000
```

**Generate ENCRYPTION_KEY:**
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> Note: Every time you restart ngrok you get a new URL. Update `META_OAUTH_REDIRECT_URI` in `.env` and in the Meta app's **Valid OAuth Redirect URIs** (Facebook Login → Settings) whenever this changes.

---

## 5. Start the backend

```bash
docker-compose up --build
```

This starts:
- `db` — PostgreSQL with pgvector
- `redis` — message broker for Celery
- `api` — FastAPI on port 8000
- `worker` — Celery worker for async classification
- `beat` — Celery beat scheduler

Verify it's running: http://localhost:8000

---

## 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## 7. Register and connect

1. Go to http://localhost:3000 — you'll be taken to the login page
2. Click **Register** and create your account
3. After registering, click **Connect Facebook** and complete the OAuth flow
4. You'll be redirected back to the inbox with your channels connected

---

## 8. Test it

Send a WhatsApp message from your test number to the connected number. Within a few seconds you should see the conversation appear in the inbox, classified with an AI label and a draft reply ready to send.

---

## Project Structure

```
POCK/
├── app/
│   ├── api/              # REST endpoints (auth, conversations, contacts, analytics, labels)
│   ├── core/             # Classification engine, LLM service, vector search
│   ├── ingestion/        # Webhook handlers (WhatsApp, Messenger, Instagram, Slack)
│   ├── models.py         # SQLAlchemy models
│   ├── services/         # OAuth, token encryption, reply sending, draft generation
│   └── workers/          # Celery tasks
├── frontend/
│   ├── pages/            # Next.js pages (inbox, conversation, contacts, analytics)
│   └── lib/api.js        # API client
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## How Classification Works

1. Incoming message hits `/meta/webhook`
2. Celery task is dispatched asynchronously
3. Message is embedded using OpenAI `text-embedding-3-small`
4. Vector similarity search finds the closest labels in the DB
5. GPT-4o classifies the message and provides reasoning
6. Final confidence = 40% vector score + 60% LLM confidence
7. If confidence < 0.5, label is flagged as "Needs Review"
8. A draft reply is generated using GPT-4o-mini with conversation history

---

## Default AI Labels

These are seeded automatically on first startup:

| Label | Description |
|---|---|
| Hot Lead | Customer asking about pricing, purchase, or product details |
| Support | Technical issue, login help, or general assistance |
| Refund | Customer requesting a refund or cancellation |
| Spam | Irrelevant content or promotional messages |

You can add custom labels from the dashboard.

---

## Troubleshooting

**Messages not appearing in inbox**
- Check that ngrok is running and the webhook URL in Meta matches your current ngrok URL
- Run `docker-compose logs worker` to see if classification is failing

**"No business_id" warning in worker logs**
- Your business isn't connected yet — click Reconnect Facebook in the sidebar

**WhatsApp connected but can't send replies**
- Reconnect Facebook to fetch the Phone Number ID (required for outbound messages)

**ENCRYPTION_KEY error on startup**
- Generate a valid Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

**ngrok URL changed**
- Update `META_OAUTH_REDIRECT_URI` in `.env`
- Update the webhook URL in Meta Developer Console
- Restart the API: `docker-compose restart api`
