/**
 * Rota /app/membros/novo — criar novo membro (S02-T06).
 *
 * **Loader:** trivial (retorna `null` para o form renderizar vazio).
 *
 * **Action:** valida payload com `MembroCreateSchema`, chama
 * `createMembro` do service. Se membro tem cargo + email, retorna
 * dados do convite (modal com texto copiável). Senão, redireciona.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01, RN-MEM-02)
 */
import type { Route } from "./+types/membros.novo";
import { useState, useEffect } from "react";
import { data } from "react-router";
import { ZodError } from "zod";
import { useToast } from "~/components/ToastProvider";
import { userContext } from "~/lib/user-context";
import { MembroCreateSchema, cleanFormData } from "~/lib/schemas/membros";
import { createMembro } from "~/lib/members.server";
import { EmailDuplicadoError } from "~/lib/errors";
import { criarConvite } from "~/lib/convite.server";
import { prisma } from "~/db/prisma.server";
import { FormMembro } from "~/components/FormMembro";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Cadastrar novo membro · Igreja Conect" }];
}

export async function loader(_args: Route.LoaderArgs) {
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const formData = await request.formData();
  const raw: Record<string, string> = {};
  let avatarUploadId: string | null = null;
  // Campos de UI que não pertencem ao schema Zod (.strict() rejeita keys desconhecidas)
  const UI_ONLY_FIELDS = new Set(["temAcesso", "avatarUploadId"]);
  for (const [k, v] of formData) {
    if (typeof v === "string" && !k.endsWith("_dummy") && !UI_ONLY_FIELDS.has(k)) {
      raw[k] = v;
    }
    if (k === "avatarUploadId" && typeof v === "string") {
      avatarUploadId = v || null;
    }
  }

  const cleaned = cleanFormData(raw);

  let validated;
  try {
    validated = MembroCreateSchema.parse(cleaned);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      return data(
        { fieldErrors, defaultValues: raw },
        { status: 422 }
      );
    }
    throw e;
  }

  try {
    const created = await createMembro(validated, user);

    // Se houver avatar pré-uploadado, valida e vincula ao novo membro.
    if (avatarUploadId) {
      const upload = await prisma.upload.findUnique({
        where: { id: avatarUploadId },
        select: { id: true, userId: true, kind: true, status: true },
      });
      if (
        upload &&
        upload.userId === user.id &&
        upload.kind === "image" &&
        upload.status === "READY"
      ) {
        await prisma.membro.update({
          where: { id: created.id },
          data: { avatarUploadId: upload.id },
        });
      }
    }

    // Se membro tem cargo E email → gerar convite e retornar dados
    if (validated.cargo && validated.email) {
      const convite = await criarConvite(created.id, created.nome, validated.cargo);
      return data({
        convite: {
          url: convite.url,
          textoConvite: convite.textoConvite,
          membroNome: created.nome,
        },
      });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: `/app/membros/${created.id}` },
    });
  } catch (e) {
    if (e instanceof EmailDuplicadoError) {
      return data(
        { fieldErrors: { email: e.message }, defaultValues: raw },
        { status: 422 }
      );
    }
    throw e;
  }
}

type ConviteData = {
  url: string;
  textoConvite: string;
  membroNome: string;
};

export default function MembrosNovo({ actionData }: Route.ComponentProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [convite, setConvite] = useState<ConviteData | null>(null);
  const { toast } = useToast();

  // Detectar se action retornou convite
  const actionAny = actionData as Record<string, unknown> | undefined;
  if (actionAny?.convite && !showModal && !convite) {
    // Usar setTimeout para evitar setState durante render
    setTimeout(() => {
      setConvite(actionAny.convite as ConviteData);
      setShowModal(true);
    }, 0);
  }

  // Mostrar toast de erro se o action retornou fieldErrors
  useEffect(() => {
    const actionAny = actionData as { fieldErrors?: Record<string, string> } | undefined;
    if (actionAny?.fieldErrors) {
      const firstError = Object.values(actionAny.fieldErrors)[0];
      if (firstError) {
        toast(firstError, "error");
      }
    }
  }, [actionData, toast]);

  const handleCopy = async () => {
    if (!convite) return;
    await navigator.clipboard.writeText(convite.textoConvite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShowModal(false);
    setConvite(null);
    setCopied(false);
    window.location.href = "/app/membros";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <FormMembro
        isEdit={false}
        formError={(actionData as { formError?: string } | undefined)?.formError}
        fieldErrors={(actionData as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors}
      />

      {/* Modal de Convite */}
      {showModal && convite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Membro cadastrado!</h3>
                <p className="text-sm text-slate-500">Compartilhe o convite com {convite.membroNome}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Copie o texto abaixo e envie via <strong>WhatsApp</strong> ou <strong>Telegram</strong>:
            </p>

            <div className="relative">
              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                {convite.textoConvite}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 h-10 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar texto
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 h-10 rounded-lg bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
