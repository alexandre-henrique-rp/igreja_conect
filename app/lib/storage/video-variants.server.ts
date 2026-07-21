/**
 * Geração de variants (lg/md/sm) para vídeos usando ffmpeg.
 *
 * **Resoluções:**
 * - lg: 720p (1280x720)
 * - md: 480p (854x480)
 * - sm: 240p (426x240) — preview/thumbnail
 *
 * **Codec:** H.264 video + AAC audio (mp4 container).
 * Bitrate adaptativo por resolução.
 */
import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

export const VIDEO_VARIANTS = ["lg", "md", "sm"] as const;
export type VideoVariant = (typeof VIDEO_VARIANTS)[number];

const VIDEO_PARAMS: Record<VideoVariant, { width: number; videoBitrate: string; audioBitrate: string }> = {
  lg: { width: 1280, videoBitrate: "2000k", audioBitrate: "128k" },
  md: { width: 854, videoBitrate: "1000k", audioBitrate: "96k" },
  sm: { width: 426, videoBitrate: "400k", audioBitrate: "64k" },
};

export interface GeneratedVideoVariant {
  name: VideoVariant;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

function runFfmpeg(input: string, output: string, params: { width: number; videoBitrate: string; audioBitrate: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        `-vf scale=${params.width}:-2`,
        `-b:v ${params.videoBitrate}`,
        `-b:a ${params.audioBitrate}`,
        `-c:v libx264`,
        `-c:a aac`,
        `-preset fast`,
        `-movflags +faststart`,
      ])
      .output(output)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export async function generateVideoVariants(
  source: Buffer,
): Promise<GeneratedVideoVariant[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffmpeg-"));
  const inputPath = path.join(tmpDir, "input");
  await fs.writeFile(inputPath, source);

  const variants: GeneratedVideoVariant[] = [];

  try {
    for (const name of VIDEO_VARIANTS) {
      const params = VIDEO_PARAMS[name];
      const outputPath = path.join(tmpDir, `output-${name}.mp4`);

      await runFfmpeg(inputPath, outputPath, params);

      const buffer = await fs.readFile(outputPath);
      variants.push({
        name,
        buffer,
        contentType: "video/mp4",
        width: params.width,
        height: Math.round(params.width * 9 / 16),
      });
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  return variants;
}
