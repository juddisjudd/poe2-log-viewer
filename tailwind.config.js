/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // POE2 Dark backgrounds (blacks/grays)
        poe: {
          black: '#0a0a0a',
          darker: '#0f0f0f',
          dark: '#171717',
          muted: '#1f1f1f',
          border: '#2a2a2a',
          // Accent greens (subtle, for highlights)
          forest: '#1a2e1a',
          moss: '#3d5c3d',
          // POE2 Gold/Bronze accents
          gold: '#FFD255',
          goldDim: '#c9a227',
          bronze: '#8b7355',
          tan: '#73624D',
          // Blood reds (for deaths/warnings)
          blood: '#40080C',
          crimson: '#6b1c1c',
          // Muted text
          textMuted: '#666666',
          textDim: '#888888',
        }
      }
    },
  },
  plugins: [],
}