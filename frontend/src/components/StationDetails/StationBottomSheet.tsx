import { useEffect, type RefObject } from 'react';
import { useStationDetail } from '../../hooks/useStationDetail';
import { StationDetailsContent } from './StationDetailsContent';

interface StationBottomSheetProps {
  stationId: number | null;
  onClose: () => void;
  onReportSuccess: () => void;
  reportSectionRef?: RefObject<HTMLDivElement>;
}

export function StationBottomSheet({
  stationId,
  onClose,
  onReportSuccess,
  reportSectionRef,
}: StationBottomSheetProps) {
  const { detail, loading, error, reload } = useStationDetail(stationId);
  const open = stationId != null;

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="bottom-sheet" role="dialog" aria-modal="true">
      <div className="bottom-sheet__backdrop" onClick={onClose} />
      <div className="bottom-sheet__panel">
        <div className="bottom-sheet__handle" />
        {loading && <p className="bottom-sheet__loading">Загрузка…</p>}
        {error && <p className="form-error">{error}</p>}
        {detail && (
          <StationDetailsContent
            detail={detail}
            onClose={onClose}
            onReportSuccess={() => {
              reload();
              onReportSuccess();
            }}
            reportSectionRef={reportSectionRef}
          />
        )}
      </div>
    </div>
  );
}
