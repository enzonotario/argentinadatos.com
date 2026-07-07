import { getIconCollections, iconsPlugin } from '@egoist/tailwindcss-icons'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './.vitepress/theme/**/*.{js,vue,ts,json,md}',
    './.vitepress/config.{js,ts,mts}',
    './docs/**/*.md',
    './index.md',
    './node_modules/vitepress-openapi/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  plugins: [
    iconsPlugin({
      collections: getIconCollections(['mdi']),
    }),
  ],
}
