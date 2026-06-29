/** @type {import('tailwindcss').Config} */
import flowbite from "flowbite-react/plugin";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/flowbite-react/dist/esm/**/*.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    flowbite, 
  ],
}


