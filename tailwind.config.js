/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nba: {
          dark:   '#0a0e1a',
          panel:  '#0f1e33',
          border: '#1e3a5f',
          muted:  '#7090b0',
          text:   '#e8eaf0',
        }
      }
    }
  },
  plugins: [],
}
