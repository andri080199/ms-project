import type { Config } from 'tailwindcss';

/**
 * Color tokens are defined as CSS variables in src/app/globals.css.
 * Mirrored as TS constants in src/lib/theme.ts.
 *
 * Tailwind exposes them as colors so utilities like `bg-primary/30`,
 * `text-primary-light`, `border-glass-border` work with alpha modifiers.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          light: 'rgb(var(--color-primary-light) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
        },
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--color-primary-light) / <alpha-value>)',
          fuchsia: 'rgb(var(--color-accent-fuchsia) / <alpha-value>)',
          cyan: 'rgb(var(--color-accent-cyan) / <alpha-value>)',
          mint: 'rgb(var(--color-accent-mint) / <alpha-value>)',
        },
        bg: {
          base: 'rgb(var(--color-bg-base) / <alpha-value>)',
          canvas1: 'rgb(var(--color-bg-canvas-1) / <alpha-value>)',
          canvas2: 'rgb(var(--color-bg-canvas-2) / <alpha-value>)',
          canvas3: 'rgb(var(--color-bg-canvas-3) / <alpha-value>)',
          elevated: 'rgb(var(--color-bg-elevated) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          inverse: 'rgb(var(--color-text-inverse) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        // legacy aliases — keep callers working until migrated
        glassBg: 'rgb(var(--glass-tint) / 0.10)',
        glassBorder: 'rgb(var(--glass-tint) / 0.18)',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        glassElevated: 'var(--glass-shadow-elevated)',
      },
      backdropBlur: {
        glass: '24px',
        glassSoft: '14px',
      },
      borderRadius: {
        glass: 'var(--glass-radius)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        auroraDrift: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,30px) scale(0.95)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out both',
        aurora: 'auroraDrift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
