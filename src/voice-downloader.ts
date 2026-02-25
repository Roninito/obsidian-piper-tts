import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import type { VoiceEntry } from './voice-catalog';
import { getDownloadUrls } from './voice-catalog';

export type DownloadProgress = { bytes: number; total: number; percent: number };

export async function downloadVoice(
  voice: VoiceEntry,
  modelsDir: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  const urls = getDownloadUrls(voice);
  if (!urls) throw new Error(`Cannot resolve download URLs for ${voice.key}`);

  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true });
  }

  const onnxDest = join(modelsDir, voice.key + '.onnx');
  const jsonDest = join(modelsDir, voice.key + '.onnx.json');

  await downloadFile(urls.onnxUrl, onnxDest, voice.files[urls.onnxPath]?.size_bytes ?? 0, onProgress);
  await downloadFile(urls.jsonUrl, jsonDest, 0);
}

async function downloadFile(
  url: string,
  dest: string,
  totalBytes: number,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  if (!res.body) throw new Error('No response body');

  const total = totalBytes || parseInt(res.headers.get('content-length') ?? '0', 10);
  let bytes = 0;

  const outStream = createWriteStream(dest);
  const reader = res.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      outStream.write(value);
      bytes += value.length;
      if (onProgress && total > 0) {
        onProgress({ bytes, total, percent: Math.round((bytes / total) * 100) });
      }
    }
    await new Promise<void>((resolve, reject) => {
      outStream.end(resolve);
      outStream.on('error', reject);
    });
  } finally {
    reader.releaseLock();
  }
}

export function isVoiceInstalled(voiceKey: string, modelsDir: string): boolean {
  return (
    existsSync(join(modelsDir, voiceKey + '.onnx')) &&
    existsSync(join(modelsDir, voiceKey + '.onnx.json'))
  );
}
