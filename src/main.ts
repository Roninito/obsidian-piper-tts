import { Plugin, MarkdownView, Notice, Editor } from 'obsidian';
import { PiperEngine } from './piper-engine';
import { AudioPlayer } from './audio-player';
import { StatusBarWidget } from './ui/status-bar';
import { PiperSettingsTab, DEFAULT_SETTINGS, type PiperSettings } from './settings';
import { stripMarkdown, chunkText } from './text-chunker';

export default class PiperTTSPlugin extends Plugin {
  settings!: PiperSettings;
  piperEngine!: PiperEngine;
  audioPlayer!: AudioPlayer;
  private statusBar!: StatusBarWidget;
  private isSynthesizing = false;

  async onload() {
    await this.loadSettings();

    this.piperEngine = new PiperEngine(
      this.settings.piperBinaryPath,
      this.settings.modelsDir,
    );

    this.audioPlayer = new AudioPlayer();
    this.audioPlayer.setOnStateChange((state, chunkInfo) => {
      this.statusBar?.update(state, chunkInfo);
    });
    this.audioPlayer.setOnChunkEnd((filePath) => {
      if (filePath) this.piperEngine.cleanupFile(filePath);
    });

    const statusEl = this.addStatusBarItem();
    this.statusBar = new StatusBarWidget(statusEl);
    this.statusBar.setClickHandler(() => this.audioPlayer.togglePause());

    this.addRibbonIcon('volume-2', 'Read current note (Piper TTS)', () => {
      if (this.audioPlayer.isActive()) {
        this.audioPlayer.stop();
        this.isSynthesizing = false;
      } else {
        this.readCurrentNote();
      }
    });

    this.addCommand({
      id: 'read-selection',
      name: 'Read selected text',
      editorCallback: (editor: Editor) => {
        const text = editor.getSelection();
        if (text.trim()) this.speak(text);
        else new Notice('No text selected.');
      },
    });

    this.addCommand({
      id: 'read-note',
      name: 'Read entire note',
      callback: () => this.readCurrentNote(),
    });

    this.addCommand({
      id: 'toggle-pause',
      name: 'Pause / Resume',
      callback: () => this.audioPlayer.togglePause(),
    });

    this.addCommand({
      id: 'stop-reading',
      name: 'Stop reading',
      callback: () => {
        this.audioPlayer.stop();
        this.isSynthesizing = false;
      },
    });

    this.addCommand({
      id: 'export-audio',
      name: 'Export note as WAV',
      callback: () => this.exportNoteAsAudio(),
    });

    this.addCommand({
      id: 'browse-voices',
      name: 'Browse & download voices',
      callback: () => {
        const { VoiceBrowserModal } = require('./ui/voice-browser-modal');
        new VoiceBrowserModal(this.app, this).open();
      },
    });

    this.addSettingTab(new PiperSettingsTab(this.app, this));
    console.log('[PiperTTS] Plugin loaded.');
  }

  onunload() {
    this.isSynthesizing = false;
    this.audioPlayer.stop();
    this.piperEngine.cleanupAll();
    console.log('[PiperTTS] Plugin unloaded.');
  }

  async speak(rawText: string): Promise<void> {
    if (!this.settings.voiceModel) {
      new Notice('⚠️ No voice selected. Open Settings → Piper TTS to choose a voice.');
      return;
    }

    const text = this.settings.stripMarkdown ? stripMarkdown(rawText) : rawText;
    if (!text.trim()) {
      new Notice('Nothing to read after stripping markdown.');
      return;
    }

    const chunks = chunkText(text, this.settings.chunkSize);
    if (chunks.length === 0) return;

    // Stop any current playback
    this.audioPlayer.stop();
    this.isSynthesizing = true;

    // Start streaming mode — audio will play as soon as first chunk is ready
    this.audioPlayer.startStreaming(this.settings.speed);
    this.statusBar.update('loading');

    const synthesized: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (!this.isSynthesizing) {
          // User stopped — clean up any already-synthesized files
          for (const p of synthesized) this.piperEngine.cleanupFile(p);
          return;
        }

        const filePath = await this.piperEngine.synthesize(
          chunks[i] as string,
          this.settings.voiceModel,
          this.settings.speed,
        );
        synthesized.push(filePath);

        // Hand off to audio player — it starts playing immediately on first chunk
        this.audioPlayer.addChunk(filePath, chunks.length);
      }
    } catch (e) {
      this.isSynthesizing = false;
      this.audioPlayer.stop();
      for (const p of synthesized) this.piperEngine.cleanupFile(p);
      new Notice(`❌ TTS error: ${e instanceof Error ? e.message : String(e)}`);
      this.statusBar.update('idle');
    } finally {
      this.isSynthesizing = false;
    }
  }

  private async readCurrentNote(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice('No active note.');
      return;
    }
    await this.speak(view.getViewData());
  }

  private async exportNoteAsAudio(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) { new Notice('No active note.'); return; }
    if (!this.settings.voiceModel) { new Notice('⚠️ No voice selected.'); return; }

    const rawText = view.getViewData();
    const text = this.settings.stripMarkdown ? stripMarkdown(rawText) : rawText;
    if (!text.trim()) { new Notice('Nothing to export.'); return; }

    new Notice('⏳ Exporting audio…');

    try {
      const { join } = require('path');
      const { writeFileSync, readFileSync } = require('fs');
      const fileName = `${view.file?.basename ?? 'export'}.wav`;
      const adapter = this.app.vault.adapter as any;
      const destPath = join(adapter.getBasePath(), fileName);

      // Synthesize as single block for export
      const allText = chunkText(text, 5000).join(' ');
      const tmpPath = await this.piperEngine.synthesize(allText, this.settings.voiceModel, this.settings.speed);
      writeFileSync(destPath, readFileSync(tmpPath));
      this.piperEngine.cleanupFile(tmpPath);

      new Notice(`✅ Exported to vault root: ${fileName}`);
    } catch (e) {
      new Notice(`❌ Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.piperEngine?.updatePaths(this.settings.piperBinaryPath, this.settings.modelsDir);
  }
}
