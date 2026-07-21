import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // RR7.16+ CSRF protection: allowed origins for action submissions.
  // Em dev, o Windsurf preview usa portas dinâmicas (ex: 29993) e faz proxy
  // para o dev server (localhost:5173), fazendo origin != host → CSRF check.
  // Wildcards: "*" matcha "localhost:PORT" (1 part), "*.*.*.*" matcha
  // "127.0.0.1:PORT" (4 parts). Não matcha domains reais (2+ parts sem port).
  allowedActionOrigins:
    process.env.NODE_ENV === "development"
      ? ["*", "*.*.*.*"]
      : ["appalianca.esmirna.com.br", "https://appalianca.esmirna.com.br"],
  future: {
    v8_middleware: true,
    v8_passThroughRequests: true,
    v8_splitRouteModules: true,
    v8_trailingSlashAwareDataRequests: true,
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
