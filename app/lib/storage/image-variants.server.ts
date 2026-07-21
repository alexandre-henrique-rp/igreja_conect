/**
 * Geração de variants (lg/md/sm) para imagens usando sharp.
 *
 * **Tamanhos:**
 * - lg: max 1024px (largura ou altura, mantém aspect ratio)
 * - md: max 512px
 * - sm: max 128px (thumbnail)
 *
 * **Formato de saída:** mesmo formato da entrada (jpeg/png/webp).
 * Qualidade: 80 (jpeg/webp), 90 (png).
 */
import sharp from "sharp";

export const IMAGE_VARIANTS = ["lg", "md", "sm"] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

const VARIANT_SIZES: Record<ImageVariant, number> = {
  lg: 1024,
  md: 512,
  sm: 128,
};

export interface GeneratedVariant {
  name: ImageVariant;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Gera variants lg/md/sm a partir de um buffer de imagem.
 * Retorna os 3 buffers + metadados.
 */
export async function generateImageVariants(
  source: Buffer,
  contentType: string,
): Promise<GeneratedVariant[]> {
  const variants: GeneratedVariant[] = [];

  for (const name of IMAGE_VARIANTS) {
    const maxSize = VARIANT_SIZES[name];
    const resized = await sharp(source)
      .resize(maxSize, maxSize, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ quality: 90 })
      .jpeg({ quality: 80 })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    variants.push({
      name,
      buffer: resized.data,
      contentType,
      width: resized.info.width,
      height: resized.info.height,
    });
  }

  return variants;
}
