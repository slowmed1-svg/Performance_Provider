# Project Blueprint: "CloudGPU-BYOL" (Bring Your Own License) VDI Orchestrator

This document serves as the master specification for building a high-performance, browser-based cloud workstation orchestrator.

## 1. Project Vision
A platform where users (freelancers/engineers) can rent a powerful Windows GPU workstation for 2€/hour.
- **Model:** BYOL (User logs into their own SolidWorks/Adobe/AutoCAD accounts).
- **Core Stack:** Python (FastAPI), React, Kasm Workspaces, RunPod/Lambda Labs API.

## 2. Infrastructure Architecture
- **Provider:** RunPod or Lambda Labs (GPU Instances).
- **Delivery Protocol:** Kasm Workspaces (WebRTC via browser).
- **OS:** Ubuntu 24.04 host running Kasm Windows Docker containers (KasmVNC).

## 3. Technical Requirements (Claude Code Instructions)

### A. Backend (FastAPI)
1. **API Integration:** Connect to RunPod/Lambda API to:
   - `POST /deploy`: Launch a GPU instance with a specific "Golden Image" ID.
   - `DELETE /terminate`: Destroy instance on user logout or inactivity.
   - `GET /status`: Check if the workstation is ready.
2. **User Management:** Simple JWT authentication.
3. **Session Management:** - Track session start/stop times.
   - **Auto-Kill Logic:** If Kasm reports no heartbeat for 15 minutes, trigger `/terminate`.
4. **Database:** PostgreSQL (via SQLAlchemy) to store user sessions, billing logs, and persistent storage paths.

### B. Frontend (React + Tailwind)
1. **Landing Page:** - Pricing: Flat 2€/hour.
   - "Start Session" button (triggers deployment).
2. **Dashboard:**
   - Active Session View (iFrame embedding the Kasm URL).
   - "Save & Exit" button (ensures clean termination).
   - Usage history (hours used vs. cost).
3. **Connectivity Test:** A WebRTC ping test component to ensure the user's internet can handle the 3D stream.

### C. The "Golden Image" (Docker/Kasm)
- Create a `Dockerfile` based on `kasmweb/windows:latest`.
- Pre-install (but do not activate):
  - NVIDIA Drivers (Grid/Data Center).
  - SolidWorks, Adobe Creative Cloud, AutoCAD.
- Configure Kasm to auto-mount a persistent S3-backed volume (using Rclone or similar) to `/home/kasm_user/Desktop/MyStorage`.

### D. Billing System (Stripe)
- Integrate Stripe "Usage-based Billing."
- Create a webhook to capture payment success before triggering a deployment.

## 4. Security Protocols
- **Ephemeral Instances:** Instances are destroyed on logout.
- **Encryption:** All streams must use TLS 1.3 via Kasm.
- **Isolation:** Each user gets a unique Docker container with no cross-communication.

## 5. MVP Implementation Steps (Prompts for Claude Code)
1. "Generate a FastAPI structure for managing GPU instances via RunPod API."
2. "Create a React dashboard that embeds a Kasm Workspaces session in an iFrame."
3. "Write a Python script to monitor Kasm Workspaces API for user inactivity and shut down the underlying cloud server."
4. "Set up a Stripe webhook that credits a user's account balance for hourly usage."

## 6. Business Logic Constants
- `COST_PER_HOUR_RETAIL = 2.00` (EUR)
- `COST_PER_HOUR_RAW_GPU = 0.80` (USD)
- `TARGET_MARGIN = ~55%`
