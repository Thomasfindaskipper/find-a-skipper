import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1D6FB8',
        navyDeep: '#124A7D',
        offwhite: '#FAF9F6',
        lightblue: '#EAF3FB',
        gold: '#C9A24B',
        anthracite: '#1C1F26',
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
