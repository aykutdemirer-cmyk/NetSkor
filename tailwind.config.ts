import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: { 950: "#0b1120" },
        score: { green: "#22c55e", amber: "#f59e0b", red: "#ef4444" },
      },
    },
  },
  plugins: [],
};
export default config;
