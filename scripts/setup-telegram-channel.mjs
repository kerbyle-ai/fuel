import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChannelPost } from './lib/telegram-post.mjs';

const FETCH_TIMEOUT_MS = 60_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const CHANNEL = '@toplivo99';

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function loadEnv() {
  const envPath = resolve(root, '.env');
  const env = {};
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { env, envPath, lines: readFileSync(envPath, 'utf8') };
}

function saveEnvChannelId(envPath, content, channelId) {
  const key = 'TELEGRAM_NOTIFY_CHANNEL_ID';
  const value = String(channelId);
  if (content.includes(`${key}=`)) {
    return content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
  }
  const marker = '# TELEGRAM_NOTIFY_CHANNEL_ID=';
  if (content.includes(marker)) {
    return content.replace(marker, `${key}=${value}`);
  }
  return content.trimEnd() + `\n${key}=${value}\n`;
}

async function tgJson(token, method, body) {
  const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description ?? JSON.stringify(data)}`);
  return data.result;
}

async function setChatPhoto(token, chatId, photoPath) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  const bytes = readFileSync(photoPath);
  form.append('photo', new Blob([bytes], { type: 'image/png' }), 'icon-512.png');

  const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/setChatPhoto`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`setChatPhoto: ${data.description ?? JSON.stringify(data)}`);
  return data.result;
}

function isLaunchPost(text = '') {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('карту топлива') ||
    normalized.includes('карта топлива') ||
    normalized.includes('запускаем')
  );
}

const { env, envPath } = loadEnv();
const token = process.env.TELEGRAM_BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing in .env');

const iconCandidates = [
  resolve(root, 'marketing/assets/bot-profile-512.png'),
  resolve(root, 'frontend/public/icons/icon-512.png'),
  resolve('C:/Users/user/.cursor/projects/c-Users-user-cursor/assets/icon-512.png'),
];
const iconPath = iconCandidates.find((p) => existsSync(p));
if (!iconPath) throw new Error(`No 512x512 icon found. Run: python scripts/create-channel-icon.py`);

const result = { icon: null, post: null, channelId: null, skippedPost: false };

const me = await tgJson(token, 'getMe', {});
console.log('getMe:', JSON.stringify({ id: me.id, username: me.username }));

const chat = await tgJson(token, 'getChat', { chat_id: CHANNEL });
result.channelId = chat.id;
console.log('getChat:', JSON.stringify({ id: chat.id, title: chat.title, username: chat.username }));

try {
  const admins = await tgJson(token, 'getChatAdministrators', { chat_id: chat.id });
  const botAdmin = admins.find((a) => a.user?.id === me.id);
  console.log('botAdminRights:', JSON.stringify(botAdmin?.can_change_info ?? null));
} catch (e) {
  console.log('getChatAdministrators:', e.message);
}

try {
  await setChatPhoto(token, chat.id, iconPath);
  result.icon = { success: true, source: iconPath };
  console.log('setChatPhoto: ok');
} catch (e) {
  result.icon = { success: false, error: e.message, source: iconPath };
  console.log('setChatPhoto:', e.message);
}

const postPath = resolve(root, 'marketing/telegram/channel-posts/00-launch-official.md');
const { body, html } = loadChannelPost(postPath, (p) => readFileSync(p, 'utf8'));

let existingLaunch = null;
if (chat.pinned_message?.text || chat.pinned_message?.caption) {
  const pinnedText = chat.pinned_message.text || chat.pinned_message.caption || '';
  if (isLaunchPost(pinnedText)) {
    existingLaunch = chat.pinned_message;
  }
}

if (existingLaunch) {
  result.skippedPost = true;
  result.post = {
    message_id: existingLaunch.message_id,
    link: `https://t.me/toplivo99/${existingLaunch.message_id}`,
    note: 'Launch post already pinned — skipped duplicate',
  };
  console.log('post: skipped (pinned launch exists)', result.post.link);
} else {
  const msg = await tgJson(token, 'sendMessage', {
    chat_id: chat.id,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });

  await tgJson(token, 'pinChatMessage', {
    chat_id: chat.id,
    message_id: msg.message_id,
    disable_notification: false,
  });

  result.post = {
    message_id: msg.message_id,
    link: `https://t.me/toplivo99/${msg.message_id}`,
    text: body.trim(),
  };
  console.log('post:', result.post.link);
}

const envContent = readFileSync(envPath, 'utf8');
const updated = saveEnvChannelId(envPath, envContent, chat.id);
if (updated !== envContent) {
  writeFileSync(envPath, updated, 'utf8');
  console.log('TELEGRAM_NOTIFY_CHANNEL_ID saved:', chat.id);
}

console.log('RESULT_JSON:', JSON.stringify(result));
