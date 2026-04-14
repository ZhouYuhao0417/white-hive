/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080C',
          900: '#0A0B10',
          800: '#0F111A',
          700: '#141826',
          600: '#1B2030',
        },
        brand: {
          50:  '#EAF8FF',
          100: '#CFEEFF',
          200: '#9FDBFF',
          300: '#7FD3FF',
          400: '#4FBFF5',
          500: '#2AA7E6',
          600: '#1A87BF',
        },
        accent: {
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(127,211,255,0.15), 0 10px 60px -20px rgba(127,211,255,0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -30px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(ellipse at top, rgba(127,211,255,0.10), transparent 60%)',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
