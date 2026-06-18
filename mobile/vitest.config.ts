import { defineConfig } from "vitest/config";
import path from "path";

// Mobile unit tests cover pure modules (e.g. lib/dates) plus the shared UI
// primitives, which render via react-test-renderer with `react-native` mocked
// to lightweight stubs (see test-utils/). No native/Expo runner required.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
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
