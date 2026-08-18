import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'network-blue':   '#181A24',  // Steel Gray 100
        'pure-white':     '#FFFFFF',
        'stacked-blue':   '#00018B',  // Deep Blue
        'celestial-blue': '#4442E3',  // Impact Blue
        'power-orange':   '#FF5F2D',  // Impact Orange
        'secure-gray':    '#484F6B',  // Steel Gray 75
        'commerce-green': '#2E776A',  // Green
        'energy-orange':  '#CF3708',  // Deep Orange
        'charge-yellow':  '#E6EB5D',  // Yellow
        'culture-gray':   '#F2F3F6',  // Light Steel
        'level-gray':     '#C8CAD3',  // Steel Gray 25
      },
      fontFamily: {
        display: ['"Bio Sans"', '"Inter"', '-apple-system', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        body:    ['"Inter"', '"Bio Sans"', '-apple-system', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        xs:    '0 1px 2px rgba(24,26,36,0.06)',
        sm:    '0 2px 4px rgba(24,26,36,0.06), 0 1px 2px rgba(24,26,36,0.04)',
        md:    '0 6px 16px rgba(24,26,36,0.08), 0 2px 4px rgba(24,26,36,0.05)',
        focus: '0 0 0 3px rgba(68,66,227,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
