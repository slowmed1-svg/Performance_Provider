import { useEffect, useState } from "react";

type Quality = "good" | "fair" | "poor" | "testing";

export default function ConnectivityTest() {
  const [rtt, setRtt] = useState<number | null>(null);
  const [quality, setQuality] = useState<Quality>("testing");

  useEffect(() => {
    const measure = async () => {
      const start = Date.now();
      try {
        await fetch("/api/health", { cache: "no-store" });
        const ms = Date.now() - start;
        setRtt(ms);
        setQuality(ms < 80 ? "good" : ms < 200 ? "fair" : "poor");
      } catch {
        setQuality("poor");
      }
    };
    measure();
  }, []);

  const colors: Record<Quality, string> = {
    good: "bg-green-500",
    fair: "bg-yellow-400",
    poor: "bg-red-500",
    testing: "bg-gray-400",
  };

  const labels: Record<Quality, string> = {
    good: "Great connection",
    fair: "Acceptable — some lag possible",
    poor: "Poor connection — expect lag",
    testing: "Testing...",
  };

  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <span className={`w-3 h-3 rounded-full ${colors[quality]} animate-pulse`} />
      <span>{labels[quality]}{rtt ? ` (${rtt}ms)` : ""}</span>
    </div>
  );
}
