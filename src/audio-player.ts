import { readFileSync } from 'fs';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

type StateChangeCallback = (state: PlaybackState, chunkInfo?: { current: number; total: number }) => void;

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private queue: string[] = [];      // file paths waiting to play
  private totalChunks = 0;
  private currentIndex = 0;
  private state: PlaybackState = 'idle';
  private speed = 1.0;
  private onStateChange: StateChangeCallback | null = null;
  private onChunkEnd: ((filePath: string) => void) | null = null;
  private currentObjectUrl: string | null = null;

  setOnStateChange(cb: StateChangeCallback): void { this.onStateChange = cb; }
  setOnChunkEnd(cb: (filePath: string) => void): void { this.onChunkEnd = cb; }

  private setState(state: PlaybackState, chunkInfo?: { current: number; total: number }): void {
    this.state = state;
    this.onStateChange?.(state, chunkInfo);
  }

  getState(): PlaybackState { return this.state; }

  /** Start playing a list of WAV file paths. */
  async playQueue(filePaths: string[], speed = 1.0): Promise<void> {
    this.stop();
    this.queue = [...filePaths];
    this.totalChunks = filePaths.length;
    this.currentIndex = 0;
    this.speed = speed;
    this.playNext();
  }

  /** Append a file path to the queue while playback is in progress. */
  enqueue(filePath: string): void {
    this.queue.push(filePath);
  }

  /** Start playing from nothing with a streaming approach. */
  startStreaming(speed = 1.0): void {
    this.stop();
    this.queue = [];
    this.totalChunks = 0;
    this.currentIndex = 0;
    this.speed = speed;
    this.setState('loading');
  }

  /** Call when a new chunk WAV is ready while streaming. */
  addChunk(filePath: string, total: number): void {
    this.totalChunks = total;
    this.queue.push(filePath);
    // If we're in 'loading' state, start playing immediately
    if (this.state === 'loading' || this.state === 'idle') {
      this.playNext();
    }
  }

  private playNext(): void {
    if (this.currentIndex >= this.queue.length) {
      this.setState('idle');
      return;
    }

    const filePath = this.queue[this.currentIndex];
    if (!filePath) { this.setState('idle'); return; }
    this.setState('playing', { current: this.currentIndex + 1, total: this.totalChunks || this.queue.length });

    // Convert WAV file to blob URL — works reliably in Electron without URL scheme issues
    let objectUrl: string;
    try {
      const buf = readFileSync(filePath);
      const blob = new Blob([buf], { type: 'audio/wav' });
      objectUrl = URL.createObjectURL(blob);
      this.revokeCurrentObjectUrl();
      this.currentObjectUrl = objectUrl;
    } catch (e) {
      console.error('[PiperTTS] Failed to read WAV file:', filePath, e);
      this.onChunkEnd?.(filePath);
      this.currentIndex++;
      this.playNext();
      return;
    }

    this.audio = new Audio(objectUrl);
    this.audio.playbackRate = this.speed;

    this.audio.onended = () => {
      const ended = this.queue[this.currentIndex] ?? '';
      this.onChunkEnd?.(ended);
      this.revokeCurrentObjectUrl();
      this.currentIndex++;
      this.playNext();
    };

    this.audio.onerror = (e) => {
      console.error('[PiperTTS] Audio playback error:', e);
      this.onChunkEnd?.(this.queue[this.currentIndex] ?? '');
      this.revokeCurrentObjectUrl();
      this.currentIndex++;
      this.playNext();
    };

    this.audio.play().catch(e => {
      console.error('[PiperTTS] play() rejected:', e);
      this.onChunkEnd?.(this.queue[this.currentIndex] ?? '');
      this.revokeCurrentObjectUrl();
      this.currentIndex++;
      this.playNext();
    });
  }

  private revokeCurrentObjectUrl(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  pause(): void {
    if (this.audio && this.state === 'playing') {
      this.audio.pause();
      this.setState('paused');
    }
  }

  resume(): void {
    if (this.audio && this.state === 'paused') {
      this.audio.play();
      this.setState('playing', { current: this.currentIndex + 1, total: this.totalChunks });
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.revokeCurrentObjectUrl();
    this.queue = [];
    this.currentIndex = 0;
    this.totalChunks = 0;
    this.setState('idle');
  }

  togglePause(): void {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  isActive(): boolean {
    return this.state === 'playing' || this.state === 'paused' || this.state === 'loading';
  }
}
