const VOICES_JSON_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/voices.json';
const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0';

export interface VoiceEntry {
  key: string;
  name: string;
  languageCode: string;
  languageEnglish: string;
  countryEnglish: string;
  quality: string;
  numSpeakers: number;
  files: Record<string, { size_bytes: number; md5_digest: string }>;
}

export interface VoiceCatalog {
  voices: VoiceEntry[];
  fetchedAt: number;
}

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let memCache: VoiceCatalog | null = null;

export async function fetchVoiceCatalog(forceRefresh = false): Promise<VoiceEntry[]> {
  if (!forceRefresh && memCache && Date.now() - memCache.fetchedAt < CACHE_TTL_MS) {
    return memCache.voices;
  }

  const res = await fetch(VOICES_JSON_URL);
  if (!res.ok) throw new Error(`Failed to fetch voice catalog: ${res.status}`);

  const raw = await res.json() as Record<string, {
    key: string;
    name: string;
    language: { code: string; name_english: string; country_english: string };
    quality: string;
    num_speakers: number;
    files: Record<string, { size_bytes: number; md5_digest: string }>;
  }>;

  const voices: VoiceEntry[] = Object.values(raw).map(v => ({
    key: v.key,
    name: v.name,
    languageCode: v.language.code,
    languageEnglish: v.language.name_english,
    countryEnglish: v.language.country_english,
    quality: v.quality,
    numSpeakers: v.num_speakers,
    files: v.files,
  }));

  memCache = { voices, fetchedAt: Date.now() };
  return voices;
}

export function getDownloadUrls(voice: VoiceEntry): { onnxUrl: string; jsonUrl: string; onnxPath: string; jsonPath: string } | null {
  const onnxPath = Object.keys(voice.files).find(p => p.endsWith('.onnx') && !p.endsWith('.onnx.json'));
  const jsonPath = Object.keys(voice.files).find(p => p.endsWith('.onnx.json'));
  if (!onnxPath || !jsonPath) return null;
  return {
    onnxUrl: `${HF_BASE}/${onnxPath}`,
    jsonUrl: `${HF_BASE}/${jsonPath}`,
    onnxPath,
    jsonPath,
  };
}

export function getFileSizeMB(voice: VoiceEntry): string {
  const onnxPath = Object.keys(voice.files).find(p => p.endsWith('.onnx') && !p.endsWith('.onnx.json'));
  if (!onnxPath) return '?';
  const bytes = voice.files[onnxPath]?.size_bytes ?? 0;
  return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
}

export function getUniqueLanguages(voices: VoiceEntry[]): string[] {
  const langs = new Set(voices.map(v => v.languageEnglish));
  return Array.from(langs).sort();
}
