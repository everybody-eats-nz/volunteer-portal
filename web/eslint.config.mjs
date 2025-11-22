import nextConfig from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "prisma/**/*.js",
      "scripts/**/*.js",
      "playwright-report/**",
      "test-results/**",
      "src/generated/**"
    ]
  },
  ...nextConfig,
  ...typescriptConfig,
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "args": "none"
      }]
    }
  }
];

export default eslintConfig;
