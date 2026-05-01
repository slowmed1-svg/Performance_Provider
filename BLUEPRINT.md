# CloudGPU — Build Blueprint

> Pay-per-minute browser-based GPU workstation for creative professionals.  
> MVP target: ComfyUI + Blender on RunPod, delivered via Kasm, billed via Stripe.

---

## 1. Product Definition

### What it is
A web platform where users launch a GPU-powered cloud workstation in their browser, pre-loaded with ComfyUI or Blender, and pay only for the time they use.

### MVP Scope (build this first, nothing else)
- One tool: **ComfyUI** (AI image generation)
- One GPU: **RTX 4090** on RunPod (~$0.74/hr)
- Price to user: **€2.00/hr** (billed per minute)
- Session delivered via **Kasm Workspaces** in an iFrame
- Payment via **Stripe** (pre-authorize before session starts)

### Out of scope for MVP
- Blender (phase 2)
- Persistent storage / S3 mounts (phase 2)
- Teams / multi-seat (phase 3)
- Windows workstation (phase 3)
- SolidWorks / AutoCAD / Adobe (phase 4, requires legal work)

---

## 2. System Architecture

```
User Browser
    │
    ▼
React Frontend (Vite + Tailwind)
    │  REST API calls
    ▼
FastAPI Backend  ──► PostgreSQL (sessions, users, billing)
    │
    ├──► RunPod API  (launch / terminate / status GPU pod)
    │
    ├──► Kasm Workspaces API  (session URL, heartbeat)
    │
    └──► Stripe API  (payment intent, webhooks)
         │
         ▼
    Stripe Webhook → FastAPI /webhooks/stripe
```

### Data flow for a session
1. User clicks "Start Session"
2. Frontend calls `POST /sessions/start`
3. Backend creates Stripe PaymentIntent (pre-auth €10 hold)
4. Frontend confirms payment → Stripe webhook fires `payment_intent.succeeded`
5. Backend calls RunPod `POST /pods` → gets `pod_id`
6. Backend polls RunPod until pod status = `RUNNING` (~60-90s)
7. Backend calls Kasm API to provision session → gets `kasm_url`
8. Frontend receives `kasm_url` → renders in iFrame
9. Background worker polls Kasm heartbeat every 60s
10. On "Save & Exit" or 15min inactivity → backend calls RunPod `DELETE /pods/{pod_id}`
11. Backend calculates exact minutes used → charges Stripe for actual amount

---

## 3. Project File Structure

```
cloudgpu/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # Settings (env vars)
│   │   ├── database.py              # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   └── billing.py
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   └── billing.py
│   │   ├── routers/
│   │   │   ├── auth.py              # POST /auth/register, /auth/login
│   │   │   ├── sessions.py          # POST /sessions/start, DELETE /sessions/{id}
│   │   │   ├── status.py            # GET /sessions/{id}/status
│   │   │   └── webhooks.py          # POST /webhooks/stripe
│   │   ├── services/
│   │   │   ├── runpod.py            # RunPod API wrapper
│   │   │   ├── kasm.py              # Kasm API wrapper
│   │   │   ├── stripe_service.py    # Stripe wrapper
│   │   │   └── inactivity.py       # Background heartbeat monitor
│   │   └── core/
│   │       ├── auth.py              # JWT creation/validation
│   │       └── security.py         # Password hashing
│   ├── alembic/                     # DB migrations
│   ├── tests/
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx          # Hero + pricing + CTA
│   │   │   ├── Dashboard.tsx        # Active session + iFrame
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── components/
│   │   │   ├── SessionFrame.tsx     # Kasm iFrame wrapper
│   │   │   ├── SessionTimer.tsx     # Live cost counter
│   │   │   ├── ConnectivityTest.tsx # WebRTC ping test
│   │   │   └── BillingHistory.tsx
│   │   ├── hooks/
│   │   │   ├── useSession.ts
│   │   │   └── useAuth.ts
│   │   ├── api/
│   │   │   └── client.ts            # Axios instance + interceptors
│   │   └── store/
│   │       └── authStore.ts         # Zustand auth state
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── docker-compose.yml               # Local dev: backend + postgres
├── .env.example
└── BLUEPRINT.md                     # This file
```

---

## 4. Backend Specification

### Tech Stack
- **Python 3.11+**
- **FastAPI** — HTTP framework
- **SQLAlchemy 2.0** + **Alembic** — ORM + migrations
- **PostgreSQL 15** — primary database
- **python-jose** — JWT tokens
- **passlib[bcrypt]** — password hashing
- **stripe** — Stripe SDK
- **httpx** — async HTTP client for RunPod/Kasm API calls
- **APScheduler** — background inactivity monitor
- **uvicorn** — ASGI server

### Environment Variables (.env)
```
DATABASE_URL=postgresql+asyncpg://cloudgpu:password@localhost:5432/cloudgpu
SECRET_KEY=<random 32-byte hex>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

RUNPOD_API_KEY=<from runpod.io>
RUNPOD_TEMPLATE_ID=<comfyui golden image template id>
RUNPOD_GPU_TYPE=NVIDIA GeForce RTX 4090

KASM_API_URL=https://<your-kasm-instance>
KASM_API_KEY=<kasm api key>
KASM_API_SECRET=<kasm api secret>

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PER_MINUTE=0.0333   # €2/hr = €0.0333/min

COST_RAW_PER_HOUR_USD=0.74       # RunPod RTX 4090 rate
PRICE_PER_HOUR_EUR=2.00
INACTIVITY_TIMEOUT_MINUTES=15
```

### Database Schema

**users**
```sql
id          UUID PRIMARY KEY
email       VARCHAR(255) UNIQUE NOT NULL
password    VARCHAR(255) NOT NULL
created_at  TIMESTAMP DEFAULT NOW()
stripe_customer_id VARCHAR(255)
```

**sessions**
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
runpod_pod_id   VARCHAR(255)
kasm_session_id VARCHAR(255)
kasm_url        TEXT
status          ENUM('pending','running','terminated','error')
started_at      TIMESTAMP
terminated_at   TIMESTAMP
last_heartbeat  TIMESTAMP
```

**billing_records**
```sql
id                  UUID PRIMARY KEY
session_id          UUID REFERENCES sessions(id)
user_id             UUID REFERENCES users(id)
duration_minutes    DECIMAL(10,2)
amount_eur          DECIMAL(10,2)
stripe_charge_id    VARCHAR(255)
created_at          TIMESTAMP DEFAULT NOW()
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Returns JWT |
| GET | `/auth/me` | JWT | Current user info |
| POST | `/sessions/start` | JWT | Launch GPU + return Kasm URL |
| GET | `/sessions/{id}` | JWT | Session status + URL |
| DELETE | `/sessions/{id}` | JWT | Terminate session + bill |
| GET | `/sessions` | JWT | User's session history |
| POST | `/webhooks/stripe` | Stripe sig | Handle payment events |

### RunPod Integration
- Endpoint: `https://api.runpod.io/graphql`
- Use GraphQL mutations: `podFindAndDeployOnDemand`, `podTerminate`
- Poll `podStatus` every 5s until status = `RUNNING`
- Timeout after 3 minutes → mark session as error, refund pre-auth

### Kasm Integration
- REST API at your Kasm instance
- `POST /api/public/request_kasm` → returns `kasm_url`
- `GET /api/public/get_kasm_status` → heartbeat check
- `DELETE /api/public/destroy_kasm` → clean session

### Inactivity Monitor (Background Job)
- Runs every 60 seconds via APScheduler
- For each `running` session: check `last_heartbeat`
- If `now - last_heartbeat > 15 minutes` → call terminate endpoint
- Frontend must ping `PUT /sessions/{id}/heartbeat` every 60s while iFrame is active

---

## 5. Frontend Specification

### Tech Stack
- **React 18** + **TypeScript**
- **Vite** — build tool
- **Tailwind CSS** — styling
- **Zustand** — auth state
- **React Query (TanStack)** — server state + polling
- **Axios** — HTTP client
- **Stripe.js** — payment UI
- **React Router v6** — routing

### Pages

#### Landing (`/`)
- Hero: "GPU workstation in your browser. €2/hour."
- Features: ComfyUI pre-loaded, pay per minute, no install
- ConnectivityTest component (WebRTC latency check)
- "Start Session" CTA → redirects to `/login` if not authenticated

#### Dashboard (`/dashboard`)
- **Before session:** "Launch ComfyUI" button + estimated cost display
- **During session:**
  - Full-screen Kasm iFrame
  - Floating overlay: live timer + running cost (updates every second)
  - "Save & Exit" button (confirms, then calls DELETE /sessions/{id})
- **After session:** Summary card (duration, cost charged)

#### Billing History (`/history`)
- Table of past sessions: date, duration, cost

### Key Components

**SessionFrame.tsx**
```
- Renders <iframe src={kasm_url} />
- Sends heartbeat PUT every 60s
- Handles iFrame load error (pod not ready yet)
- Shows loading spinner with "Warming up your GPU..." message
```

**SessionTimer.tsx**
```
- Starts counting from session start_time
- Displays: "12:34 — €0.42 so far"
- Updates every second client-side
```

**ConnectivityTest.tsx**
```
- Measures RTT to a test endpoint
- Shows green/yellow/red indicator
- Green: <50ms | Yellow: 50-150ms | Red: >150ms
- Warns user if latency is high before they pay
```

---

## 6. The "Golden Image" (RunPod Template)

### What to build
A RunPod custom template based on their serverless/pod system:

**Base:** `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04`  
**Add:**
- ComfyUI + popular model checkpoints (SDXL, Flux)
- Kasm VNC server for browser streaming
- Auto-start script that launches ComfyUI on port 8188 + VNC on port 6901

### Startup script (`start.sh`)
```bash
#!/bin/bash
# Start ComfyUI
cd /workspace/ComfyUI && python main.py --listen 0.0.0.0 --port 8188 &
# Start VNC/Kasm
/dockerstartup/kasm_default_profile.sh &
wait
```

### RunPod Template Config
- Ports: `6901/http` (Kasm VNC), `8188/http` (ComfyUI)
- Volume: `/workspace` (persistent between restarts, not between users)
- GPU: RTX 4090 required

---

## 7. Stripe Billing Flow

### Session Start
1. Frontend calls `POST /sessions/start`
2. Backend creates `PaymentIntent` with `capture_method: manual` (pre-auth hold of €10)
3. Frontend confirms with Stripe.js → user sees payment UI
4. On `payment_intent.succeeded` webhook → backend launches RunPod pod

### Session End
1. `DELETE /sessions/{id}` called (user or inactivity monitor)
2. Backend calculates `duration_minutes`
3. Backend calls `stripe.PaymentIntent.capture(amount=actual_charge)` for exact amount
4. Remaining hold released automatically
5. Creates `billing_record` in DB

### Minimum charge: 5 minutes (€0.17) — prevents abuse

---

## 8. Security

| Concern | Mitigation |
|---------|-----------|
| JWT expiry | 24hr tokens, refresh on activity |
| Stripe webhook | Verify `stripe-signature` header on every webhook |
| RunPod API key | Server-side only, never exposed to frontend |
| Session isolation | Each user gets unique RunPod pod, no shared containers |
| Kasm URL | One-time URL tied to session, expires on pod termination |
| CORS | Backend allows only frontend domain |
| Rate limiting | Max 1 active session per user at a time |

---

## 9. Build Sequence (Step by Step)

### Phase 1 — Backend Foundation (Week 1)
- [x] Project structure + requirements.txt
- [ ] FastAPI app + config + database setup
- [ ] User model + auth endpoints (register/login/me)
- [ ] Session model + basic CRUD
- [ ] RunPod service (deploy/terminate/status)
- [ ] Session start/stop endpoints wired to RunPod

### Phase 2 — Payments (Week 1-2)
- [ ] Stripe service + PaymentIntent creation
- [ ] Stripe webhook handler
- [ ] Billing record creation on session end
- [ ] Pre-auth capture flow

### Phase 3 — Frontend (Week 2)
- [ ] Vite + React + Tailwind setup
- [ ] Auth pages (login/register)
- [ ] Landing page
- [ ] Dashboard + SessionFrame iFrame
- [ ] SessionTimer component
- [ ] ConnectivityTest component

### Phase 4 — Kasm Integration (Week 3)
- [ ] Kasm API service wrapper
- [ ] Wire session URL through to frontend
- [ ] Inactivity heartbeat (backend + frontend)
- [ ] Auto-kill background job

### Phase 5 — Polish + Deploy (Week 3-4)
- [ ] Docker Compose for local dev
- [ ] Environment validation on startup
- [ ] Error handling + user-facing error messages
- [ ] Basic logging + monitoring
- [ ] Deploy backend to Railway/Render
- [ ] Deploy frontend to Vercel

---

## 10. Business Constants

```python
PRICE_PER_HOUR_EUR    = 2.00
PRICE_PER_MINUTE_EUR  = 0.0333
MINIMUM_CHARGE_EUR    = 0.17    # 5 minutes minimum
RAW_GPU_COST_USD_HR   = 0.74    # RunPod RTX 4090
INACTIVITY_TIMEOUT    = 15      # minutes
PRE_AUTH_HOLD_EUR     = 10.00   # enough for 5hrs
```

---

## 11. Local Dev Setup

```bash
# Clone and setup
git clone <repo>
cd cloudgpu

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env values

# Start postgres via docker
docker-compose up -d postgres

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

---

*Last updated: 2026-05-01 | Status: Phase 1 in progress*
