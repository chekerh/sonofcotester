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
        display: ["'Archivo'", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["'Bricolage Grotesque'", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 60px rgba(15, 23, 42, 0.16)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "2xs": "0 1px 1px 0 rgb(0 0 0 / 0.05)"
      },
      blur: {
        xs: "2px"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
} satisfies Config;

