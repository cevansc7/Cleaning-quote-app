/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#ffffff',
        secondary: '#b3b3b3',
        background: '#1a1a1a',
        container: '#242424',
        gold: '#ffd700',
        'gold-hover': '#b8860b',
        border: '#333333',
        input: '#2a2a2a',
        error: '#ff4444',
        success: '#00c851'
      }
    }
  },
  plugins: [],
} 