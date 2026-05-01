import { useNavigate } from "react-router-dom";
import ConnectivityTest from "../components/ConnectivityTest";
import { useAuthStore } from "../store/authStore";

export default function Landing() {
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const handleStart = () => navigate(token ? "/dashboard" : "/login");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <span className="text-xl font-bold text-brand-500">CloudGPU</span>
        <div className="flex gap-4">
          {token ? (
            <button onClick={() => navigate("/dashboard")} className="btn-primary">
              Dashboard
            </button>
          ) : (
            <>
              <button onClick={() => navigate("/login")} className="text-gray-400 hover:text-white text-sm">
                Sign in
              </button>
              <button onClick={() => navigate("/register")} className="btn-primary">
                Get started
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 text-brand-500 text-xs font-medium px-3 py-1 rounded-full mb-6">
          ComfyUI · RTX 4090 · No install required
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
          GPU workstation<br />in your browser.
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mb-4">
          Launch a cloud RTX 4090 with ComfyUI pre-loaded in under 90 seconds.
          Pay only for what you use. No subscription.
        </p>
        <p className="text-4xl font-bold text-brand-500 mb-10">€2 / hour</p>

        <button onClick={handleStart} className="btn-primary text-lg px-10 py-4 mb-6">
          Start Session
        </button>

        <ConnectivityTest />
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6 px-6 pb-24">
        {[
          { icon: "⚡", title: "RTX 4090", body: "24GB VRAM. Handles SDXL, Flux, and ControlNet without breaking a sweat." },
          { icon: "🌐", title: "Runs in browser", body: "No install. Open, click Start, start generating. Works on any laptop." },
          { icon: "💳", title: "Pay per minute", body: "Billed per minute. Stop when you're done. Minimum charge: 5 minutes." },
        ].map((f) => (
          <div key={f.title} className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
