import { defineConfig } from "vitest/config";
import path from "path";

// Mobile unit tests cover pure, framework-free modules only (e.g. lib/dates).
// Anything importing React Native belongs in an Expo/RN runner, not here.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.expo/**",
      "**/android/**",
      "**/ios/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
