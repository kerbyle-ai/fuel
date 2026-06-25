import type { ReportStatus } from '../api/types';

const STATUS_COLORS: Record<ReportStatus, string> = {
  available: '#22c55e',
  unavailable: '#ef4444',
  unknown: '#9ca3af',
};

export function statusColor(status: ReportStatus, isStale: boolean): string {
  const base = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  return isStale ? withOpacity(base, 0.45) : base;
}

function withOpacity(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return `${price.toFixed(2)} ₽`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}
