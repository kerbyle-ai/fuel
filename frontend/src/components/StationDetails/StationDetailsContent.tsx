import type { RefObject } from 'react';
import type { StationDetail } from '../../api/types';
import { STATUS_LABELS } from '../../constants';
import { formatPrice, formatRelative } from '../../utils/format';
import { QuickReport } from './QuickReport';
import { ReportHistory } from './ReportHistory';

interface StationDetailsContentProps {
  detail: StationDetail;
  onClose: () => void;
  onReportSuccess: () => void;
  showClose?: boolean;
  reportSectionRef?: RefObject<HTMLDivElement>;
}

export function StationDetailsContent({
  detail,
  onClose,
  onReportSuccess,
  showClose = true,
  reportSectionRef,
}: StationDetailsContentProps) {
  const pricedFuels = detail.fuels.filter((f) => f.price != null);

  return (
    <div className="station-details">
      <div className="station-details__header">
        <div>
          <h2 className="station-details__name">{detail.name}</h2>
          {(detail.brand || detail.region) && (
            <p className="station-details__sub">
              {[detail.brand, detail.region].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {showClose && (
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        )}
      </div>

      {pricedFuels.length > 0 && (
        <div className="station-prices-banner">
          <div className="station-prices-banner__title">Цены на топливо</div>
          <div className="station-prices-banner__grid">
            {pricedFuels.map((f) => (
              <div key={f.fuel_code} className="station-prices-banner__item">
                <span>{f.fuel_name}</span>
                <strong>{formatPrice(f.price!)}</strong>
              </div>
            ))}
          </div>
          <p className="station-prices-banner__note">
            Данные benzin-price.ru и отчёты водителей · обновление каждые 2 ч
          </p>
        </div>
      )}

      {detail.fuels.length > 0 && (
        <div className="fuel-status-grid">
          {detail.fuels.map((f) => (
            <div
              key={f.fuel_code}
              className={`fuel-status-card fuel-status-card--${f.status ?? 'unknown'}${f.is_stale ? ' fuel-status-card--stale' : ''}`}
            >
              <div className="fuel-status-card__name">{f.fuel_name}</div>
              <div className="fuel-status-card__status">
                {STATUS_LABELS[f.status ?? 'unknown']}
                {f.is_stale && <span className="stale-badge">устарело</span>}
              </div>
              {f.price != null && (
                <div className="fuel-status-card__price">{formatPrice(f.price)}</div>
              )}
              {f.reported_at && (
                <div className="fuel-status-card__time">{formatRelative(f.reported_at)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div ref={reportSectionRef}>
        <QuickReport stationId={detail.id} onSuccess={onReportSuccess} />
      </div>

      <section className="station-details__history">
        <h3>История отчётов</h3>
        <ReportHistory items={detail.history} />
      </section>
    </div>
  );
}
