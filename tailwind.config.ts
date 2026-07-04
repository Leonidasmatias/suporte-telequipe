import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe7fe",
          200: "#bfd6fe",
          300: "#93bafc",
          400: "#6096f8",
          500: "#3b76f1",
          600: "#2757e6",
          700: "#2044d1",
          800: "#2038a8",
          900: "#1f3384",
          950: "#182253",
        },
      },
    },
  },
  plugins: [],
};

export default config;
