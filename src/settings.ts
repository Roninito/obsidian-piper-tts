import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type PiperTTSPlugin from './main';
import { VoiceBrowserModal } from './ui/voice-browser-modal';

export interface PiperSettings {
piperBinaryPath: string;
modelsDir: string;
voiceModel: string;
speed: number;
autoPlayOnSelect: boolean;
exportFormat: 'wav';
stripMarkdown: boolean;
chunkSize: number;
}

export const DEFAULT_SETTINGS: PiperSettings = {
piperBinaryPath: `${process.env.HOME}/.local/bin/piper`,
modelsDir: `${process.env.HOME}/.local/share/piper`,
voiceModel: '',
speed: 1.0,
autoPlayOnSelect: false,
exportFormat: 'wav',
stripMarkdown: true,
chunkSize: 500,
};

export class PiperSettingsTab extends PluginSettingTab {
plugin: PiperTTSPlugin;

constructor(app: App, plugin: PiperTTSPlugin) {
super(app, plugin);
this.plugin = plugin;
}

display(): void {
const { containerEl } = this;
containerEl.empty();
containerEl.createEl('h2', { text: 'Piper TTS Settings' });

new Setting(containerEl)
.setName('Piper binary path')
.setDesc('Full path to the piper executable')
.addText(text =>
text
.setPlaceholder('/usr/local/bin/piper')
.setValue(this.plugin.settings.piperBinaryPath)
.onChange(async (value) => {
this.plugin.settings.piperBinaryPath = value.trim();
await this.plugin.saveSettings();
})
);

new Setting(containerEl)
.setName('Voice models directory')
.setDesc('Directory containing .onnx voice model files')
.addText(text =>
text
.setPlaceholder('~/.local/share/piper')
.setValue(this.plugin.settings.modelsDir)
.onChange(async (value) => {
this.plugin.settings.modelsDir = value.trim();
await this.plugin.saveSettings();
this.display();
})
);

const installedVoices = this.plugin.piperEngine?.getInstalledVoices() ?? [];
const voiceSetting = new Setting(containerEl)
.setName('Active voice')
.setDesc('Voice model used for synthesis');

if (installedVoices.length === 0) {
voiceSetting.addText(text =>
text.setPlaceholder('No voices found — use Browse Voices').setDisabled(true)
);
} else {
voiceSetting.addDropdown(drop => {
if (!installedVoices.includes(this.plugin.settings.voiceModel)) {
drop.addOption('', '— select a voice —');
}
for (const v of installedVoices) {
drop.addOption(v, v);
}
drop.setValue(this.plugin.settings.voiceModel);
drop.onChange(async (value) => {
this.plugin.settings.voiceModel = value;
await this.plugin.saveSettings();
});
});
}

new Setting(containerEl)
.setName('Browse & download voices')
.setDesc('Explore 200+ voices, preview them, and download to your models directory')
.addButton(btn =>
btn
.setButtonText('Browse Voices')
.setCta()
.onClick(() => {
new VoiceBrowserModal(this.app, this.plugin).open();
})
);

containerEl.createEl('h3', { text: 'Playback' });

new Setting(containerEl)
.setName('Speech speed')
.setDesc('Playback speed multiplier (0.5 – 2.0)')
.addSlider(slider =>
slider
.setLimits(0.5, 2.0, 0.1)
.setValue(this.plugin.settings.speed)
.setDynamicTooltip()
.onChange(async (value) => {
this.plugin.settings.speed = value;
await this.plugin.saveSettings();
})
);

new Setting(containerEl)
.setName('Strip markdown formatting')
.setDesc('Remove headings, bold, links etc. before synthesizing')
.addToggle(toggle =>
toggle
.setValue(this.plugin.settings.stripMarkdown)
.onChange(async (value) => {
this.plugin.settings.stripMarkdown = value;
await this.plugin.saveSettings();
})
);

new Setting(containerEl)
.setName('Chunk size (characters)')
.setDesc('Max characters per synthesis chunk — smaller = lower latency')
.addSlider(slider =>
slider
.setLimits(100, 1500, 50)
.setValue(this.plugin.settings.chunkSize)
.setDynamicTooltip()
.onChange(async (value) => {
this.plugin.settings.chunkSize = value;
await this.plugin.saveSettings();
})
);

containerEl.createEl('h3', { text: 'Diagnostics' });

new Setting(containerEl)
.setName('Test piper binary')
.setDesc('Verify the configured piper binary is reachable')
.addButton(btn =>
btn.setButtonText('Test').onClick(async () => {
const ok = await this.plugin.piperEngine?.testBinary();
new Notice(ok ? '✅ Piper binary found and working!' : '❌ Could not run piper — check the binary path.');
})
);
}
}
