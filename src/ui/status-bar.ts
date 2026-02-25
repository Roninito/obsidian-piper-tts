import type { PlaybackState } from '../audio-player';

const ICONS: Record<PlaybackState, string> = {
  idle: '',
  loading: '⏳ Synthesizing…',
  playing: '🔊 Playing',
  paused: '⏸ Paused',
};

export class StatusBarWidget {
  private el: HTMLElement;
  private clickHandler: (() => void) | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    this.el.addClass('piper-tts-status');
    this.el.style.cursor = 'default';
    this.update('idle');
  }

  update(state: PlaybackState, chunkInfo?: { current: number; total: number }): void {
    const label = ICONS[state];
    if (!label) {
      this.el.setText('');
      this.el.style.cursor = 'default';
      this.el.onclick = null;
      return;
    }

    let text = label;
    if (chunkInfo && chunkInfo.total > 1) {
      text += ` (${chunkInfo.current}/${chunkInfo.total})`;
    }
    this.el.setText(text);

    if (state === 'playing' || state === 'paused') {
      this.el.style.cursor = 'pointer';
      this.el.title = state === 'playing' ? 'Click to pause' : 'Click to resume';
      this.el.onclick = () => this.clickHandler?.();
    } else {
      this.el.style.cursor = 'default';
      this.el.title = '';
      this.el.onclick = null;
    }
  }

  setClickHandler(cb: () => void): void {
    this.clickHandler = cb;
  }
}
