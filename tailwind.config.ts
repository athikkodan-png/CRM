import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: { 50: '#eef6ff', 600: '#1d5fd1', 700: '#164aa6', 900: '#0f2a5a' } } } },
  plugins: [],
} satisfies Config;
