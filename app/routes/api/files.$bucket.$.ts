/**
 * GET /api/files/:bucket/*key — serve arquivos do driver local (fallback
 * sem object storage externo).
 *
 * Só é usado quando `STORAGE_PROVIDER=local`. A URL precisa vir assinada
 * (query params `exp` + `sig`) gerada por `getSignedPreviewUrl` /
 * `getSignedDownloadUrl` — sem isso, retorna 403.
 */
import type { Route } from "./+types/files.$bucket.$";
import { data } from "react-router";
import { localGetObject } from "~/lib/storage/local.server";
import { verifyLocalSignedUrl } from "~/lib/storage/local-signed-url.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const bucket = params.bucket;
  const key = params["*"];

  if (!bucket || !key) {
    return data({ error: "invalid_path" }, { status: 400 });
  }

  const url = new URL(request.url);
  if (!verifyLocalSignedUrl(bucket, key, url.searchParams)) {
    return data({ error: "invalid_or_expired_url" }, { status: 403 });
  }

  const obj = await localGetObject(bucket, key);
  if (!obj) {
    return data({ error: "not_found" }, { status: 404 });
  }

  const disposition = url.searchParams.get("disposition") ?? "inline";
  const filename = url.searchParams.get("filename");

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Content-Length", String(obj.body.length));
  headers.set(
    "Content-Disposition",
    disposition === "attachment"
      ? `attachment; filename="${encodeURIComponent(filename ?? key.split("/").pop() ?? "download")}"`
      : "inline",
  );
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");

  return new Response(new Uint8Array(obj.body), { headers });
}
