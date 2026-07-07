import type { Config } from "tailwindcss";

/**
 * LEONIDAS TECH — OPERATOR COMMAND CENTER design system.
 *
 * Paleta deliberadamente restrita: grafite/preto como base, cinza metálico
 * para texto e bordas, verde neon como único acento de destaque (usado com
 * moderação — botões primários, estados ativos, sucesso, indicadores-chave),
 * branco reservado para alta ênfase, azul "info" quase imperceptível para
 * mensagens informativas. Âmbar/vermelho do Tailwind seguem sendo usados
 * para aviso/erro (convenção universal de software operacional), sempre em
 * tons escuros com pouca saturação de fundo — nunca como blocos sólidos
 * claros.
 *
 * `brand` foi mantido como alias de `neon` para não quebrar nenhuma classe
 * `bg-brand-*`/`text-brand-*` já usada nas páginas — trocar a paleta aqui é
 * suficiente pra repintar o sistema inteiro sem tocar em cada arquivo.
 */
const neon = {
  50: "#e9fdf3",
  100: "#c7fae0",
  200: "#93f4c3",
  300: "#5be9a5",
  400: "#2fdc8c",
  500: "#17c877",
  600: "#0fa564",
  700: "#0d8154",
  800: "#0e6644",
  900: "#0a4a32",
  950: "#062015",
};

const graphite = {
  50: "#eef1f1",
  100: "#dde2e3",
  200: "#b8c1c3",
  300: "#8a969a",
  400: "#5c6a6e",
  500: "#3d4a4d",
  600: "#2a3436",
  700: "#1e2628",
  800: "#161c1e",
  900: "#101416",
  950: "#0a0d0e",
};

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: neon,
        neon,
        graphite,
        info: {
          400: "#5b9dfb",
          500: "#3b82f6",
          600: "#2f6ad9",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.55)",
        glow: "0 0 0 1px rgba(23,200,119,0.35), 0 0 24px -4px rgba(23,200,119,0.45)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
