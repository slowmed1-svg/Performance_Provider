import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";
import { useEffect, useRef } from "react";

export interface Session {
  id: string;
  status: "pending" | "running" | "terminated" | "error";
  kasm_url: string | null;
  started_at: string | null;
  last_heartbeat: string | null;
}

export function useActiveSession(sessionId: string | null) {
  return useQuery<Session>({
    queryKey: ["session", sessionId],
    queryFn: () => client.get(`/sessions/${sessionId}`).then((r) => r.data),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending") return 3000;
      if (status === "running") return 30000;
      return false;
    },
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentIntentId: string) =>
      client.post("/sessions/start", { payment_intent_id: paymentIntentId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }),
  });
}

export function useStopSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => client.delete(`/sessions/${sessionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session"] }),
  });
}

export function useHeartbeat(sessionId: string | null, active: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId || !active) return;
    const send = () => client.put(`/sessions/${sessionId}/heartbeat`).catch(() => {});
    send();
    intervalRef.current = setInterval(send, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, active]);
}
