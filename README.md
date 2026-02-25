# Obsidian Piper TTS

Text-to-speech for your Obsidian notes using the local [Piper TTS](https://github.com/rhasspy/piper) engine.

## Features

- 🔊 **Read selected text** or the **entire note** aloud
- 🎙️ **200+ voices** — browse, preview and download directly from within Obsidian
- ⚙️ Configurable **speech speed** and **markdown stripping**
- 💾 **Export notes as WAV** audio files to your vault
- ⌨️ Fully mapped **hotkeys** for all commands
- 📊 **Status bar** shows playback state; click to pause/resume
- 🖥️ **Desktop only** — requires the Piper binary installed locally

## Requirements

- [Piper TTS](https://github.com/rhasspy/piper/releases) binary installed on your system
- macOS, Linux, or Windows (x64/ARM)

## Installation

### Via Community Plugins (recommended)

1. Open **Settings → Community Plugins → Browse**
2. Search for **"Piper TTS"**
3. Click **Install**, then **Enable**

### Manual

1. Download the latest release from the [Releases](../../releases) page
2. Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/obsidian-piper-tts/`
3. Reload Obsidian and enable the plugin

## Setup

1. Open **Settings → Piper TTS**
2. Set the **Piper binary path** (default: `~/.local/bin/piper`)
3. Set the **Voice models directory** (default: `~/.local/share/piper`)
4. Click **Browse Voices** to find and download a voice
5. Click **Test** to verify your piper installation

## Usage

| Command | Default Hotkey | Description |
|---------|---------------|-------------|
| Read selected text | — | Synthesizes the current selection |
| Read entire note | — | Synthesizes the active note |
| Pause / Resume | — | Toggles playback |
| Stop reading | — | Stops and clears queue |
| Export note as WAV | — | Saves audio to vault |
| Browse & download voices | — | Opens the voice browser |

You can assign hotkeys in **Settings → Hotkeys → Piper TTS**.

## Voice Browser

Click **Browse Voices** in settings (or use the command palette) to open the voice browser:

- **Search** by voice name or language
- **Filter** by language and quality tier
- **Preview** any voice before downloading
- **Download** voices with a real-time progress indicator
- **Set as Default** for a downloaded voice

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Piper binary path | `~/.local/bin/piper` | Path to the piper executable |
| Voice models directory | `~/.local/share/piper` | Where .onnx model files are stored |
| Active voice | — | Voice used for synthesis |
| Speech speed | 1.0 | Speed multiplier (0.5–2.0) |
| Strip markdown | true | Remove headings, bold, links before TTS |
| Chunk size | 500 | Characters per synthesis chunk |

## Troubleshooting

**"No voice selected"** — Open Settings and either select an installed voice or use Browse Voices to download one.

**"Could not run piper"** — Check the binary path in settings. Run `which piper` in your terminal to find it.

**Audio doesn't play** — Ensure Obsidian has audio permission. Try restarting Obsidian.

## License

MIT — see [LICENSE](LICENSE)
