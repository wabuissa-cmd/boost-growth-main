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
          DEFAULT: '#6B8F71',
          hover: '#5A7D60',
          light: '#D4E5D6',
          dark: '#2F4A35',
        },
        cream: {
          DEFAULT: '#F7F3EB',
          warm: '#F5F0E6',
        },
        gold: {
          DEFAULT: '#D4A64A',
          hover: '#C4963A',
          light: '#FAF0D1',
        },
        ink: {
          DEFAULT: '#2F4A35',
          soft: '#4A6350',
          mute: '#6B8270',
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
