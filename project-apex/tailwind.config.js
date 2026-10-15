/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apex: {
          bg: '#0b0c0f',
          panel: '#121419',
          panel2: '#181b21',
          raised: '#1f232b',
          line: '#262a33',
          line2: '#323743',
          muted: '#8b93a3',
          dim: '#5c6372',
          red: '#e10600',
          redhi: '#ff2a1f',
          reddim: '#7a0a05',
          gold: '#f5c542',
          purple: '#b45cff',
          green: '#22c55e',
          amber: '#f59e0b',
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(225,6,0,0.35), 0 8px 30px -8px rgba(225,6,0,0.35)',
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -15px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'apex-grad': 'linear-gradient(135deg, rgba(225,6,0,0.18) 0%, rgba(225,6,0,0) 45%)',
        'panel-grad': 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)',
        'carbon': 'repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 6px)',
      },
      keyframes: {
        pulseRed: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
        slideIn: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        pulseRed: 'pulseRed 1.4s ease-in-out infinite',
        slideIn: 'slideIn 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
