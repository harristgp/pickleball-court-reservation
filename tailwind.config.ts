import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4fbe8',
          100: '#e6f6cc',
          200: '#cdec9e',
          300: '#aade67',
          400: '#8bcd3d',
          500: '#6cb01f',
          600: '#528c14',
          700: '#3f6b14',
          800: '#345516',
          900: '#2d4817',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 10px 30px -18px rgb(15 23 42 / 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
