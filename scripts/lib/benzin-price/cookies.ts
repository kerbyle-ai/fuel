import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Cookie } from 'playwright';

const DEFAULT_COOKIE_PATHS = [
  'data/benzin-cookies3.txt',
  'data/benzin-cookies2.txt',
  'data/benzin-cookies.txt',
];

/** Parse Netscape cookie jar for Playwright context.addCookies(). */
export function parseNetscapeCookieFile(content: string, baseUrl = 'https://www.benzin-price.ru'): Cookie[] {
  const cookies: Cookie[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const line of content.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;

    const [domain, , path, secureFlag, expiresRaw, name, value] = parts;
    if (!name || value === undefined) continue;

    const expiresNum = parseInt(expiresRaw, 10);
    const cookie: Cookie = {
      name,
      value,
      domain: domain.startsWith('.') ? domain : `.${domain.replace(/^www\./, '')}`,
      path: path || '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    };

    if (Number.isFinite(expiresNum) && expiresNum > 0) {
      cookie.expires = expiresNum;
    } else {
      cookie.expires = now + 86_400;
    }

    cookies.push(cookie);
  }

  return cookies;
}

export function resolveCookieFilePath(explicit?: string): string | null {
  const candidates = explicit
    ? [explicit]
    : [
        process.env.BENZIN_COOKIES_FILE,
        ...DEFAULT_COOKIE_PATHS,
      ].filter((p): p is string => Boolean(p));

  for (const rel of candidates) {
    const abs = rel.includes(':') || rel.startsWith('/') ? rel : join(process.cwd(), rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

export function loadBenzinCookies(explicitPath?: string): { cookies: Cookie[]; source: string | null } {
  const path = resolveCookieFilePath(explicitPath);
  if (!path) return { cookies: [], source: null };
  const content = readFileSync(path, 'utf8');
  return { cookies: parseNetscapeCookieFile(content), source: path };
}
