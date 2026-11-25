import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    open: true,
    port: 3009,
  },
  preview: {
    port: 3009,
  },
  base: "/numbers-game/",
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    singleQuote: false,
    trailingComma: "all",
  },
});
