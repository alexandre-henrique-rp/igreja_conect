// Carrega `.env` em `process.env` antes do boot do Vite.
// Necessário porque `convite.server.ts` lê `process.env.BASE_URL`
// em escopo de módulo (constante) — sem este import, o fallback
// `http://localhost:5173` vence e o link do convite aponta para
// localhost em qualquer ambiente.
import "dotenv/config";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
