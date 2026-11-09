/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FC6C01',
          hover: '#e26000',
          light: '#FFF3EB',
        },
      },
    },
  },
  plugins: [],
};
