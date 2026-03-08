import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: "#a64af7",
          "violet-glow": "#c084fc",
          "violet-dark": "#1a1028",
          "violet-deep": "#050208",
          gold: "#f3a745",
          orange: "#fe560d",
          surface: "#0f0b18",
          "surface-light": "#1a1428",
          dim: "#3d3555",
          muted: "#8b82a0",
        },
        method: {
          alipay: "#1677ff",
          wechat: "#07c160",
        },
      },
      fontFamily: {
        display: ['"Syne"', "sans-serif"],
        body: ['"DM Sans"', "sans-serif"],
      },
      animation: {
        "spin-slow": "spin 20s linear infinite",
        "pulse-glow": "pulse-glow 6s ease-in-out infinite",
        ticker: "ticker 30s linear infinite",
        float: "float 8s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.12", transform: "scale(1)" },
          "50%": { opacity: "0.2", transform: "scale(1.1)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-33.33%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-30px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
