import { create } from "zustand";
import client from "../api/client";

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),

  login: async (email, password) => {
    const res = await client.post("/auth/login", { email, password });
    const token = res.data.access_token;
    localStorage.setItem("token", token);
    set({ token });
    const me = await client.get("/auth/me");
    set({ user: me.data });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
    window.location.href = "/";
  },

  fetchMe: async () => {
    try {
      const res = await client.get("/auth/me");
      set({ user: res.data });
    } catch {
      localStorage.removeItem("token");
      set({ user: null, token: null });
    }
  },
}));
