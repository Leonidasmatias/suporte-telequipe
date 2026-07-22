import type { Config } from "tailwindcss";

/**
 * TELEQUIPE SUPORTE STA v7.0 — design system corporativo.
 *
 * Sprint EXCLUSIVAMENTE VISUAL: nenhuma regra de negócio, Prisma, API ou
 * componente funcional foi alterado para produzir este arquivo — apenas os
 * tokens de cor/sombra/animação usados pelas classes utilitárias do
 * Tailwind (`bg-neon-*`, `text-graphite-*`, etc.) já espalhadas por todo o
 * app. Como quase toda página consome cor através destes nomes de token
 * (nunca hex direto), repintar os valores aqui já atualiza a aparência do
 * sistema inteiro sem precisar editar página por página.
 *
 * `neon`/`brand` (mantido como alias, ver nota abaixo) passa a representar o
 * AZUL INSTITUCIONAL da Telequipe (antes era um verde-neon de destaque) —
 * é a cor de marca: botões primários, estados ativos, foco, sidebar, ícones
 * de KPI. `graphite` deixa de ser uma escala escura (dark mode) e passa a
 * ser a escala neutra CLARA do tema corporativo: os números mais altos
 * (900/950) viraram os tons mais CLAROS (fundo de página/painéis) e os
 * números mais baixos (50/100) viraram os tons mais ESCUROS (texto
 * primário) — o app inteiro já era escrito assumindo essa direção (ex.:
 * `bg-graphite-950` para fundo, `text-graphite-100` para texto de
 * destaque), então a forma mais segura de virar de tema escuro para claro
 * SEM tocar em nenhuma página é inverter o sentido da escala aqui, uma
 * única vez, neste arquivo.
 *
 * Verde/âmbar/vermelho continuam reservados para os únicos usos permitidos
 * pela missão: verde só em sucesso (`.chip-success`), âmbar só em avisos
 * pontuais (`.chip-warning`), vermelho só em erro/exclusão (`.chip-danger`,
 * `.btn-danger`) — usando as escalas padrão do Tailwind (emerald/amber/red),
 * não um token de marca.
 */
const neon = {
  50: "#eef0fa",
  100: "#dce0f5",
  200: "#b9c0ec",
  300: "#8d96d8",
  400: "#4e7dba", // Azul claro (Telequipe)
  500: "#2f2d74", // Azul institucional (Telequipe) — cor de marca principal
  600: "#23235d", // Azul escuro (Telequipe) — hover/estado ativo
  700: "#1b1b49",
  800: "#14143a",
  900: "#0d0d28",
  950: "#07071a",
};

const graphite = {
  50: "#12141a",
  100: "#1b1e27", // texto primário (headings, células em destaque)
  200: "#2b2f3b",
  300: "#3e4453",
  400: "#5c6470", // Cinza Texto (Telequipe) — texto secundário/labels
  500: "#7c8494",
  600: "#98a0ae",
  700: "#b9c0cc",
  800: "#d8dee8", // Cinza Borda (Telequipe) — bordas padrão
  900: "#eef1f5", // painéis recuados/hover sutil
  950: "#f5f7fa", // Cinza Fundo (Telequipe) — fundo de página
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
          50: "#eef3fa",
          200: "#c7d7ee",
          400: "#5e88bd",
          500: "#4e7dba",
          600: "#3d69a6",
        },
        // `white` é sobrescrito de propósito: nenhum lugar do app usa
        // `bg-white`/`border-white` hoje (só `text-white` para texto de
        // destaque em tema escuro, 52 ocorrências, todas em headings/células
        // — nenhuma delas depende do valor literal #fff). Redefinir aqui faz
        // esse texto de destaque virar automaticamente escuro/legível sobre
        // o novo fundo claro, sem precisar editar cada página. Onde é
        // necessário branco puro de verdade (ex.: item ativo da Sidebar),
        // os componentes usam o valor hexadecimal literal diretamente.
        white: "#1b1e27",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgba(47,45,116,0.06), 0 1px 3px 0 rgba(15,23,42,0.06)",
        card: "0 1px 2px 0 rgba(15,23,42,0.04), 0 4px 12px -4px rgba(47,45,116,0.10)",
        glow: "0 0 0 1px rgba(47,45,116,0.25), 0 0 20px -4px rgba(47,45,116,0.35)",
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
