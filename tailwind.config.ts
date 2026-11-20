import type { Config } from 'tailwindcss';

/**
 * DREAMORA design tokens (see ARCHITECTURE.md §4).
 * Dark-only theme. Use logical utilities (ms-*, me-*, ps-*, pe-*, start-*, end-*, text-start)
 * so layouts mirror correctly in RTL (Arabic).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#05060F', // bg-base
        surface: '#0B1030', // bg-surface
        ink: '#F4F4FB', // text
        muted: '#9CA3C7', // muted text
        primary: {
          DEFAULT: '#4f02d3',
          light: '#A78BFA',
        },
        glow: '#3B82F6', // accent-blue
        gold: '#D4AF37', // highlights, badges, streaks ONLY
        glass: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.08)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-cairo)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-fraunces)', 'var(--font-cairo)', 'Georgia', 'serif'],
        arabic: ['var(--font-cairo)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        pill: '999px',
      },
      boxShadow: {
        glow: '0 0 32px -8px rgba(124,58,237,0.55)',
        'glow-blue': '0 0 32px -8px rgba(59,130,246,0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
