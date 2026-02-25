import { Modal, App, Notice, Setting } from 'obsidian';
import type PiperTTSPlugin from '../main';
import { fetchVoiceCatalog, getFileSizeMB, getUniqueLanguages, type VoiceEntry } from '../voice-catalog';
import { downloadVoice, isVoiceInstalled } from '../voice-downloader';

export class VoiceBrowserModal extends Modal {
  private plugin: PiperTTSPlugin;
  private voices: VoiceEntry[] = [];
  private filtered: VoiceEntry[] = [];
  private searchQuery = '';
  private filterLang = '';
  private filterQuality = '';
  private listEl: HTMLElement | null = null;
  private previewAudio: HTMLAudioElement | null = null;
  private downloadingKeys: Set<string> = new Set();

  constructor(app: App, plugin: PiperTTSPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass('piper-voice-browser');
    contentEl.createEl('h2', { text: '🎙 Piper Voice Browser' });

    // Filter bar
    const filterBar = contentEl.createDiv({ cls: 'piper-filter-bar' });

    const searchEl = filterBar.createEl('input', {
      type: 'text',
      placeholder: 'Search voices…',
      cls: 'piper-search-input',
    });
    searchEl.oninput = () => {
      this.searchQuery = searchEl.value.toLowerCase();
      this.renderList();
    };

    const langSelect = filterBar.createEl('select', { cls: 'piper-filter-select' });
    const qualitySelect = filterBar.createEl('select', { cls: 'piper-filter-select' });

    langSelect.createEl('option', { value: '', text: 'All languages' });
    qualitySelect.createEl('option', { value: '', text: 'All qualities' });
    for (const q of ['x_low', 'low', 'medium', 'high']) {
      qualitySelect.createEl('option', { value: q, text: q });
    }

    langSelect.onchange = () => { this.filterLang = langSelect.value; this.renderList(); };
    qualitySelect.onchange = () => { this.filterQuality = qualitySelect.value; this.renderList(); };

    // List container
    const loading = contentEl.createEl('p', { text: '⏳ Loading voice catalog…', cls: 'piper-loading' });
    this.listEl = contentEl.createDiv({ cls: 'piper-voice-list' });

    // Styles
    this.injectStyles(contentEl);

    try {
      this.voices = await fetchVoiceCatalog();
      loading.remove();

      // Populate language filter
      for (const lang of getUniqueLanguages(this.voices)) {
        langSelect.createEl('option', { value: lang, text: lang });
      }

      this.renderList();
    } catch (e) {
      loading.setText('❌ Failed to load catalog. Check your internet connection.');
      console.error(e);
    }
  }

  private renderList() {
    if (!this.listEl) return;
    this.listEl.empty();

    this.filtered = this.voices.filter(v => {
      if (this.filterLang && v.languageEnglish !== this.filterLang) return false;
      if (this.filterQuality && v.quality !== this.filterQuality) return false;
      if (this.searchQuery) {
        const haystack = `${v.key} ${v.name} ${v.languageEnglish} ${v.countryEnglish}`.toLowerCase();
        if (!haystack.includes(this.searchQuery)) return false;
      }
      return true;
    });

    if (this.filtered.length === 0) {
      this.listEl.createEl('p', { text: 'No voices match your filters.', cls: 'piper-empty' });
      return;
    }

    for (const voice of this.filtered) {
      this.renderVoiceRow(voice);
    }
  }

  private renderVoiceRow(voice: VoiceEntry) {
    if (!this.listEl) return;
    const installed = isVoiceInstalled(voice.key, this.plugin.settings.modelsDir);
    const isActive = this.plugin.settings.voiceModel === voice.key;

    const row = this.listEl.createDiv({ cls: 'piper-voice-row' + (isActive ? ' piper-voice-active' : '') });

    const info = row.createDiv({ cls: 'piper-voice-info' });
    info.createEl('span', { text: voice.key, cls: 'piper-voice-key' });
    info.createEl('span', { text: ` · ${voice.languageEnglish} (${voice.countryEnglish})`, cls: 'piper-voice-lang' });
    info.createEl('span', { text: ` · ${voice.quality}`, cls: `piper-quality piper-quality-${voice.quality}` });
    if (voice.numSpeakers > 1) info.createEl('span', { text: ` · ${voice.numSpeakers} speakers`, cls: 'piper-voice-meta' });
    info.createEl('span', { text: ` · ${getFileSizeMB(voice)}`, cls: 'piper-voice-meta' });
    if (installed) info.createEl('span', { text: ' ✓ Installed', cls: 'piper-installed-badge' });

    const actions = row.createDiv({ cls: 'piper-voice-actions' });

    // Preview button
    const previewBtn = actions.createEl('button', { text: '▶ Preview', cls: 'piper-btn' });
    previewBtn.onclick = () => this.previewVoice(voice, previewBtn);

    // Download / Set default buttons
    if (installed) {
      const setBtn = actions.createEl('button', {
        text: isActive ? '✓ Active' : 'Set Default',
        cls: 'piper-btn' + (isActive ? ' piper-btn-active' : ' piper-btn-cta'),
      });
      setBtn.disabled = isActive;
      setBtn.onclick = async () => {
        this.plugin.settings.voiceModel = voice.key;
        await this.plugin.saveSettings();
        new Notice(`Voice set to: ${voice.key}`);
        this.renderList();
      };
    } else {
      const downloading = this.downloadingKeys.has(voice.key);
      const dlBtn = actions.createEl('button', {
        text: downloading ? '⬇ Downloading…' : '⬇ Download',
        cls: 'piper-btn piper-btn-cta',
      });
      dlBtn.disabled = downloading;
      if (!downloading) {
        dlBtn.onclick = () => this.downloadVoice(voice, dlBtn);
      }
    }
  }

  private async previewVoice(voice: VoiceEntry, btn: HTMLButtonElement) {
    // Stop any playing preview
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }

    const installed = isVoiceInstalled(voice.key, this.plugin.settings.modelsDir);

    if (!installed) {
      new Notice(`Downloading ${voice.key} for preview…`);
      btn.setText('⬇ Downloading…');
      btn.disabled = true;
      try {
        await downloadVoice(voice, this.plugin.settings.modelsDir);
        this.renderList();
      } catch (e) {
        new Notice(`❌ Download failed: ${e}`);
        btn.setText('▶ Preview');
        btn.disabled = false;
        return;
      }
    }

    btn.setText('⏳ Synthesizing…');
    btn.disabled = true;

    try {
      const sampleText = `Hello! This is the ${voice.name} voice from Piper TTS.`;
      const filePath = await this.plugin.piperEngine!.synthesize(sampleText, voice.key, 1.0);

      this.previewAudio = new Audio(`app://local/${filePath}`);
      this.previewAudio.onended = () => {
        this.plugin.piperEngine!.cleanupFile(filePath);
        btn.setText('▶ Preview');
        btn.disabled = false;
      };
      this.previewAudio.onerror = () => {
        btn.setText('▶ Preview');
        btn.disabled = false;
      };
      await this.previewAudio.play();
      btn.setText('⏹ Stop');
      btn.onclick = () => {
        this.previewAudio?.pause();
        this.previewAudio = null;
        btn.setText('▶ Preview');
        btn.disabled = false;
        btn.onclick = () => this.previewVoice(voice, btn);
      };
    } catch (e) {
      new Notice(`❌ Preview failed: ${e}`);
      btn.setText('▶ Preview');
      btn.disabled = false;
    }
  }

  private async downloadVoice(voice: VoiceEntry, btn: HTMLButtonElement) {
    this.downloadingKeys.add(voice.key);
    btn.setText('⬇ 0%');
    btn.disabled = true;

    try {
      await downloadVoice(voice, this.plugin.settings.modelsDir, (progress) => {
        btn.setText(`⬇ ${progress.percent}%`);
      });
      new Notice(`✅ Downloaded: ${voice.key}`);
      this.downloadingKeys.delete(voice.key);
      this.renderList();
    } catch (e) {
      new Notice(`❌ Download failed: ${e}`);
      this.downloadingKeys.delete(voice.key);
      btn.setText('⬇ Download');
      btn.disabled = false;
    }
  }

  private injectStyles(el: HTMLElement) {
    const style = el.createEl('style');
    style.textContent = `
      .piper-voice-browser { max-width: 800px; }
      .piper-filter-bar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .piper-search-input { flex: 1; min-width: 160px; padding: 4px 8px; }
      .piper-filter-select { padding: 4px 8px; }
      .piper-voice-list { max-height: 60vh; overflow-y: auto; }
      .piper-voice-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px; border-bottom: 1px solid var(--background-modifier-border); gap: 8px; }
      .piper-voice-row.piper-voice-active { background: var(--background-secondary); border-radius: 4px; }
      .piper-voice-info { flex: 1; font-size: 0.88em; }
      .piper-voice-key { font-weight: 600; }
      .piper-voice-lang, .piper-voice-meta { color: var(--text-muted); }
      .piper-quality { font-size: 0.8em; padding: 1px 5px; border-radius: 3px; }
      .piper-quality-high { background: var(--color-green); color: #fff; }
      .piper-quality-medium { background: var(--color-blue); color: #fff; }
      .piper-quality-low, .piper-quality-x_low { background: var(--background-modifier-border); }
      .piper-installed-badge { color: var(--color-green); font-weight: 600; }
      .piper-voice-actions { display: flex; gap: 6px; flex-shrink: 0; }
      .piper-btn { padding: 3px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85em; }
      .piper-btn-cta { background: var(--interactive-accent); color: var(--text-on-accent); }
      .piper-btn-active { opacity: 0.6; }
      .piper-empty, .piper-loading { color: var(--text-muted); text-align: center; padding: 24px; }
    `;
  }

  onClose() {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }
    this.contentEl.empty();
  }
}
