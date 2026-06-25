/**
 * Generates seed-moscow.json with ~100 fuel stations around Moscow.
 * Run from scripts/: npm install && npm run generate-seed
 * Writes to scripts/seed-moscow.json and backend/seed-data/seed-moscow.json
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const brands = ['Лукойл', 'Газпромнефть', 'Роснефть', 'Татнефть', 'Shell', 'BP', 'Teboil'];
const baseLat = 55.7558;
const baseLng = 37.6173;

const stations = Array.from({ length: 100 }, (_, i) => {
  const angle = (i / 100) * Math.PI * 2;
  const radius = 0.05 + (i % 10) * 0.02;
  const lat = baseLat + Math.sin(angle) * radius + (Math.random() - 0.5) * 0.01;
  const lng = baseLng + Math.cos(angle) * radius + (Math.random() - 0.5) * 0.01;
  const brand = brands[i % brands.length];

  return {
    name: `${brand} — АЗС №${i + 1}`,
    brand,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    osm_id: 900000000 + i,
    region: 'Москва',
  };
});

const json = JSON.stringify(stations, null, 2);
writeFileSync(join(__dirname, 'seed-moscow.json'), json);

const seedDataDir = join(projectRoot, 'backend', 'seed-data');
mkdirSync(seedDataDir, { recursive: true });
writeFileSync(join(seedDataDir, 'seed-moscow.json'), json);

console.log(`Generated ${stations.length} stations:`);
console.log(`  scripts/seed-moscow.json`);
console.log(`  backend/seed-data/seed-moscow.json`);
