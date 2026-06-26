/**
 * Edit pinned launch post in @toplivo99 (message_id=2) — no bot mention, map URL only.
 *
 * Usage:
 *   node scripts/edit-pinned-launch-post.mjs
 *   node scripts/edit-pinned-launch-post.mjs --message-id=2
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const messageId =
  process.argv.find((a) => a.startsWith('--message-id='))?.slice('--message-id='.length) ?? '2';

const editScript = resolve(__dirname, 'edit-channel-post.mjs');
const postFile = 'marketing/telegram/channel-posts/00-launch-official.md';

const result = spawnSync(
  process.execPath,
  [editScript, `--message-id=${messageId}`, `--file=${postFile}`],
  { cwd: root, stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
