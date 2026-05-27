/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        rally: {
          50:  "#FAFFEC",
          100: "#EEFFBE",
          200: "#DDFF7A",
          300: "#C7FF3D",
          400: "#B6FF00",
          500: "#9CE600",
          600: "#7FBA00",
          700: "#5F8A00",
          800: "#3E5C00",
          900: "#1F2E00",
        },
      },
    },
  },
  plugins: [],
}
