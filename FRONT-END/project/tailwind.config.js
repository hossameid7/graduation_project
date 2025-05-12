/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: '#1a1c2a', // Main background
          card: '#252838',    // Card/container background
          paper: '#2f3446',   // Input/select background
          hover: '#3a3f54',   // Hover states
          primary: '#e2e8f0',   // Primary text
          secondary: '#94a3b8', // Secondary text
          accent: '#60a5fa',    // Accent color
          border: '#374151',    // Border color
        }
      },
    },
  },
  plugins: [],
}