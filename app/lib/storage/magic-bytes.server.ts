/**
 * Detecção de MIME por **magic bytes** (NÃO confiar no Content-Type
 * declarado pelo client — ver `training/object-storage-standard.md` §1.③).
 *
 * Lê os primeiros N bytes do arquivo e compara com assinaturas conhecidas.
 * Cobre os tipos mais comuns: JPEG, PNG, GIF, WebP, PDF, ZIP/Office, MP4, MP3.
 *
 * Para tipos não reconhecidos, retorna `application/octet-stream` (fail-closed).
 */
const SIGNATURES: Array<{
  mime: string;
  ext: string;
  bytes: number[];
  mask?: number[];
}> = [
  // Imagens
  { mime: "image/jpeg", ext: ".jpg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: ".png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", ext: ".gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: "RIFF....WEBP"
  {
    mime: "image/webp",
    ext: ".webp",
    bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    mask: [0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff],
  },
  // PDF
  { mime: "application/pdf", ext: ".pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  // ZIP / Office (docx, xlsx, pptx) / JAR
  { mime: "application/zip", ext: ".zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  // Áudio
  // MP3 com ID3v2: "ID3"
  { mime: "audio/mpeg", ext: ".mp3", bytes: [0x49, 0x44, 0x33] },
  // MP3 frame sync: 0xFF 0xFB/FA/F3/F2
  {
    mime: "audio/mpeg",
    ext: ".mp3",
    bytes: [0xff, 0xfb],
    mask: [0xff, 0xe0],
  },
  // OGG
  { mime: "audio/ogg", ext: ".ogg", bytes: [0x4f, 0x67, 0x67, 0x53] },
  // WAV: "RIFF....WAVE"
  {
    mime: "audio/wav",
    ext: ".wav",
    bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45],
    mask: [0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff],
  },
  // Vídeo
  // MP4: "....ftyp" no offset 4
  {
    mime: "video/mp4",
    ext: ".mp4",
    bytes: [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70],
    mask: [0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff],
  },
  // WebM: "....webm" via EBML header (1A 45 DF A3)
  { mime: "video/webm", ext: ".webm", bytes: [0x1a, 0x45, 0xdf, 0xa3] },
];

export interface DetectedMime {
  mime: string;
  ext: string;
}

const FALLBACK: DetectedMime = { mime: "application/octet-stream", ext: "" };

/**
 * Detecta MIME/ext a partir dos primeiros bytes do arquivo.
 *
 * Aceita `Buffer` (Node) ou `Uint8Array` (Web Stream).
 *
 * @example
 *   detectMimeFromBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
 *   // { mime: 'image/jpeg', ext: '.jpg' }
 */
export function detectMimeFromBuffer(
  buffer: Buffer | Uint8Array,
): DetectedMime {
  if (!buffer || buffer.length < 4) return FALLBACK;

  for (const sig of SIGNATURES) {
    if (buffer.length < sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      const expected = sig.bytes[i] ?? 0;
      const mask = sig.mask?.[i] ?? 0xff;
      const actual = buffer[i] ?? 0;
      if ((actual & mask) !== (expected & mask)) {
        match = false;
        break;
      }
    }

    if (match) return { mime: sig.mime, ext: sig.ext };
  }

  return FALLBACK;
}

/**
 * Whitelist de MIMEs permitidos por kind do upload.
 * Bloqueia `mime_mismatch` antes de processar.
 */
export const ALLOWED_MIMES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"],
  document: [
    "application/pdf",
    "application/zip",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
};

/**
 * Verifica se `detectedMime` é compatível com o `kind` declarado.
 * Retorna `true` se compatível, `false` caso contrário.
 */
export function isMimeAllowedForKind(kind: string, detectedMime: string): boolean {
  return ALLOWED_MIMES[kind]?.includes(detectedMime) ?? false;
}
