/**
 * Channel post helpers for Telegram publishing.
 *
 * RULE: YAML frontmatter (--- ... ---) is internal metadata only.
 * It must NEVER appear in sendMessage / editMessageText payloads.
 */

/**
 * @param {string} raw Full markdown file contents
 * @returns {{ frontmatter: Record<string, string> | null, body: string }}
 */
export function parseChannelPost(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: null, body: text.trim() };
  }

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body: text.slice(match[0].length).trim() };
}

/**
 * @param {string} raw
 * @returns {string} Publish-ready body without YAML frontmatter
 */
export function stripYamlFrontmatter(raw) {
  return parseChannelPost(raw).body;
}

/**
 * @param {string} text Markdown body (already stripped)
 * @returns {string} Telegram HTML
 */
export function mdToHtml(text) {
  const urlPlaceholders = [];
  const withUrls = text.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const key = `__URL_${urlPlaceholders.length}__`;
    urlPlaceholders.push(`<a href="${url}">${url}</a>`);
    return key;
  });

  const lines = withUrls.split('\n');
  const out = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '---') {
      out.push('<i>—</i>');
      continue;
    }
    if (!line.trim()) {
      out.push('');
      continue;
    }

    let html = line
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/@Toplivo_map_bot/g, '<a href="https://t.me/Toplivo_map_bot">@Toplivo_map_bot</a>')
      .replace(/@toplivo99/g, '<a href="https://t.me/toplivo99">@toplivo99</a>');

    out.push(html);
  }

  let result = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  urlPlaceholders.forEach((link, i) => {
    result = result.replace(`__URL_${i}__`, link);
  });
  return result;
}

/**
 * @param {string} filePath
 * @param {() => string} readFile
 * @returns {{ body: string, html: string, frontmatter: Record<string, string> | null }}
 */
export function loadChannelPost(filePath, readFile) {
  const raw = readFile(filePath);
  const { frontmatter, body } = parseChannelPost(raw);
  const publishBody = body.replace(/^<!--[\s\S]*?-->\s*/m, '');
  return { frontmatter, body: publishBody, html: mdToHtml(publishBody) };
}
