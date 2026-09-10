import type { Config } from 'tailwindcss'

/**
 * Tailwind is wired to the CSS design tokens declared in
 * src/styles/globals.css. Components should reference these semantic
 * tokens (e.g. `bg-surface`, `text-primary`) rather than hard-coded hex,
 * so dark mode swaps work automatically via the `.dark` class on <html>.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--color-brand)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
        // Semantic surface/text/border tokens that swap in dark mode.
        bg: {
          DEFAULT: 'var(--token-bg)',
          subtle: 'var(--token-bg-subtle)',
        },
        surface: {
          DEFAULT: 'var(--token-surface)',
          subtle: 'var(--token-surface-subtle)',
          hover: 'var(--token-surface-hover)',
        },
        border: {
          DEFAULT: 'var(--token-border)',
          subtle: 'var(--token-border-subtle)',
        },
        text: {
          primary: 'var(--token-text-primary)',
          muted: 'var(--token-text-muted)',
          inverted: 'var(--token-text-inverted)',
        },
        primary: 'var(--token-primary)',
        success: 'var(--token-success)',
        warning: 'var(--token-warning)',
        neutral: {
          bg: 'var(--color-neutral-bg)',
        },
      },
      fontFamily: {
        base: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      spacing: {
        'token-1': 'var(--space-1)',
        'token-2': 'var(--space-2)',
        'token-3': 'var(--space-3)',
        'token-4': 'var(--space-4)',
        'token-6': 'var(--space-6)',
        'token-8': 'var(--space-8)',
      },
      ringColor: {
        DEFAULT: 'var(--color-brand)',
      },
    },
  },
  plugins: [],
}

export default config
