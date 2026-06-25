const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const;

const USER_AGENT = 'fuel-map-mvp/1.0 (local data import)';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export async function fetchOverpass(
  query: string,
  options: { maxRetries?: number; label?: string } = {}
): Promise<OverpassResponse> {
  const { maxRetries = 5, label = 'Overpass' } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];

    try {
      if (attempt > 0) {
        const backoff = Math.min(60_000, 2 ** attempt * 1000);
        console.log(`[${label}] Retry ${attempt + 1}/${maxRetries} after ${backoff}ms (${endpoint})`);
        await sleep(backoff);
      } else {
        console.log(`[${label}] Querying ${endpoint}...`);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(360_000),
      });

      if (!response.ok) {
        const body = await response.text();
        if (isRetryableStatus(response.status)) {
          lastError = new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
          continue;
        }
        throw new Error(`Overpass HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      const data = (await response.json()) as OverpassResponse;
      if (!Array.isArray(data.elements)) {
        throw new Error('Invalid Overpass response: missing elements array');
      }

      console.log(`[${label}] Received ${data.elements.length} elements`);
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries - 1) break;
    }
  }

  throw lastError ?? new Error('Overpass request failed');
}

export const RUSSIA_FUEL_QUERY = `[out:json][timeout:300];
area["ISO3166-1"="RU"]->.ru;
(nwr["amenity"="fuel"](area.ru););
out center;`;

export const MOSCOW_BBOX_QUERY = `[out:json][timeout:120];
(nwr["amenity"="fuel"](55.35,36.75,56.25,38.35););
out center;`;
