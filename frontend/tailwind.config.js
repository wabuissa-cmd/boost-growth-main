/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Thmanyah Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Thmanyah Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#7A8A6A',
          hover: '#6B7A5E',
          light: '#E5EBE1',
          dark: '#606E52',
        },
        cream: {
          DEFAULT: '#F3EFE8',
          warm: '#F0E9D8',
        },
        gold: {
          DEFAULT: '#D4A64A',
          hover: '#C4963A',
          light: '#FAF0D1',
        },
        ink: {
          DEFAULT: '#2C3625',
          soft: '#5C6853',
          mute: '#8B9E7A',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};
