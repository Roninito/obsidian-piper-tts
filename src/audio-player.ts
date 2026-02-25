export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

type StateChangeCallback = (state: PlaybackState, chunkInfo?: { current: number; total: number }) => void;

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private queue: string[] = [];
  private currentIndex = 0;
  private state: PlaybackState = 'idle';
  private onStateChange: StateChangeCallback | null = null;
  private onChunkEnd: ((filePath: string) => void) | null = null;

  setOnStateChange(cb: StateChangeCallback): void {
    this.onStateChange = cb;
  }

  setOnChunkEnd(cb: (filePath: string) => void): void {
    this.onChunkEnd = cb;
  }

  private setState(state: PlaybackState, chunkInfo?: { current: number; total: number }): void {
    this.state = state;
    this.onStateChange?.(state, chunkInfo);
  }

  getState(): PlaybackState {
    return this.state;
  }

  async playQueue(filePaths: string[], speed = 1.0): Promise<void> {
    this.stop();
    this.queue = [...filePaths];
    this.currentIndex = 0;
    await this.playNext(speed);
  }

  private async playNext(speed: number): Promise<void> {
    if (this.currentIndex >= this.queue.length) {
      this.setState('idle');
      return;
    }

    const filePath = this.queue[this.currentIndex];
    this.setState('playing', { current: this.currentIndex + 1, total: this.queue.length });

    this.audio = new Audio(`app://local/${filePath}`);
    this.audio.playbackRate = speed;

    this.audio.onended = () => {
      const ended = this.queue[this.currentIndex] ?? "";
      this.onChunkEnd?.(ended);
      this.currentIndex++;
      this.playNext(speed);
    };

    this.audio.onerror = (e) => {
      console.error('[PiperTTS] Audio playback error:', e);
      this.currentIndex++;
      this.playNext(speed);
    };

    try {
      await this.audio.play();
    } catch (e) {
      console.error('[PiperTTS] Play failed:', e);
      this.currentIndex++;
      await this.playNext(speed);
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
      this.setState('playing', { current: this.currentIndex + 1, total: this.queue.length });
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.queue = [];
    this.currentIndex = 0;
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
