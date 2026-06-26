/**
 * One-shot: edit pinned launch post + publish URL update notice.
 * Run when api.telegram.org is reachable:
 *   node scripts/update-channel-url.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChannelPost } from './lib/telegram-post.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const CHANNEL = '@toplivo99';
const LAUNCH_MESSAGE_ID = 2;
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

const token = process.env.TELEGRAM_BOT_TOKEN ?? loadEnv().TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing in .env');

const chat = await tg(token, 'getChat', { chat_id: CHANNEL });
const launchPath = resolve(root, 'marketing/telegram/channel-posts/00-launch-official.md');
const updatePath = resolve(root, 'marketing/telegram/channel-posts/15-url-update.md');

const launch = loadChannelPost(launchPath, (p) => readFileSync(p, 'utf8'));
const edited = await tg(token, 'editMessageText', {
  chat_id: chat.id,
  message_id: LAUNCH_MESSAGE_ID,
  text: launch.html,
  parse_mode: 'HTML',
  disable_web_page_preview: false,
});

const update = loadChannelPost(updatePath, (p) => readFileSync(p, 'utf8'));
const msg = await tg(token, 'sendMessage', {
  chat_id: chat.id,
  text: update.html,
  parse_mode: 'HTML',
  disable_web_page_preview: false,
});

console.log(
  JSON.stringify(
    {
      editMessageText: {
        ok: true,
        message_id: edited.message_id,
        link: `https://t.me/${chat.username}/${edited.message_id}`,
      },
      sendMessage: {
        ok: true,
        message_id: msg.message_id,
        link: `https://t.me/${chat.username}/${msg.message_id}`,
      },
    },
    null,
    2,
  ),
);
