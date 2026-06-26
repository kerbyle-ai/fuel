/**
 * Publish any channel-posts/*.md to @toplivo99.
 * YAML frontmatter is stripped before sendMessage.
 *
 * Usage:
 *   node scripts/publish-channel-post.mjs --file=marketing/telegram/channel-posts/15-url-update.md
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChannelPost } from './lib/telegram-post.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const FETCH_TIMEOUT_MS = 120_000;

function loadEnv() {
  const env = {};
  for (const rawLine of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const args = { file: null, channel: '@toplivo99', pin: false };
  for (const arg of argv) {
    if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length);
    else if (arg.startsWith('--channel=')) args.channel = arg.slice('--channel='.length);
    else if (arg === '--pin') args.pin = true;
  }
  return args;
}

async function tg(token, method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`${method}: ${data.description ?? JSON.stringify(data)}`);
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error('Usage: node scripts/publish-channel-post.mjs --file=marketing/telegram/channel-posts/15-url-update.md');
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN ?? loadEnv().TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing in .env');

const postPath = resolve(root, args.file);
const { html } = loadChannelPost(postPath, (p) => readFileSync(p, 'utf8'));

const chat = await tg(token, 'getChat', { chat_id: args.channel });
const msg = await tg(token, 'sendMessage', {
  chat_id: chat.id,
  text: html,
  parse_mode: 'HTML',
  disable_web_page_preview: false,
});

console.log('sendMessage:', JSON.stringify({ message_id: msg.message_id, link: `https://t.me/${chat.username}/${msg.message_id}` }));

if (args.pin) {
  const pinned = await tg(token, 'pinChatMessage', {
    chat_id: chat.id,
    message_id: msg.message_id,
    disable_notification: false,
  });
  console.log('pinChatMessage:', JSON.stringify({ ok: true, pinned }));
}
