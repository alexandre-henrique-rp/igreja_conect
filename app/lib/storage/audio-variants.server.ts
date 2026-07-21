/**
 * Geração de variants (lg/md/sm) para áudio usando ffmpeg.
 *
 * **Qualidades:**
 * - lg: 192kbps (alta qualidade)
 * - md: 128kbps (padrão)
 * - sm: 64kbps (preview/economia)
 *
 * **Codec:** AAC (mp4/m4a container).
 */
import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

export const AUDIO_VARIANTS = ["lg", "md", "sm"] as const;
export type AudioVariant = (typeof AUDIO_VARIANTS)[number];

const AUDIO_PARAMS: Record<AudioVariant, { bitrate: string }> = {
  lg: { bitrate: "192k" },
  md: { bitrate: "128k" },
  sm: { bitrate: "64k" },
};

export interface GeneratedAudioVariant {
  name: AudioVariant;
  buffer: Buffer;
  contentType: string;
}

function runFfmpegAudio(input: string, output: string, bitrate: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        `-b:a ${bitrate}`,
        `-c:a aac`,
      ])
      .output(output)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export async function generateAudioVariants(
  source: Buffer,
): Promise<GeneratedAudioVariant[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffmpeg-audio-"));
  const inputPath = path.join(tmpDir, "input");
  await fs.writeFile(inputPath, source);

  const variants: GeneratedAudioVariant[] = [];

  try {
    for (const name of AUDIO_VARIANTS) {
      const params = AUDIO_PARAMS[name];
      const outputPath = path.join(tmpDir, `output-${name}.m4a`);

      await runFfmpegAudio(inputPath, outputPath, params.bitrate);

      const buffer = await fs.readFile(outputPath);
      variants.push({
        name,
        buffer,
        contentType: "audio/mp4",
      });
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  return variants;
}
