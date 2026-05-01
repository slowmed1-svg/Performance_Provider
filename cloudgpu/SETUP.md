# Local Development Setup

## Prerequisites
- Python 3.11+
- Node.js 20+
- Docker Desktop

## 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env
# Open .env and fill in your API keys (RunPod, Stripe, Kasm)
```

## 2. Database

```bash
# From project root — starts PostgreSQL in Docker
docker-compose up -d postgres

# Run migrations
cd backend
alembic upgrade head
```

## 3. Start Backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

## 4. Frontend

```bash
cd frontend
npm install
copy .env.example .env
# Open .env and add your Stripe publishable key
npm run dev
# App: http://localhost:5173
```

## 5. Stripe Webhooks (local testing)

Install Stripe CLI, then:
```bash
stripe listen --forward-to localhost:8000/webhooks/stripe
```
Copy the webhook signing secret into `backend/.env` as `STRIPE_WEBHOOK_SECRET`.

## API Keys You Need

| Service | Where to get it | Field in .env |
|---------|----------------|---------------|
| RunPod | runpod.io → Settings → API Keys | `RUNPOD_API_KEY` |
| RunPod Template | runpod.io → My Templates | `RUNPOD_TEMPLATE_ID` |
| Stripe Secret | dashboard.stripe.com → Developers | `STRIPE_SECRET_KEY` |
| Stripe Publishable | dashboard.stripe.com → Developers | `VITE_STRIPE_PUBLISHABLE_KEY` (frontend) |
| Stripe Webhook | Stripe CLI output | `STRIPE_WEBHOOK_SECRET` |
| Kasm URL | Your Kasm instance | `KASM_API_URL` |
| Kasm API Key | Kasm Admin → API | `KASM_API_KEY` + `KASM_API_SECRET` |

## MVP Shortcut (Skip Kasm)

For the MVP, the `kasm_url_override` in `services/kasm.py` means if RunPod exposes 
port 6901 (VNC via KasmVNC), the URL is passed directly to the iFrame without needing 
a separate Kasm installation. This is the fastest path to testing.

Set `KASM_API_URL=skip` in .env and the service will use the RunPod VNC URL directly.
