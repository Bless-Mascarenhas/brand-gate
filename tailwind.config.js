/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // App UI palette (slate/indigo/violet accents)
        brand: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          300: '#a3b8fc',
          400: '#7190f8',
          500: '#4361ee',
          600: '#2f45db',
          700: '#2334b5',
          800: '#1e2b92',
          900: '#1c2674',
        },
        // Thrift-It brand palette for governed previews & assets
        thrift: {
          teal: '#0E7C7B',
          marigold: '#F2A900',
          ink: '#1B1B1F',
          paper: '#FAF6EE',
          chili: '#D7263D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
