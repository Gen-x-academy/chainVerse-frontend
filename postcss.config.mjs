import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const config = {
  plugins: {
    "@tailwindcss/postcss": [tailwindcss, autoprefixer],
  },
};

export default config;
