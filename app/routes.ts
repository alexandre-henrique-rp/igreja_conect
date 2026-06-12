import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    // pagina institucional
    index("routes/public/index.tsx"),

    // public
    route("/login", "routes/public/login.tsx"),

] satisfies RouteConfig;
