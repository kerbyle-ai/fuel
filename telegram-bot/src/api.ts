const API_BASE = (process.env.API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface NearbyStation {
  id: number;
  name: string;
  brand: string | null;
  lat: number;
  lng: number;
  region: string | null;
  distance_m?: number;
  fuel_status?: Array<{
    fuel_type: string;
    fuel_type_name: string;
    status: string;
    stale: boolean;
  }>;
}

export async function fetchNearbyStations(
  lat: number,
  lng: number,
  limit = 5
): Promise<NearbyStation[]> {
  const qs = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: '10000',
  });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/stations/nearby?${qs}`, {
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(
      'Не удалось подключиться к серверу карты. Проверьте, что API запущен, или попробуйте позже.'
    );
  }

  if (!res.ok) {
    if (res.status === 400) {
      throw new ApiError('Некорректные координаты. Попробуйте отправить геолокацию ещё раз.');
    }
    if (res.status >= 500) {
      throw new ApiError('Сервер карты временно недоступен. Попробуйте через несколько минут.');
    }
    throw new ApiError(`Ошибка API (${res.status}). Попробуйте позже.`, res.status);
  }

  const data = (await res.json()) as { stations: NearbyStation[] };
  return data.stations.slice(0, limit);
}

function fuelIcon(status: string): string {
  if (status === 'available') return '✅';
  if (status === 'unavailable') return '❌';
  return '❓';
}

function fuelLabel(f: { fuel_type_name: string; status: string; stale: boolean }): string {
  const name = f.fuel_type_name;
  const stale = f.stale ? ' (устар.)' : '';
  return `${fuelIcon(f.status)} ${name}${stale}`;
}

export function buildMapUrl(
  webAppUrl: string,
  params: { lat?: number; lng?: number; stationId?: number; campaign?: string }
): string {
  const base = webAppUrl.replace(/\/$/, '');
  const qs = new URLSearchParams({
    utm_source: 'telegram',
    utm_medium: 'bot',
    utm_campaign: params.campaign || 'fuel_federal',
  });
  if (params.lat != null) qs.set('lat', String(params.lat));
  if (params.lng != null) qs.set('lng', String(params.lng));
  if (params.stationId != null) qs.set('station', String(params.stationId));
  return `${base}?${qs}`;
}

export function formatStationStatus(station: NearbyStation, webAppUrl: string): string {
  const dist = station.distance_m != null ? `${Math.round(station.distance_m)} м` : '—';
  const place = station.region || 'адрес не указан';
  const brand = station.brand ? ` (${station.brand})` : '';

  const fuels = station.fuel_status?.slice(0, 3) ?? [];
  const fuelLine =
    fuels.length > 0 ? fuels.map((f) => fuelLabel(f)).join(', ') : 'нет отчётов о топливе';

  const mapUrl = buildMapUrl(webAppUrl, {
    lat: station.lat,
    lng: station.lng,
    stationId: station.id,
    campaign: 'nearby',
  });

  return (
    `• *${escapeMarkdown(station.name)}*${escapeMarkdown(brand)}\n` +
    `  ${escapeMarkdown(place)} · ${dist}\n` +
    `  ${fuelLine}\n` +
    `  [Открыть на карте](${mapUrl})`
  );
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, '\\$1');
}

/** Notify Telegram channel about a new report (optional hook from backend). */
export async function notifyChannelNewReport(payload: {
  station_id: number;
  fuel_type: string;
  status: string;
}): Promise<void> {
  const channelId = process.env.TELEGRAM_NOTIFY_CHANNEL_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!channelId || !botToken) return;

  const text = `🆕 Новый отчёт: АЗС #${payload.station_id}, ${payload.fuel_type} → ${payload.status}`;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: channelId, text }),
  });
}
