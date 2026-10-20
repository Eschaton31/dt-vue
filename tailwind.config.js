/*
 * This config is for the local dev playground only — it is not shipped.
 *
 * Consumers add the package's dist folder to their own `content` array;
 * see the README.
 */
export default {
  content: ['./index.html', './dev/**/*.{vue,js}', './src/**/*.{vue,js}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
