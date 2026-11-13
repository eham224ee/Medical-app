/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171311',
        paper: '#f5f2ee',
        maroon: '#681c2b',
        'maroon-dark': '#47131d',
        sage: '#247a54',
        amber: '#a66a0a',
        danger: '#bd3439',
      },
      boxShadow: {
        panel: '0 12px 40px rgba(38, 22, 17, 0.08)',
      },
    },
  },
  plugins: [],
};
