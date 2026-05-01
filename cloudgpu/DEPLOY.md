# CloudGPU — Deployment Playbook

> Follow this from top to bottom. At the end you will have a live product
> accepting real payments and launching real GPU sessions.

---

## Prerequisites

- DockerHub account (free) — to host the ComfyUI image
- RunPod account — GPU provider
- Stripe account — payments
- Railway account — backend hosting
- Vercel account — frontend hosting
- A domain name (e.g. cloudgpu.io) — buy on Namecheap/Cloudflare (~€10/yr)
- Docker Desktop installed locally

---

## Step 1 — Build and push the ComfyUI Docker image

This is the actual product. Do this once. Takes ~10 minutes to build.

```bash
cd cloudgpu/runpod-image
docker login
bash build-and-push.sh your-dockerhub-username
```

Note the image name it prints: `your-dockerhub-username/cloudgpu-comfyui:latest`

**What's in the image:**
- ComfyUI + ComfyUI Manager
- Flux Schnell fp8 model (~8GB, downloaded on first pod start)
- SDXL VAE
- Default Flux workflow pre-loaded

---

## Step 2 — Set up RunPod

1. Go to [runpod.io](https://runpod.io) → sign up → **Settings → API Keys → + API Key**
   - Copy the key (starts with `rp_`)

2. Go to **Serverless → My Templates → + New Template**
   - Container image: `your-dockerhub-username/cloudgpu-comfyui:latest`
   - Container start command: `/startup.sh`
   - Expose HTTP ports: `8188`
   - Volume: create a **Network Volume** (50GB) mounted at `/workspace/ComfyUI/models`
     - This caches models between sessions so users don't wait 8+ minutes on every boot
   - Copy the **Template ID** from the URL after saving

---

## Step 3 — Set up Stripe

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → activate your account
2. **Developers → API Keys** → copy **Secret key** (`sk_live_...`)
3. **Developers → Webhooks → + Add endpoint**
   - URL: `https://your-backend-domain.railway.app/webhooks/stripe`
   - Events to listen: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the **Signing secret** (`whsec_...`)

---

## Step 4 — Deploy backend to Railway

1. Go to [railway.app](https://railway.app) → New Project → **Deploy from GitHub**
   - Connect your GitHub, select this repo, select the `backend/` folder

2. Add a **PostgreSQL** plugin in Railway:
   - Click **+ New** → Database → PostgreSQL
   - Railway auto-sets `DATABASE_URL` in your service env

3. Set environment variables in Railway dashboard:

```
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
RUNPOD_API_KEY=rp_xxxxxxxx
RUNPOD_GPU_TYPE=NVIDIA GeForce RTX 4090
RUNPOD_IMAGE_NAME=your-dockerhub-username/cloudgpu-comfyui:latest
STRIPE_SECRET_KEY=sk_live_xxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
PRICE_PER_HOUR_EUR=2.00
INACTIVITY_TIMEOUT_MINUTES=15
PRE_AUTH_HOLD_EUR=10.00
FRONTEND_URL=https://your-domain.com
```

4. Railway deploys automatically. Check **Logs** tab — you should see:
   ```
   Configuration validated OK
   Database connection OK
   CloudGPU API started
   ```

5. Note your Railway backend URL: `https://cloudgpu-backend.railway.app`

---

## Step 5 — Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo
2. Set **Root Directory** to `frontend/`
3. Add environment variable:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxx
   VITE_DEMO_MODE=false
   ```
4. In `frontend/vite.config.ts`, update the proxy target to point to your Railway URL:
   ```ts
   target: "https://cloudgpu-backend.railway.app"
   ```
   (Or better: set `VITE_API_BASE_URL` env var and use it in `client.ts`)
5. Deploy. Note your Vercel URL.

---

## Step 6 — Wire up CORS

Back in Railway, update `FRONTEND_URL` to your actual Vercel/custom domain:
```
FRONTEND_URL=https://your-domain.com
```

Railway redeploys automatically.

---

## Step 7 — Connect your domain

1. In Vercel: **Settings → Domains** → add your domain → copy the CNAME record
2. In your DNS provider (Cloudflare/Namecheap): add the CNAME
3. SSL is automatic via Vercel

---

## Step 8 — End-to-end test (with a real card)

Before opening to the public, do one full test yourself:

1. Register an account
2. Click "Start Session" → enter a real card (or Stripe test card `4242 4242 4242 4242`)
3. Watch Railway logs — you should see:
   ```
   Session xxx: pod yyy deployed, waiting for ComfyUI...
   Session xxx: ready at https://yyy-8188.proxy.runpod.net
   ```
4. ComfyUI loads in the iFrame
5. Generate one image to confirm the GPU works
6. Click "Save & Exit" → check Railway logs for billing capture
7. Check Stripe dashboard → payment captured for correct amount

---

## Step 9 — Go live

Update Stripe from **Test mode** to **Live mode**:
1. Stripe dashboard → toggle off **Test mode**
2. Copy new live keys (`sk_live_...`, `pk_live_...`, `whsec_...`)
3. Update Railway env vars + Vercel env var + re-add Stripe webhook with live endpoint

---

## Cost structure at first customer

| Item | Monthly cost at low usage |
|------|--------------------------|
| Railway backend (hobby) | $5/mo |
| Railway PostgreSQL | $5/mo |
| Vercel frontend (free tier) | €0 |
| RunPod network volume (50GB) | ~$2/mo |
| RunPod GPU pods | Pay per session (€0.74/hr pass-through) |
| Domain | ~€1/mo |
| **Fixed overhead** | **~€13/mo** |

You need **7 hours of user sessions per month** to break even on fixed costs.

---

## Troubleshooting

**Session stuck in "pending" forever**
- Check Railway logs for pod deploy errors
- Check your RunPod API key is valid and has GPU quota
- RTX 4090 is often unavailable — add `RUNPOD_GPU_TYPE=NVIDIA RTX A4000` as fallback

**ComfyUI loads but shows blank / 502**
- Models are still downloading inside the pod (can take 5–10 min first run)
- Set up a RunPod Network Volume to cache models — this is the most important optimization

**Stripe webhook failing**
- Run `stripe listen --forward-to your-backend-url/webhooks/stripe` locally to debug
- Ensure webhook secret in Railway matches what Stripe shows

**iFrame blocked / CORS error**
- RunPod proxy URL format: `https://{pod_id}-8188.proxy.runpod.net`
- ComfyUI must be started with `--enable-cors-header` (already in startup.sh)

---

## After your first 10 paying users

1. Add RunPod Network Volume to eliminate model download wait
2. Add GPU fallback types (A4000, A5000) for availability
3. Add session recording to understand how people use ComfyUI
4. Add email notifications (session ready, session ended + invoice)
5. Consider pre-warming 1 pod during peak hours
