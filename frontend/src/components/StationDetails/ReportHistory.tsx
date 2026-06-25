import type { ReportHistoryItem } from '../../api/types';
import { QUEUE_LABELS, STATUS_LABELS } from '../../constants';
import { formatDate, formatPrice } from '../../utils/format';

interface ReportHistoryProps {
  items: ReportHistoryItem[];
}

export function ReportHistory({ items }: ReportHistoryProps) {
  if (items.length === 0) {
    return <p className="muted history-empty">Отчётов пока нет</p>;
  }

  return (
    <ul className="report-history">
      {items.map((item) => (
        <li key={item.id} className={`report-history__item report-history__item--${item.status}`}>
          <div className="report-history__head">
            <span className="report-history__fuel">{item.fuel_name}</span>
            <span className="report-history__status">{STATUS_LABELS[item.status]}</span>
          </div>
          <div className="report-history__meta">
            <span>{formatDate(item.created_at)}</span>
            {item.price != null && <span>{formatPrice(item.price)}</span>}
            {item.queue_status && item.queue_status !== 'unknown' && (
              <span>Очередь: {QUEUE_LABELS[item.queue_status]}</span>
            )}
            {item.limit_liters != null && <span>Лимит: {item.limit_liters} л</span>}
          </div>
          {item.comment && <p className="report-history__comment">{item.comment}</p>}
        </li>
      ))}
    </ul>
  );
}
