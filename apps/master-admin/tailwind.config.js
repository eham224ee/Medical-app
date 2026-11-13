/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#211918',
        paper: '#f5f2ee',
        maroon: '#681c2b',
        green: '#237b53',
        amber: '#a46605',
        red: '#bd3439',
      },
    },
  },
  plugins: [],
};
