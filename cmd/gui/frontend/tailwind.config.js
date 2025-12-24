/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			brand: ['Outfit', 'sans-serif'],
  		},
  		keyframes: {
  			'cell-flash': {
  				'0%': { backgroundColor: 'hsl(var(--accent) / 0.10)' },
  				'100%': { backgroundColor: 'transparent' },
  			},
  		},
  		animation: {
  			// TODO: [CONFIG] Move to YAML config. Must sync with useFlashingCells.ts FLASH_DURATION_MS
  			'cell-flash': 'cell-flash 1s ease-out forwards',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			// Semantic focus colors for hover/active/highlight states
  			focus: {
  				DEFAULT: 'hsl(var(--accent) / 0.15)',
  				active: 'hsl(var(--accent) / 0.30)',
  				highlight: 'hsl(var(--accent) / 0.50)',
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// Kattle logo colors
  			kattle: {
  				ari: 'hsl(var(--kattle-ari))',
  				bada: 'hsl(var(--kattle-bada))',
  				chorong: 'hsl(var(--kattle-chorong))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}

