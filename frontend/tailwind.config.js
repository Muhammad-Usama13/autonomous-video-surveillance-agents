/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app:     'var(--bg-app)',
        surface: 'var(--bg-surface)',
        panel:   'var(--bg-panel)',
        card:    'var(--bg-card)',
        border:  'var(--border)',
        accent:  'var(--accent)',
        warn:    'var(--warn)',
        danger:  'var(--danger)',
        success: 'var(--success)',
        muted:   'var(--text-muted)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
      },
      fontFamily: {
        mono:    ['JetBrains Mono', 'monospace'],
        display: ['Bebas Neue', 'sans-serif'],
        body:    ['Plus Jakarta Sans', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elev)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
