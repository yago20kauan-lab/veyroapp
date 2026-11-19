/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D10', surface: '#14171B', surface2: '#1A1E24', border: '#262B33',
        text: '#F5F7FA', muted: '#9AA3AE', lime: { DEFAULT: '#C6FF3D', hi: '#E2FF9A' },
        onlime: '#0B0D10', gold: '#FFB21A', danger: '#FF5A5F', success: '#3DDC97',
      },
      fontFamily: { display: ['Unbounded', 'sans-serif'], sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { card: '20px', btn: '14px' },
      letterSpacing: { label: '0.18em', brand: '0.04em', tag: '0.32em' },
    },
  },
  plugins: [],
}
