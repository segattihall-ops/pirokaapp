import type { Config } from 'tailwindcss';

// πroka design tokens — mirror of the HTML prototypes (see ../README.md → Design tokens)
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#070707', 900: '#0a0a0a', 850: '#0e0e0e', 800: '#111111', 750: '#1a1a1a' },
        fg: { DEFAULT: '#f5f5f5', 2: '#cccccc', 3: '#999999', 4: '#666666' },
        green: { DEFAULT: '#34d399', hover: '#6ee7b7' },
        danger: '#f87171',
        warning: '#fbbf24',
        line: { 1: 'rgba(255,255,255,0.06)', 2: 'rgba(255,255,255,0.1)', 3: 'rgba(255,255,255,0.14)' },
        sel: { border: 'rgba(52,211,153,0.75)', fill: 'rgba(52,211,153,0.14)' },
      },
      fontFamily: { sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      fontSize: {
        eyebrow: ['11px', { lineHeight: '1', letterSpacing: '0.14em', fontWeight: '700' }],
        nav: ['9px', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '600' }],
        label: ['12px', { lineHeight: '1.4' }],
        body: ['14px', { lineHeight: '1.5' }],
        title: ['15px', { lineHeight: '1.3', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }],
        h1: ['32px', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      borderRadius: { chip: '999px', btn: '14px', input: '13px', card: '20px', sheet: '26px', hero: '28px' },
      boxShadow: {
        float: '0 18px 50px rgba(0,0,0,0.5)',
        panel: '-30px 0 80px rgba(0,0,0,0.55)',
        sheet: '0 -30px 80px rgba(0,0,0,0.6)',
        pin: '0 6px 16px rgba(0,0,0,0.55)',
        glow: '0 0 30px rgba(52,211,153,0.15)',
      },
      keyframes: {
        piIn: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        slideR: { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'none' } },
        pinIn: { from: { opacity: '0', scale: '.5' }, to: { opacity: '1', scale: '1' } },
        piPulse: { '0%': { boxShadow: '0 0 0 0 rgba(52,211,153,.6)' }, '70%': { boxShadow: '0 0 0 16px rgba(52,211,153,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(52,211,153,0)' } },
        piBreathe: { '0%,100%': { scale: '.85', opacity: '.55' }, '50%': { scale: '1.08', opacity: '1' } },
        piDash: { to: { strokeDashoffset: '-28' } },
      },
      animation: {
        in: 'piIn .4s ease-out both',
        slide: 'slideR .3s ease-out both',
        pin: 'pinIn .35s ease-out both',
        pulse: 'piPulse 2.2s infinite',
        breathe: 'piBreathe 3.2s ease-in-out infinite',
        dash: 'piDash 1s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
