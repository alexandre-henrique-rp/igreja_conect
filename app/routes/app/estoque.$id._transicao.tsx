import type { Route } from "./+types/estoque.$id._transicao";
import { redirect } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanManageEstoque } from "~/lib/rbac.server";
import { arquivarItem, reabrirItem } from "~/lib/itemEstoque.server";

export async function action({ request, context, params }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageEstoque(user);

  const formData = await request.formData();
  const _op = formData.get("_op");

  if (_op === "arquivar") {
    await arquivarItem(params.id, user);
    return redirect("/app/estoque");
  }
  if (_op === "reabrir") {
    await reabrirItem(params.id, user);
    return redirect("/app/estoque");
  }

  throw new Response("Operação inválida.", { status: 400 });
}
