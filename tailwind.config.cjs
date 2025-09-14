// tailwind.config.cjs
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'], // Inter as default
      },
      colors: {
        brand: {
          DEFAULT: '#2563eb',  // primary blue
          light: '#3b82f6',
          dark: '#1e40af',
        },
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.06)', // clean card shadows
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),      // ✅ better inputs, selects, textareas
    require('@tailwindcss/typography'), // ✅ better prose formatting
  ],
}
