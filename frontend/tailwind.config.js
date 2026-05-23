/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Tajawal', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#7A8A6A',
          hover: '#606E52',
          light: '#E5EBE1',
          dark: '#48543E',
        },
        cream: {
          DEFAULT: '#F6F4F0',
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
