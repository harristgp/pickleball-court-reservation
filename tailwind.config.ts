import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Sports-centric accent: court lime over slate/zinc neutrals.
        brand: {
          50: '#f4fbe8',
          100: '#e6f6cb',
          200: '#cfee9d',
          300: '#b0e165',
          400: '#94d13a',
          500: '#75b61d',
          600: '#5a9113',
          700: '#456e13',
          800: '#395715',
          900: '#314a16',
          950: '#182806',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 4px 16px -6px rgb(0 0 0 / 0.10)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
