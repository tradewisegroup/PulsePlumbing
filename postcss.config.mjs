// Use Tailwind v4's dedicated PostCSS plugin so the parent directory's
// Tailwind v3 is never picked up during the server build step.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
