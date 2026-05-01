import { useState } from "react";
import { useHeartbeat, useStopSession } from "../hooks/useSession";
import SessionTimer from "./SessionTimer";
import { IS_DEMO } from "../api/client";

interface Props {
  sessionId: string;
  kasmUrl: string;
  startedAt: string;
  onTerminated: () => void;
}

function DemoWorkstation() {
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("Queued...");
  const [done, setDone] = useState(false);

  const runSampler = () => {
    setDone(false);
    setProgress(0);
    setStepLabel("Running...");
    let step = 0;
    const total = 20;
    const iv = setInterval(() => {
      step++;
      setProgress((step / total) * 100);
      setStepLabel(`Step ${step}/${total}`);
      if (step >= total) {
        clearInterval(iv);
        setDone(true);
        setStepLabel("Complete ✓");
        setTimeout(runSampler, 5000);
      }
    }, 300);
  };

  useState(() => { runSampler(); });

  return (
    <div className="w-full h-full bg-gray-900 relative overflow-hidden flex items-center justify-center"
      style={{ backgroundImage: "radial-gradient(circle, #ffffff06 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      <div className="text-center">
        {/* Fake node editor */}
        <div className="relative w-[640px] h-[380px] mb-4">
          <div className="absolute top-6 left-2 bg-gray-800 border border-white/20 rounded-xl w-44 shadow-xl text-left">
            <div className="bg-gray-700 rounded-t-xl px-3 py-2 text-xs font-bold text-gray-200">Load Checkpoint</div>
            <div className="p-3 text-xs text-gray-400">
              <div className="bg-black/30 rounded px-2 py-1 text-gray-300 mt-1">flux1-schnell.safetensor</div>
            </div>
          </div>
          <div className="absolute top-2 left-52 bg-gray-800 border border-white/20 rounded-xl w-48 shadow-xl text-left">
            <div className="bg-purple-900/80 rounded-t-xl px-3 py-2 text-xs font-bold text-gray-200">CLIP Text Encode</div>
            <div className="p-3 text-xs text-gray-300 leading-relaxed bg-black/20 m-2 rounded">
              a photorealistic astronaut on Mars at sunset, 8K, cinematic
            </div>
          </div>
          <div className="absolute top-28 left-40 bg-gray-800 border border-brand-500/50 rounded-xl w-52 shadow-xl shadow-brand-500/10 text-left">
            <div className="bg-indigo-700/60 rounded-t-xl px-3 py-2 text-xs font-bold text-white flex justify-between">
              <span>KSampler</span><span className="text-indigo-300">▶</span>
            </div>
            <div className="p-3 text-xs text-gray-400 space-y-1.5">
              <div className="flex justify-between"><span>steps</span><span className="text-gray-300">20</span></div>
              <div className="flex justify-between"><span>cfg</span><span className="text-gray-300">7.0</span></div>
              <div className="w-full bg-black/40 rounded-full h-1 mt-2 overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className={`text-center text-xs ${done ? "text-green-400" : "text-indigo-400"}`}>{stepLabel}</div>
            </div>
          </div>
          <div className="absolute bottom-6 right-6 bg-gray-800 border border-white/20 rounded-xl w-40 shadow-xl text-left">
            <div className="bg-green-900/60 rounded-t-xl px-3 py-2 text-xs font-bold text-gray-200">Save Image</div>
            <div className="p-3">
              <div className="w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center text-xs text-gray-600"
                style={{ background: done ? "linear-gradient(135deg,#1e1b4b,#7c3aed,#c026d3)" : "#111" }}>
                {!done && "waiting..."}
              </div>
            </div>
          </div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <line x1="186" y1="72" x2="168" y2="178" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3" opacity="0.5"/>
            <line x1="290" y1="72" x2="248" y2="165" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 3" opacity="0.5"/>
            <line x1="392" y1="252" x2="500" y2="310" stroke="#4ade80" strokeWidth="2" strokeDasharray="4 3" opacity="0.4"/>
          </svg>
        </div>
        <p className="text-gray-600 text-sm">Demo mode — in production this is your live ComfyUI on an RTX 4090</p>
      </div>
    </div>
  );
}

export default function SessionFrame({ sessionId, kasmUrl, startedAt, onTerminated }: Props) {
  const [confirming, setConfirming] = useState(false);
  const stopSession = useStopSession();
  useHeartbeat(sessionId, true);

  const handleExit = async () => {
    if (!confirming) { setConfirming(true); return; }
    await stopSession.mutateAsync(sessionId);
    onTerminated();
  };

  return (
    <div className="relative w-full h-screen bg-black flex flex-col">
      {IS_DEMO && (
        <div className="bg-yellow-400/10 border-b border-yellow-400/20 px-4 py-1.5 text-yellow-400 text-xs font-semibold text-center shrink-0">
          DEMO MODE — No real GPU is running. No payment will be taken.
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {IS_DEMO || kasmUrl === "demo-frame"
          ? <DemoWorkstation />
          : <iframe src={kasmUrl} className="w-full h-full border-0"
              allow="camera; microphone; clipboard-read; clipboard-write"
              title="CloudGPU Workstation" />
        }

        <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
          <SessionTimer startedAt={startedAt} />
          <button
            onClick={handleExit}
            disabled={stopSession.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              confirming ? "bg-red-600 hover:bg-red-700 text-white" : "bg-white/20 hover:bg-white/30 text-white backdrop-blur"
            }`}
          >
            {stopSession.isPending ? "Stopping..." : confirming ? "Confirm Exit" : "Save & Exit"}
          </button>
          {confirming && (
            <button onClick={() => setConfirming(false)}
              className="px-3 py-2 rounded-lg text-sm bg-white/10 text-white backdrop-blur hover:bg-white/20">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
