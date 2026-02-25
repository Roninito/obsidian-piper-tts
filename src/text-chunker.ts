/**
 * Strips Obsidian/markdown syntax from text before TTS synthesis,
 * then splits into sentence-level chunks for low-latency streaming.
 */
export function stripMarkdown(text: string): string {
return text
// Remove frontmatter
.replace(/^---[\s\S]*?---\n?/, '')
// Remove headings
.replace(/^#{1,6}\s+/gm, '')
// Remove bold/italic
.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
// Remove inline code
.replace(/`[^`]+`/g, '')
// Remove code blocks
.replace(/```[\s\S]*?```/g, '')
// Remove links — keep display text
.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
// Remove wiki links — keep display text
.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, target, alias) => alias || target)
// Remove images
.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
// Remove horizontal rules
.replace(/^---+$/gm, '')
// Remove blockquote markers
.replace(/^>\s?/gm, '')
// Remove list markers
.replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, '')
// Remove HTML tags
.replace(/<[^>]+>/g, '')
// Collapse multiple blank lines
.replace(/\n{3,}/g, '\n\n')
.trim();
}

/**
 * Splits plain text into chunks of at most `maxChars` characters,
 * preferring sentence boundaries.
 */
export function chunkText(text: string, maxChars = 500): string[] {
if (!text.trim()) return [];

// Split on sentence-ending punctuation followed by whitespace
const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [text];
const chunks: string[] = [];
let current = '';

for (const sentence of sentences) {
const s = sentence.trim();
if (!s) continue;

if (current.length + s.length + 1 > maxChars && current.length > 0) {
chunks.push(current.trim());
current = s;
} else {
current = current ? `${current} ${s}` : s;
}
}

if (current.trim()) {
chunks.push(current.trim());
}

return chunks;
}
