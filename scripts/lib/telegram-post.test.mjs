import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChannelPost, stripYamlFrontmatter, mdToHtml } from './telegram-post.mjs';

const SAMPLE = `---
date: 2026-06-26
city: federal
status: ready
type: channel
topic: launch
title: "Официальный запуск — Карта топлива"
pinned: true
---

⛽ **Запускаем «Карту топлива»**

https://example.com
`;

test('stripYamlFrontmatter removes YAML block', () => {
  const body = stripYamlFrontmatter(SAMPLE);
  assert.ok(!body.includes('date: 2026-06-26'));
  assert.ok(!body.startsWith('---'));
  assert.ok(body.startsWith('⛽'));
});

test('parseChannelPost extracts metadata', () => {
  const { frontmatter, body } = parseChannelPost(SAMPLE);
  assert.equal(frontmatter.date, '2026-06-26');
  assert.equal(frontmatter.pinned, 'true');
  assert.equal(frontmatter.title, 'Официальный запуск — Карта топлива');
  assert.ok(body.startsWith('⛽'));
});

test('stripYamlFrontmatter handles CRLF', () => {
  const crlf = SAMPLE.replace(/\n/g, '\r\n');
  const body = stripYamlFrontmatter(crlf);
  assert.ok(!body.includes('city: federal'));
  assert.ok(body.startsWith('⛽'));
});

test('mdToHtml does not leak frontmatter markers', () => {
  const html = mdToHtml(stripYamlFrontmatter(SAMPLE));
  assert.ok(!html.includes('date:'));
  assert.ok(html.includes('<b>Запускаем'));
});
