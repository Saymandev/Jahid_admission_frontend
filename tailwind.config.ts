import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: '#E0E0E0',
        input: '#E0E0E0',
        ring: '#4285F4',
        background: '#F8F9FA',
        foreground: '#202124',
        primary: {
          DEFAULT: '#4285F4',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#5F6368',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#34A853',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#FBBC05',
          foreground: '#202124',
        },
        danger: {
          DEFAULT: '#EA4335',
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#202124',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
