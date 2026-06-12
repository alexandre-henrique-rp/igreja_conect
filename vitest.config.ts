import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Configuração do Vitest para Igreja Conect.
 *
 * Alias `~/*` → `./app/*` espelha o tsconfig.json.
 * Setup global carrega dotenv + helpers de DB in-memory.
 * Ambiente Node (não jsdom) — testes de lib/services são server-only.
 *
 * @see tests/setup.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "./app"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    include: [
      "app/**/*.test.ts",
      "tests/**/*.test.ts",
      "prisma/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "app/lib/**/*.ts",
        "app/db/**/*.ts",
        "app/api/**/*.ts",
        "prisma/seed.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.config.ts",
        "**/types/**",
      ],
    },
  },
});
