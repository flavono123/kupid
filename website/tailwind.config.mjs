/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  safelist: [
    // Brand color classes that are dynamically generated
    'text-kattle-ari',
    'text-kattle-bada',
    'text-kattle-chorong',
    'bg-kattle-ari',
    'bg-kattle-bada',
    'bg-kattle-chorong',
    'bg-kattle-ari/5',
    'bg-kattle-ari/10',
    'bg-kattle-ari/20',
    'bg-kattle-bada/5',
    'bg-kattle-bada/10',
    'bg-kattle-bada/20',
    'bg-kattle-bada/30',
    'bg-kattle-chorong/5',
    'bg-kattle-chorong/10',
    'bg-kattle-chorong/20',
    'border-kattle-ari',
    'border-kattle-ari/40',
    'border-kattle-ari/50',
    'border-kattle-bada',
    'border-kattle-bada/40',
    'border-kattle-chorong',
    'border-kattle-chorong/40',
    'border-kattle-chorong/50',
    'hover:text-kattle-ari',
    'hover:text-kattle-bada',
    'hover:text-kattle-chorong',
    'hover:bg-kattle-ari/80',
    'hover:bg-kattle-bada/80',
    'hover:bg-kattle-chorong/80',
    'hover:bg-kattle-ari/20',
    'hover:bg-kattle-bada/20',
    'hover:bg-kattle-chorong/20',
    'shadow-kattle-ari/5',
  ],
  theme: {
    extend: {
      colors: {
        // kattle brand colors (dark mode values from style.css)
        kattle: {
          ari: 'hsl(109, 41%, 82%)',       // Light green
          bada: 'hsl(206, 47%, 70%)',      // Light blue
          chorong: 'hsl(121, 35%, 72%)',   // Green
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
};
