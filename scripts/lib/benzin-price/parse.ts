import * as cheerio from 'cheerio';
import type { BenzinPriceRow } from './types.js';

const WIN1251_DECODER = new TextDecoder('windows-1251');

/** Column index in price table → fuel-map fuel_types.code */
const FUEL_COLUMN_MAP: Record<number, string> = {
  2: 'ai92',
  4: 'ai95',
  6: 'ai98',
  10: 'dt',
  12: 'gas',
};

export function decodeBenzinHtml(buffer: ArrayBuffer | Buffer | string): string {
  if (typeof buffer === 'string') return buffer;
  const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.toString('utf8');
  }
  return WIN1251_DECODER.decode(bytes);
}

function parsePriceValue(raw: string): number | null {
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const m = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 20 || n > 500) return null;
  return Math.round(n * 100) / 100;
}

export function parseStationId(href: string | undefined): number | null {
  if (!href) return null;
  const m =
    href.match(/[?&]azk_id=(\d+)/i) ??
    href.match(/[?&]id=(\d+)/i);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}

function isGatePage(html: string): boolean {
  return (
    (html.includes("$('#testdiv').load('check_s.php") || html.includes("load('check_s.php")) &&
    html.length < 8000
  );
}

function isEmptyBlockedBody(html: string): boolean {
  const trimmed = html.trim();
  return (
    trimmed.length < 200 ||
    /^<html><head><\/head><body><\/body><\/html>$/i.test(trimmed)
  );
}

export interface HtmlDiagnosis {
  htmlLength: number;
  hasPriceTable: boolean;
  hasStationLinks: boolean;
  isGatePage: boolean;
  isEmptyBody: boolean;
}

export function diagnoseHtml(html: string): HtmlDiagnosis {
  return {
    htmlLength: html.length,
    hasPriceTable: html.includes('td.price'),
    hasStationLinks: /zapravka\.php/i.test(html),
    isGatePage: isGatePage(html),
    isEmptyBody: isEmptyBlockedBody(html),
  };
}

export function assertNotGatePage(html: string, url: string): void {
  const diag = diagnoseHtml(html);

  if (diag.isEmptyBody) {
    throw new Error(
      `Empty/blocked response on ${url} (${diag.htmlLength} bytes) — ` +
        `benzin-price.ru likely blocks datacenter IP. ` +
        `Export cookies from a browser (scripts/data/benzin-cookies*.txt) or use deploy/reports-seed.sql.gz`
    );
  }

  if (diag.isGatePage) {
    throw new Error(`Anti-bot gate on ${url} — session bootstrap or cookies required`);
  }

  if (/region\s+\d+/.test(url) && !diag.hasPriceTable && !diag.hasStationLinks) {
    throw new Error(
      `No price table on ${url} (${diag.htmlLength} bytes) — HTML structure changed or access denied`
    );
  }
}

function parseDateFromTable($: cheerio.CheerioAPI): string | null {
  const dateRow = $('td.price nobr b').first().text().trim();
  const m = dateRow.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Parses price.php?region_id=X — matrix with all fuel types per station.
 */
export function parseRegionPricePage(html: string, regionId: number): BenzinPriceRow[] {
  assertNotGatePage(html, `region ${regionId}`);
  const $ = cheerio.load(html);
  const priceDate = parseDateFromTable($);
  const rows: BenzinPriceRow[] = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td.price');
    if (cells.length < 10) return;

    const stationCell = cells.filter((_, td) => {
      return $(td).find('a[href*="zapravka.php"]').length > 0;
    }).last();

    if (!stationCell.length) return;

    const link = stationCell.find('a[href*="zapravka.php"]').first();
    const href = link.attr('href');
    const benzinStationId = parseStationId(href);
    if (!benzinStationId) return;

    const stationName = link.text().trim();
    const stationText = stationCell.text().replace(/\s+/g, ' ').trim();
    const address = stationText.replace(stationName, '').replace(/^[\s\-–]+/, '').trim() || null;

    cells.each((colIdx, td) => {
      const fuelCode = FUEL_COLUMN_MAP[colIdx];
      if (!fuelCode) return;

      const price = parsePriceValue($(td).text());
      if (price === null) return;

      rows.push({
        benzinStationId,
        stationName: stationName || `АЗС #${benzinStationId}`,
        address,
        fuelCode,
        price,
        priceDate,
        regionId,
      });
    });
  });

  return rows;
}

/** Parses zapravka.php?azk_id= station card. */
export function parseStationPage(html: string, benzinStationId: number) {
  assertNotGatePage(html, `station ${benzinStationId}`);
  const $ = cheerio.load(html);

  const name =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    $('title').text().split('|')[0]?.trim() ||
    `АЗС #${benzinStationId}`;

  let brand: string | null = null;
  const brandLink = $('a[href*="brand_id="]').first();
  if (brandLink.length) brand = brandLink.text().trim() || null;
  if (!brand && name) {
    const first = name.split(/\s+/)[0];
    if (first && first.length > 2) brand = first;
  }

  let address: string | null = null;
  $('td').each((_, td) => {
    const label = $(td).text().trim();
    if (/^адрес/i.test(label)) {
      const next = $(td).next('td').text().trim();
      if (next) address = next;
    }
  });

  let lat: number | null = null;
  let lng: number | null = null;
  const pageText = $.html();
  const llMatch =
    pageText.match(/ll=([\d.]+)%2C([\d.]+)/i) ??
    pageText.match(/ll=([\d.]+),([\d.]+)/i) ??
    pageText.match(/center=([\d.]+),([\d.]+)/i);
  if (llMatch) {
    lng = parseFloat(llMatch[1]);
    lat = parseFloat(llMatch[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      lat = null;
      lng = null;
    }
  }

  const regionMatch = $('a[href*="region_id="]').first().attr('href')?.match(/region_id=(\d+)/);
  const regionId = regionMatch ? parseInt(regionMatch[1], 10) : null;

  return {
    benzinStationId,
    name,
    brand,
    address,
    lat,
    lng,
    regionId: Number.isFinite(regionId) ? regionId! : null,
  };
}

export function parseRegionListPage(html: string): { id: number; name: string }[] {
  assertNotGatePage(html, 'regions');
  const $ = cheerio.load(html);
  const regions: { id: number; name: string }[] = [];
  const seen = new Set<number>();

  $('a[href*="region_id="]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const m = href.match(/region_id=(\d+)/);
    if (!m) return;
    const id = parseInt(m[1], 10);
    if (!Number.isFinite(id) || seen.has(id) || id > 1000) return;
    const name = $(a).text().trim();
    if (!name) return;
    seen.add(id);
    regions.push({ id, name });
  });

  return regions.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

// Backward-compatible alias
export const parsePricePage = parseRegionPricePage;
