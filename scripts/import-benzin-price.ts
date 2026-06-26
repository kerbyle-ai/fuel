#!/usr/bin/env tsx
/**
 * Import fuel prices from benzin-price.ru into fuel-map DB.
 *
 * ⚠️ benzin-price.ru prohibits automated parsing without written permission.
 * Use responsibly: low request rate, consider contacting site owner.
 *
 * Usage:
 *   npm run import:benzin-price -- --region 77
 *   npm run import:benzin-price -- --region 77,50,23
 *   npm run import:benzin-price -- --region all
 *   npm run import:benzin-price -- --region 77 --dry-run
 *   npm run import:benzin-price -- --list-regions
 */
import { BenzinPriceFetcher } from './lib/benzin-price/fetcher.js';
import {
  findStationByBenzinId,
  importPriceReport,
  linkBenzinStation,
  matchStationByProximity,
  upsertBenzinStation,
} from './lib/benzin-price/import-db.js';
import {
  diagnoseHtml,
  parseRegionListPage,
  parseRegionPricePage,
  parseStationPage,
} from './lib/benzin-price/parse.js';
import { BENZIN_REGIONS, parseRegionIdsArg } from './lib/benzin-price/regions.js';
import type { BenzinPriceRow } from './lib/benzin-price/types.js';
import { closePool } from './lib/db.js';

function parseArgs(argv: string[]) {
  let regions = '77';
  let dryRun = false;
  let listRegions = false;
  let delayMs = 1200;
  let fetchCoords = true;
  let matchRadius = 250;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--region' && argv[i + 1]) regions = argv[++i];
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--list-regions') listRegions = true;
    else if (a === '--delay' && argv[i + 1]) delayMs = parseInt(argv[++i], 10) || 1200;
    else if (a === '--match-radius' && argv[i + 1]) matchRadius = parseInt(argv[++i], 10) || 250;
    else if (a === '--no-coords') fetchCoords = false;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: npm run import:benzin-price -- [options]

Options:
  --region <ids>   Comma-separated region_id or "all" (default: 77)
  --dry-run        Parse only, do not write to DB
  --list-regions   Print known region IDs and exit
  --delay <ms>     Delay between requests (default: 1200)
  --match-radius <m>  Max distance for coord match (default: 250)
  --no-coords      Skip fetching station pages for coordinates
`);
      process.exit(0);
    }
  }

  return { regions, dryRun, listRegions, delayMs, fetchCoords, matchRadius };
}

async function resolveStationId(
  fetcher: BenzinPriceFetcher,
  row: BenzinPriceRow,
  fetchCoords: boolean,
  matchRadius: number,
  cache: Map<number, number>
): Promise<number | null> {
  const cached = cache.get(row.benzinStationId);
  if (cached) return cached;

  const existing = await findStationByBenzinId(row.benzinStationId);
  if (existing) {
    cache.set(row.benzinStationId, existing);
    return existing;
  }

  let detail = null;
  if (fetchCoords) {
    try {
      const html = await fetcher.fetchStationPage(row.benzinStationId);
      detail = parseStationPage(html, row.benzinStationId);
    } catch (err) {
      console.warn(`  warn: station ${row.benzinStationId} page failed:`, err);
    }
  }

  const matched = await matchStationByProximity(row, detail, matchRadius);
  if (matched) {
    await linkBenzinStation(row.benzinStationId, matched);
    cache.set(row.benzinStationId, matched);
    return matched;
  }

  if (detail?.lat != null && detail?.lng != null) {
    const id = await upsertBenzinStation(detail);
    await linkBenzinStation(row.benzinStationId, id);
    cache.set(row.benzinStationId, id);
    return id;
  }

  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.listRegions) {
    console.log('Known regions (benzin-price.ru region_id):');
    for (const r of BENZIN_REGIONS) {
      console.log(`  ${r.id}\t${r.name}`);
    }
    await closePool();
    return;
  }

  const regionIds = parseRegionIdsArg(opts.regions);
  console.log('=== benzin-price.ru import ===');
  console.log(`Regions: ${regionIds.join(', ')}`);
  console.log(`Dry run: ${opts.dryRun}`);
  console.log(`Delay: ${opts.delayMs}ms`);
  console.log(`Coords: ${opts.fetchCoords}`);
  console.log(`Match radius: ${opts.matchRadius}m`);

  const fetcher = new BenzinPriceFetcher({ delayMs: opts.delayMs });
  await fetcher.init();

  const stationCache = new Map<number, number>();
  let totalParsed = 0;
  let inserted = 0;
  let skipped = 0;
  let unmatched = 0;

  try {
    try {
      const regionsHtml = await fetcher.fetchRegionListPage();
      const liveRegions = parseRegionListPage(regionsHtml);
      if (liveRegions.length > 10) {
        console.log(`Live regions on site: ${liveRegions.length}`);
      }
    } catch {
      // non-fatal
    }

    for (const regionId of regionIds) {
      const regionName = BENZIN_REGIONS.find((r) => r.id === regionId)?.name ?? String(regionId);
      console.log(`\n--- ${regionName} (${regionId}) ---`);

      let html: string;
      try {
        html = await fetcher.fetchRegionPrices(regionId);
      } catch (err) {
        console.warn(`  skip region: fetch failed`, err);
        continue;
      }

      let rows: BenzinPriceRow[];
      try {
        rows = parseRegionPricePage(html, regionId);
      } catch (err) {
        const diag = diagnoseHtml(html);
        console.warn(`  skip region: parse failed`, err);
        console.warn(
          `  html diagnosis: len=${diag.htmlLength} priceTable=${diag.hasPriceTable} ` +
            `stations=${diag.hasStationLinks} gate=${diag.isGatePage} empty=${diag.isEmptyBody}`
        );
        if (fetcher.lastDiagnostics) {
          const d = fetcher.lastDiagnostics;
          console.warn(
            `  fetch: status=${d.httpStatus} final=${d.finalUrl}`
          );
        }
        continue;
      }

      const stations = new Set(rows.map((r) => r.benzinStationId)).size;
      console.log(`  parsed: ${rows.length} prices for ${stations} stations`);

      if (rows.length === 0) {
        const diag = diagnoseHtml(html);
        console.warn(
          `  WARN: zero rows — len=${diag.htmlLength} priceTable=${diag.hasPriceTable} ` +
            `empty=${diag.isEmptyBody}. Check BENZIN_DEBUG_DIR artifacts or apply reports-seed.sql.gz`
        );
      }

      if (opts.dryRun) {
        const sample = rows.slice(0, 3);
        for (const s of sample) {
          console.log(`    ${s.stationName} | ${s.fuelCode} ${s.price} ₽`);
        }
        totalParsed += rows.length;
        continue;
      }

      const uniqueStationIds = [...new Set(rows.map((r) => r.benzinStationId))];

      for (const benzinId of uniqueStationIds) {
        const stationRows = rows.filter((r) => r.benzinStationId === benzinId);
        const stationId = await resolveStationId(
          fetcher,
          stationRows[0],
          opts.fetchCoords,
          opts.matchRadius,
          stationCache
        );

        if (!stationId) {
          unmatched += stationRows.length;
          continue;
        }

        for (const row of stationRows) {
          totalParsed++;
          const result = await importPriceReport(stationId, row);
          if (result === 'inserted') inserted++;
          else skipped++;
        }
      }
    }
  } finally {
    await fetcher.close();
  }

  console.log('\n=== Done ===');
  console.log(`Parsed price rows: ${totalParsed}`);
  if (!opts.dryRun) {
    console.log(`Reports inserted: ${inserted}`);
    console.log(`Reports skipped (dup): ${skipped}`);
    console.log(`Unmatched price rows: ${unmatched}`);
    console.log(`Stations mapped: ${stationCache.size}`);
  }

  await closePool();
}

main().catch(async (err) => {
  console.error('Import failed:', err);
  await closePool();
  process.exit(1);
});
