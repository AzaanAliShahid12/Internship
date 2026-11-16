/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#eef7ff', 100: '#d9edff', 200: '#bce0ff', 300: '#8ecdff',
          400: '#59b1ff', 500: '#3390fc', 600: '#1c72f1', 700: '#155dde',
          800: '#184cb4', 900: '#1a428f',
        },
        sidebar: '#14181f',
      },
      borderRadius: { lg: '0.625rem', md: '0.5rem', sm: '0.375rem' },
      boxShadow: { card: '0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)' },
    },
  },
  plugins: [],
};
