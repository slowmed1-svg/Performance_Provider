import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          500: "#4f6ef7",
          600: "#3b57e8",
          700: "#2e44cc",
          900: "#1a2580",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
