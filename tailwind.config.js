/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#58CC02",
          dark: "#46A302",
          light: "#7ED321",
        },
        secondary: {
          DEFAULT: "#1CB0F6",
          dark: "#1899D6",
          light: "#49C0F8",
        },
        accent: {
          DEFAULT: "#FF9600",
          dark: "#E08600",
          light: "#FFB020",
        },
        surface: {
          DEFAULT: "#F7F7F7",
          card: "#FFFFFF",
        },
        text: {
          DEFAULT: "#3C3C3C",
          light: "#6B7280",
          dark: "#1A1A1A",
        },
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 14px rgba(0, 0, 0, 0.08)",
        "card-hover": "0 8px 24px rgba(0, 0, 0, 0.12)",
        button: "0 4px 0 #46A302",
        "button-secondary": "0 4px 0 #1899D6",
        "button-accent": "0 4px 0 #E08600",
      },
    },
  },
  plugins: [],
}
