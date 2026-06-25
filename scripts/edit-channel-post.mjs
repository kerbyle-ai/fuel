/**
 * Edit an existing Telegram channel post from a channel-posts/*.md file.
 * Strips YAML frontmatter before editMessageText — never sends metadata to API.
 *
 * Usage:
 *   node scripts/edit-channel-post.mjs --message-id=2 --file=marketing/telegram/channel-posts/00-launch-official.md
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChannelPost } from './lib/telegram-post.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

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
  const args = { messageId: null, file: null, channel: '@toplivo99' };
  for (const arg of argv) {
    if (arg.startsWith('--message-id=')) args.messageId = Number(arg.slice('--message-id='.length));
    else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length);
    else if (arg.startsWith('--channel=')) args.channel = arg.slice('--channel='.length);
  }
  return args;
}

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description ?? JSON.stringify(data)}`);
  return data.result;
}

const args = parseArgs(process.argv.slice(2));
if (!args.messageId || !args.file) {
  console.error('Usage: node scripts/edit-channel-post.mjs --message-id=2 --file=marketing/telegram/channel-posts/00-launch-official.md');
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN ?? loadEnv().TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing in .env');

const postPath = resolve(root, args.file);
const { html } = loadChannelPost(postPath, (p) => readFileSync(p, 'utf8'));

const chat = await tg(token, 'getChat', { chat_id: args.channel });
const edited = await tg(token, 'editMessageText', {
  chat_id: chat.id,
  message_id: args.messageId,
  text: html,
  parse_mode: 'HTML',
  disable_web_page_preview: false,
});

console.log(
  'editMessageText:',
  JSON.stringify({
    ok: true,
    message_id: edited.message_id,
    link: `https://t.me/${chat.username}/${edited.message_id}`,
  }),
);
