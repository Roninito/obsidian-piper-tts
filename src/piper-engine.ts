import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readdirSync, existsSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

export interface VoiceMeta {
  key: string;
  modelPath: string;
  configPath: string;
}

export class PiperEngine {
  private binaryPath: string;
  private modelsDir: string;
  private tempFiles: Set<string> = new Set();

  constructor(binaryPath: string, modelsDir: string) {
    this.binaryPath = binaryPath;
    this.modelsDir = modelsDir;
  }

  getInstalledVoices(): string[] {
    if (!existsSync(this.modelsDir)) return [];
    try {
      return readdirSync(this.modelsDir)
        .filter(f => f.endsWith('.onnx') && !f.endsWith('.onnx.json'))
        .map(f => f.replace('.onnx', ''))
        .sort();
    } catch {
      return [];
    }
  }

  getVoiceMeta(key: string): VoiceMeta | null {
    const modelPath = join(this.modelsDir, key + '.onnx');
    const configPath = join(this.modelsDir, key + '.onnx.json');
    if (!existsSync(modelPath) || !existsSync(configPath)) return null;
    return { key, modelPath, configPath };
  }

  async synthesize(text: string, voiceKey: string, speed = 1.0): Promise<string> {
    const meta = this.getVoiceMeta(voiceKey);
    if (!meta) throw new Error(`Voice not found: ${voiceKey}`);

    const outFile = join(tmpdir(), `piper-tts-${randomUUID()}.wav`);
    this.tempFiles.add(outFile);

    // length_scale is inverse of speed (1.0 = normal, 0.5 = 2x faster)
    const lengthScale = (1.0 / speed).toFixed(2);

    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        this.binaryPath,
        ['-m', meta.modelPath, '-c', meta.configPath, '-f', outFile, '--length-scale', lengthScale],
        { timeout: 60000 },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
      proc.stdin?.write(text);
      proc.stdin?.end();
    });

    return outFile;
  }

  cleanupFile(filePath: string): void {
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch { /* ignore */ }
    this.tempFiles.delete(filePath);
  }

  cleanupAll(): void {
    for (const f of this.tempFiles) {
      this.cleanupFile(f);
    }
  }

  async testBinary(): Promise<boolean> {
    return new Promise(resolve => {
      execFile(this.binaryPath, ['--help'], { timeout: 5000 }, (err) => {
        resolve(!err || err.code !== 'ENOENT');
      });
    });
  }

  updatePaths(binaryPath: string, modelsDir: string): void {
    this.binaryPath = binaryPath;
    this.modelsDir = modelsDir;
  }
}
