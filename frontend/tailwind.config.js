/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FFFDF9",
          100: "#FAF8F3",
          200: "#F8F4EC",
          300: "#EDE7DB",
        },
        peach: {
          100: "#FDECE7",
          200: "#F1C6B8",
          300: "#E9B7A8",
          400: "#E8B09E",
          500: "#DFA18F",
        },
        deepGreen: {
          800: "#123F39",
          900: "#0B3D35",
          950: "#073C35",
        },
        luxuryGold: {
          400: "#C09A5B",
          500: "#B78A45",
          600: "#9A7233",
        },
        brandText: {
          primary: "#173F39",
          secondary: "#243F3A",
          muted: "#4F6E68",
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      boxShadow: {
        luxury: "0 20px 45px -15px rgba(7, 60, 53, 0.12)",
        video: "0 25px 60px -15px rgba(7, 60, 53, 0.20)",
        card: "0 10px 30px -10px rgba(7, 60, 53, 0.08)",
      },
    },
  },
  plugins: [],
};
