import L from 'leaflet';

export function statusColor(status: string | undefined, isStale?: boolean): string {
  if (isStale) {
    switch (status) {
      case 'available':
        return '#6aaa6a';
      case 'unavailable':
        return '#c97a7a';
      default:
        return '#aaa';
    }
  }
  switch (status) {
    case 'available':
      return '#22c55e';
    case 'unavailable':
      return '#ef4444';
    default:
      return '#9ca3af';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'available':
      return 'Есть';
    case 'unavailable':
      return 'Нет';
    default:
      return 'Неизвестно';
  }
}

export function queueLabel(q: string | null): string {
  switch (q) {
    case 'none':
      return 'Без очереди';
    case 'short':
      return 'Короткая очередь';
    case 'long':
      return 'Длинная очередь';
    default:
      return 'Очередь неизвестна';
  }
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function createMarkerIcon(color: string, faded: boolean): L.DivIcon {
  const opacity = faded ? 0.55 : 1;
  return L.divIcon({
    className: 'fuel-marker',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      opacity:${opacity};
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}
