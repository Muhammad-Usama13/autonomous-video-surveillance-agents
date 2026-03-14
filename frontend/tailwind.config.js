/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface:  '#0a0d12',
        panel:    '#0e1420',
        border:   '#1a2236',
        accent:   '#00e5ff',
        warn:     '#ff9800',
        danger:   '#ff3d3d',
        success:  '#00e676',
        muted:    '#4a5568',
      },
      fontFamily: {
        mono:    ['JetBrains Mono', 'monospace'],
        display: ['Bebas Neue', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'scan':       'scan 2s linear infinite',
        'flicker':    'flicker 4s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 95%, 100%': { opacity: 1 },
          '96%':            { opacity: 0.4 },
          '97%':            { opacity: 1 },
          '98%':            { opacity: 0.2 },
          '99%':            { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
