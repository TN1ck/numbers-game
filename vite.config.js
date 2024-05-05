import {defineConfig} from "vite";

// https://vitejs.dev/config/
export default defineConfig(({command}) => ({
  plugins: [],
  server: {
    open: true,
    port: 3009,
  },
  preview: {
    port: 3009,
  },
}));
