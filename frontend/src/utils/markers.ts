import L from 'leaflet';
import type { ReportStatus } from '../api/types';
import { statusColor } from './format';

export function createStationIcon(status: ReportStatus, isStale: boolean): L.DivIcon {
  const color = statusColor(status, isStale);
  const size = isStale ? 10 : 14;

  return L.divIcon({
    className: 'station-marker',
    html: `<span class="station-marker__dot" style="background:${color};width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
