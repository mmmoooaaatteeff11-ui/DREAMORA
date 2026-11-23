
import type { Config } from 'tailwindcss';

/**
 * DREAMORA
 * Quiet Luxury — Editorial Wellness
 * Warm Botanical / Dark Theme / RTL Ready
 */

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      colors: {
        // Main backgrounds
        base: '#19231F',
        surface: '#222D27',

        // Typography
        ink: '#F0EEE6',
        muted: '#A9B2A7',

        // Main action color
        primary: {
          DEFAULT: '#E7E2D6',
          light: '#F1EEE6',
          dark: '#D3CCBD',
        },

        // Supporting accents
        glow: '#A9B2A7',
        gold: '#B9A486',

        accent: {
          sage: '#A9B2A7',
          sand: '#B9A486',
          cream: '#E7E2D6',
          forest: '#354239',
        },

        // Cards
        card: {
          DEFAULT: '#26342D',
          hover: '#303E35',
          elevated: '#354239',
        },

        // Glass surfaces
        glass: {
          DEFAULT: 'rgba(231,226,214,0.035)',
          border: 'rgba(231,226,214,0.10)',
        },

        // Borders
        border: {
          DEFAULT: '#3A4940',
          subtle: '#303D35',
          strong: '#657568',
        },

        // Feedback colors
        success: '#91AA91',
        warning: '#C7AA7D',
        danger: '#C78379',
      },

      fontFamily: {
        sans: [
          'var(--font-inter)',
          'var(--font-cairo)',
          'system-ui',
          'sans-serif',
        ],

        heading: [
          'var(--font-fraunces)',
          'var(--font-cairo)',
          'Georgia',
          'serif',
        ],

        arabic: [
          'var(--font-cairo)',
          'system-ui',
          'sans-serif',
        ],
      },

      borderRadius: {
        card: '16px',
        pill: '999px',
      },

      boxShadow: {
        card: '0 5px 20px rgba(0,0,0,0.12)',
        subtle: '0 2px 8px rgba(0,0,0,0.08)',
        elevated: '0 10px 28px rgba(0,0,0,0.16)',
      },

      backgroundImage: {
        'dream-gradient':
          'linear-gradient(145deg, #26342D 0%, #222D27 100%)',

        'warm-gradient':
          'linear-gradient(145deg, #E7E2D6 0%, #D8D2C4 100%)',
      },

      keyframes: {
        'fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(5px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },

      animation: {
        'fade-in': 'fade-in 350ms ease-out both',
      },

      transitionDuration: {
        250: '250ms',
      },
    },
  },

  plugins: [],
};

export default config;
