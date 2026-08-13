import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'network-blue':   '#00263A',
        'pure-white':     '#FFFFFF',
        'stacked-blue':   '#003057',
        'celestial-blue': '#4197CB',
        'power-orange':   '#D64123',
        'secure-gray':    '#414042',
        'commerce-green': '#00945E',
        'energy-orange':  '#FF6B00',
        'charge-yellow':  '#FFCD00',
        'culture-gray':   '#F6F6F6',
        'level-gray':     '#D9D8D6',
      },
      fontFamily: {
        display: ['"Bio Sans"', '"Inter"', '-apple-system', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        body:    ['"Inter"', '"Bio Sans"', '-apple-system', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        xs:    '0 1px 2px rgba(0,38,58,0.06)',
        sm:    '0 2px 4px rgba(0,38,58,0.06), 0 1px 2px rgba(0,38,58,0.04)',
        md:    '0 6px 16px rgba(0,38,58,0.08), 0 2px 4px rgba(0,38,58,0.05)',
        focus: '0 0 0 3px rgba(65,151,203,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
