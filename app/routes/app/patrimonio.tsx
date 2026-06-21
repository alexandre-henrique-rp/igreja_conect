import type { Route } from "./+types/patrimonio";
import { redirect } from "react-router";

export function meta() {
  return [{ title: "Patrimônio · Igreja Conect" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return redirect("/app/estoque?tipo=PATRIMONIO");
}

export default function Patrimonio() {
  return null;
}

/**
 * @description Redireciona para /app/estoque?tipo=PATRIMONIO.
 */
