// Demo mode mock handlers — simulate the full session flow with fake data.
// Activated when VITE_DEMO_MODE=true in .env

import { v4 as uuid } from 'crypto';

const DEMO_USER = {
  id: 'demo-user-0001',
  email: 'demo@cloudgpu.io',
  created_at: new Date().toISOString(),
};

const DEMO_TOKEN = 'demo-jwt-token';

// In-memory session state for the demo
let demoSession: Record<string, unknown> | null = null;
let bootTimer: ReturnType<typeof setTimeout> | null = null;

function makeSessionId() {
  return 'demo-session-' + Math.random().toString(36).slice(2, 8);
}

// Simulates the 8-second pod boot then flips status to 'running'
function scheduleBoot(sessionId: string) {
  if (bootTimer) clearTimeout(bootTimer);
  bootTimer = setTimeout(() => {
    if (demoSession && demoSession.id === sessionId) {
      demoSession.status = 'running';
      demoSession.kasm_url = 'demo-frame';
      demoSession.started_at = new Date().toISOString();
      demoSession.last_heartbeat = new Date().toISOString();
    }
  }, 8000);
}

export type MockResponse = { data: unknown; status: number };

export async function mockFetch(method: string, url: string, body?: unknown): Promise<MockResponse> {
  await delay(200 + Math.random() * 200); // Simulate network

  // Auth
  if (method === 'POST' && url.includes('/auth/register')) {
    return ok(DEMO_USER);
  }
  if (method === 'POST' && url.includes('/auth/login')) {
    return ok({ access_token: DEMO_TOKEN, token_type: 'bearer' });
  }
  if (method === 'GET' && url.includes('/auth/me')) {
    return ok(DEMO_USER);
  }

  // Billing: create payment intent
  if (method === 'POST' && url.includes('/billing/payment-intent')) {
    return ok({ client_secret: 'demo_secret_xyz', payment_intent_id: 'demo_pi_001' });
  }

  // Sessions: start
  if (method === 'POST' && url.includes('/sessions/start')) {
    const id = makeSessionId();
    demoSession = {
      id,
      status: 'pending',
      kasm_url: null,
      started_at: null,
      last_heartbeat: null,
    };
    scheduleBoot(id);
    return { data: demoSession, status: 201 };
  }

  // Sessions: get
  if (method === 'GET' && url.match(/\/sessions\/demo-session/)) {
    if (!demoSession) return { data: null, status: 404 };
    return ok(demoSession);
  }

  // Sessions: delete (terminate)
  if (method === 'DELETE' && url.match(/\/sessions\/demo-session/)) {
    if (bootTimer) clearTimeout(bootTimer);
    demoSession = null;
    return { data: null, status: 204 };
  }

  // Sessions: heartbeat
  if (method === 'PUT' && url.includes('/heartbeat')) {
    if (demoSession) demoSession.last_heartbeat = new Date().toISOString();
    return { data: null, status: 204 };
  }

  // Sessions: history
  if (method === 'GET' && url.endsWith('/sessions')) {
    return ok([
      { id: 'demo-hist-001', status: 'terminated', started_at: new Date(Date.now() - 86400000).toISOString(), terminated_at: new Date(Date.now() - 83400000).toISOString(), duration_minutes: 50, amount_eur: 1.67 },
      { id: 'demo-hist-002', status: 'terminated', started_at: new Date(Date.now() - 172800000).toISOString(), terminated_at: null, duration_minutes: 120, amount_eur: 4.00 },
    ]);
  }

  console.warn('[DEMO] Unhandled mock route:', method, url);
  return { data: { detail: 'Mock not implemented' }, status: 404 };
}

function ok(data: unknown): MockResponse { return { data, status: 200 }; }
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
