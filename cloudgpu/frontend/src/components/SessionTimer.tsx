import { useEffect, useState } from "react";

const PRICE_PER_MINUTE = 2 / 60;

interface Props {
  startedAt: string;
}

export default function SessionTimer({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const cost = ((elapsed / 60) * PRICE_PER_MINUTE).toFixed(2);

  return (
    <div className="flex items-center gap-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-white font-mono text-sm">
      <span className="text-green-400">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      <span className="text-gray-300">€{cost}</span>
    </div>
  );
}
