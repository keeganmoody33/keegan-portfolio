/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // High-Vis Dark Mode
        'hv-body': '#121212',
        'hv-surface': '#1E1E1E',
        'hv-border-dim': '#333333',
        'hv-border-highlight': '#CCFF00',
        'hv-text-bright': '#FFFFFF',
        'hv-text-main': '#C9C9C9',
        'hv-text-muted': '#8B8B8B',
        'hv-lime': '#CCFF00',
        'hv-lime-dim': 'rgba(204, 255, 0, 0.15)',
        'hv-orange': '#FF5F1F',
        'hv-red': '#FF3131',
        // Desert Light Mode
        'desert-body': '#E8E2D2',
        'desert-surface': '#DCD5C3',
        'desert-border': '#C5BCAE',
        'desert-olive': '#4A5D23',
        'desert-text': '#2B241D',
        'desert-text-main': '#42382F',
        'desert-muted': '#857A6E',
      },
      fontFamily: {
        'space': ['Space Grotesk', 'sans-serif'],
        'mono': ['Roboto Mono', 'monospace'],
        'slab': ['Roboto Slab', 'serif'],
      },
      animation: {
        'grid-shift': 'gridShift 8s linear infinite',
        'marquee': 'marquee 40s linear infinite',
        'spray': 'sprayStroke 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
      },
      keyframes: {
        gridShift: {
          '0%': { backgroundPosition: '0px 0px, 0px 0px' },
          '100%': { backgroundPosition: '60px 0px, 0px 60px' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        sprayStroke: {
          '0%': { opacity: '0', transform: 'scale(1.5)', filter: 'blur(8px)' },
          '60%': { opacity: '0.8', transform: 'scale(0.95)', filter: 'blur(2px)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0)' },
        },
      },
      boxShadow: {
        'sketch': '5px 5px 0px 0px #CCFF00',
        'sketch-hover': '7px 7px 0px 0px #CCFF00',
        'sketch-active': '2px 2px 0px 0px #CCFF00',
      },
    },
  },
  plugins: [],
}
