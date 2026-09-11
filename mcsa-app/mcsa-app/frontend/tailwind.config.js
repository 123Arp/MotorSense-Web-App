/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "IBM Plex Mono", "Courier New", "monospace"],
      },
      colors: {
        accent: { DEFAULT: "#1A56DB", light: "#EBF0FF", dark: "#1245B5" },
        healthy: { DEFAULT: "#057A55", bg: "#E3FBF2" },
        fault: { DEFAULT: "#C81E1E", bg: "#FDE8E8" },
        warn: { DEFAULT: "#C27803", bg: "#FEFCE8" },
        surface: "#FFFFFF",
        panel: "#F4F5F7",
        border: "#E5E7EB",
      },
    },
  },
  plugins: [],
}
