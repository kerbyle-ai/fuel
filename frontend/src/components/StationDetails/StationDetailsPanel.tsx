import { useStationDetail } from '../../hooks/useStationDetail';
import { StationDetailsContent } from './StationDetailsContent';

interface StationDetailsPanelProps {
  stationId: number | null;
  onClose: () => void;
  onReportSuccess: () => void;
}

export function StationDetailsPanel({
  stationId,
  onClose,
  onReportSuccess,
}: StationDetailsPanelProps) {
  const { detail, loading, error, reload } = useStationDetail(stationId);

  if (stationId == null) {
    return (
      <div className="details-panel details-panel--empty">
        <p>Выберите АЗС на карте</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="details-panel details-panel--loading">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="details-panel details-panel--error">
        <p>{error ?? 'АЗС не найдена'}</p>
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <div className="details-panel">
      <StationDetailsContent
        detail={detail}
        onClose={onClose}
        onReportSuccess={() => {
          reload();
          onReportSuccess();
        }}
      />
    </div>
  );
}
