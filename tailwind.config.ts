import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        sakura: {
          light: '#fde2e4',   // Very pale pink (backgrounds)
          primary: '#ffb7c5', // Standard sakura pink (accents, bloom)
          deep: '#e75480',    // Deep pink/magenta (buttons, active states)
          dark: '#9e2a4b',    // Darker contrast pink/red
        },
        gold: {
          accent: '#ffd700',  // For ornaments/highlights
        },
        miko: {
          white: '#fafafa',   // Clean white for glassmorphism base
        },
      },
    },
  },
  plugins: [],
};
export default config;

