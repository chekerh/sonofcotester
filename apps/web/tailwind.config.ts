import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        fog: "#e2e8f0",
        ember: "#fb923c",
        ocean: "#0f766e",
        sand: "#fff7ed"
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 60px rgba(15, 23, 42, 0.16)"
      }
    }
  },
  plugins: []
} satisfies Config;

