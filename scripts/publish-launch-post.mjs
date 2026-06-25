/**
 * Publish launch post to @toplivo99 from channel-posts/*.md.
 * YAML frontmatter is stripped before sendMessage — never published to Telegram.
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

const token = process.env.TELEGRAM_BOT_TOKEN ?? loadEnv().TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing in .env');

const postPath = resolve(root, 'marketing/telegram/channel-posts/00-launch-official.md');
const { html } = loadChannelPost(postPath, (p) => readFileSync(p, 'utf8'));

const me = await tg(token, 'getMe', {});
console.log('getMe:', JSON.stringify({ id: me.id, username: me.username, first_name: me.first_name }));

const chat = await tg(token, 'getChat', { chat_id: '@toplivo99' });
console.log('getChat:', JSON.stringify({ id: chat.id, title: chat.title, username: chat.username, type: chat.type }));

const msg = await tg(token, 'sendMessage', {
  chat_id: chat.id,
  text: html,
  parse_mode: 'HTML',
  disable_web_page_preview: false,
});

console.log('sendMessage:', JSON.stringify({ message_id: msg.message_id, link: `https://t.me/toplivo99/${msg.message_id}` }));

const pinned = await tg(token, 'pinChatMessage', {
  chat_id: chat.id,
  message_id: msg.message_id,
  disable_notification: false,
});

console.log('pinChatMessage:', JSON.stringify({ ok: true, pinned }));
console.log('CHANNEL_ID:', chat.id);
