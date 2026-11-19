/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f8fafc',
        grid: '#e2e8f0',
      },
    },
  },
  plugins: [],
}
