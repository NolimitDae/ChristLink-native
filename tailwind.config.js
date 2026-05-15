/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#13131A',
        gold: '#C9A84C',
        gold2: '#E0B84C',
        textPrimary: '#F0EBE0',
        muted: '#6B6578',
        green: '#4EC98C',
        red: '#E05050',
      },
      fontFamily: {
        display: ['Lora', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
