import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useAuthStore } from "../store/authStore";
import { useActiveSession, useStartSession } from "../hooks/useSession";
import SessionFrame from "../components/SessionFrame";
import client, { IS_DEMO } from "../api/client";

const stripePromise = IS_DEMO ? null : loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function PaymentForm({ onSuccess }: { onSuccess: (piId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message || "Payment failed");
      setLoading(false);
      return;
    }

    if (paymentIntent?.id) onSuccess(paymentIntent.id);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={loading || !stripe} className="btn-primary w-full py-3">
        {loading ? "Authorizing..." : "Authorize & Launch Session"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        A €10 hold will be placed. You'll only be charged for actual usage (min 5 min).
      </p>
    </form>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(
    localStorage.getItem("active_session_id")
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [terminated, setTerminated] = useState(false);

  const { data: session, isLoading } = useActiveSession(sessionId);
  const startSession = useStartSession();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user]);

  const handleLaunchClick = async () => {
    if (IS_DEMO) {
      // Skip payment in demo mode
      await handlePaymentSuccess("demo_pi_001");
      return;
    }
    const res = await client.post("/billing/payment-intent");
    setClientSecret(res.data.client_secret);
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setShowPayment(false);
    const newSession = await startSession.mutateAsync(paymentIntentId);
    localStorage.setItem("active_session_id", newSession.id);
    setSessionId(newSession.id);
    setTerminated(false);
  };

  const handleTerminated = () => {
    localStorage.removeItem("active_session_id");
    setSessionId(null);
    setTerminated(true);
  };

  // Active session with Kasm URL — show the workstation
  if (session?.status === "running" && session.kasm_url) {
    return (
      <SessionFrame
        sessionId={session.id}
        kasmUrl={session.kasm_url}
        startedAt={session.started_at!}
        onTerminated={handleTerminated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <span className="text-xl font-bold text-brand-500">CloudGPU</span>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.email}</span>
          <button onClick={logout} className="text-gray-500 hover:text-white text-sm">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 pt-16">
        {terminated && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-8 text-green-400 text-sm">
            Session ended. You've been charged only for the time used.
          </div>
        )}

        {/* Pending — pod is provisioning */}
        {session?.status === "pending" && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
            <h2 className="text-2xl font-bold">Warming up your GPU...</h2>
            <p className="text-gray-400">This usually takes 60–90 seconds. Hang tight.</p>
          </div>
        )}

        {/* Error state */}
        {session?.status === "error" && (
          <div className="text-center space-y-4">
            <p className="text-red-400">Session failed to start. You won't be charged.</p>
            <button onClick={() => { setSessionId(null); localStorage.removeItem("active_session_id"); }} className="btn-primary">
              Try again
            </button>
          </div>
        )}

        {/* No active session */}
        {!session && !isLoading && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Launch ComfyUI</h2>
              <p className="text-gray-400">RTX 4090 · 24GB VRAM · €2/hour</p>
            </div>

            {IS_DEMO && (
              <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-yellow-300/80 mb-2">
                <span className="text-yellow-400 shrink-0 mt-0.5">ℹ</span>
                <span><strong className="text-yellow-300">Demo mode.</strong> No real GPU is launched. No payment is taken. Experience the full flow.</span>
              </div>
            )}

            {!showPayment ? (
              <button
                onClick={handleLaunchClick}
                disabled={startSession.isPending}
                className="btn-primary w-full py-4 text-lg"
              >
                {IS_DEMO ? "Start Demo Session" : "Start Session"}
              </button>
            ) : clientSecret ? (
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <h3 className="font-semibold mb-4">Authorize payment</h3>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm onSuccess={handlePaymentSuccess} />
                </Elements>
              </div>
            ) : null}

            <div className="border-t border-white/10 pt-6">
              <h3 className="font-semibold mb-3 text-gray-300">How it works</h3>
              <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
                <li>We pre-authorize €10 on your card (no charge yet)</li>
                <li>Your RTX 4090 boots up — takes ~90 seconds</li>
                <li>ComfyUI opens in this window</li>
                <li>Click "Save & Exit" when done — you're charged only for what you used</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
