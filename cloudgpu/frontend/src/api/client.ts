import axios from "axios";
import { mockFetch } from "./mockHandlers";

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

const client = axios.create({ baseURL: "/api" });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// In demo mode, intercept every request and return mock data instead
if (IS_DEMO) {
  client.interceptors.request.use(async (config) => {
    const method = (config.method ?? "get").toUpperCase();
    const url = config.url ?? "";
    const body = config.data ? JSON.parse(config.data) : undefined;

    const { data, status } = await mockFetch(method, url, body);

    // Throw a cancelled error to abort the real request, then resolve via response interceptor
    const mockError = Object.assign(new Error("demo"), {
      isMock: true,
      mockData: data,
      mockStatus: status,
    });
    return Promise.reject(mockError);
  });

  client.interceptors.response.use(undefined, (err) => {
    if (err.isMock) {
      return Promise.resolve({ data: err.mockData, status: err.mockStatus });
    }
    return Promise.reject(err);
  });
} else {
  client.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
      return Promise.reject(err);
    }
  );
}

export { IS_DEMO };
export default client;
