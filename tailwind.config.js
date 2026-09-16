/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F2F6F9',
          100: '#E1ECF2',
          200: '#C3D8E5',
          300: '#96BDD4',
          400: '#5D7F95',
          500: '#4A6A80',
          600: '#265F84',
          700: '#1B4966',
          800: '#12324A', // brand primary
          900: '#0E2638',
          950: '#071520',
          DEFAULT: '#12324A',
        },
        teal: {
          50: '#EFFBF9',
          100: '#D4F3F0',
          200: '#AAE7E1',
          300: '#72D3CA',
          400: '#3CB8AE',
          500: '#1C9E93',
          600: '#0F7A72', // brand accent / action
          700: '#0E645D',
          800: '#0F4F4B',
          900: '#11423F',
          DEFAULT: '#0F7A72',
        },
        warm: {
          bg: '#F4F7F8',
          surface: '#FBFCFC',
        },
        fuel: {
          91: '#0E8A5F',
          95: '#C8373A',
          diesel: '#C98314',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Tajawal', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18, 50, 74, 0.04), 0 4px 16px -6px rgba(18, 50, 74, 0.10)',
        phone: '0 30px 80px -20px rgba(18, 50, 74, 0.35)',
      },
    },
  },
  plugins: [],
};
