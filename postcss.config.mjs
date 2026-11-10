// Tailwind v3 (pure JS). v4's native scanner is blocked by Windows
// Smart App Control on the dev machine, and its WASM fallback finds no files.
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
