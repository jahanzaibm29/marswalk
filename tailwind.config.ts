import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mars: {
          50: "#fdf3ee",
          200: "#f3c3a8",
          400: "#e07a4a",
          500: "#c95a2b",
          700: "#7a3218",
        },
        panel: "rgb(20 15 13 / 0.88)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
