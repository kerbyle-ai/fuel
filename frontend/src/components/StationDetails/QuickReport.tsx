import { useMemo, useState } from 'react';
import { createReport } from '../../api/client';
import type { FuelCode, FuelStatus, QueueStatus } from '../../api/types';
import { FUEL_TYPES } from '../../constants';
import { formatPrice } from '../../utils/format';
import { getUserFingerprint } from '../../utils/fingerprint';

interface QuickReportProps {
  stationId: number;
  fuels: FuelStatus[];
  onSuccess: () => void;
}

const QUEUE_OPTIONS: { value: QueueStatus; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'short', label: 'Короткая' },
  { value: 'long', label: 'Длинная' },
];

export function QuickReport({ stationId, fuels, onSuccess }: QuickReportProps) {
  const fuelOptions = useMemo(
    () =>
      FUEL_TYPES.map((ft) => {
        const existing = fuels.find((f) => f.fuel_code === ft.code);
        return {
          code: ft.code,
          label: ft.label,
          price: existing?.price ?? null,
        };
      }),
    [fuels]
  );

  const pricedCodes = useMemo(
    () => fuelOptions.filter((f) => f.price != null).map((f) => f.code),
    [fuelOptions]
  );

  const [selected, setSelected] = useState<Set<FuelCode>>(() => new Set());
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('none');
  const [limitLiters, setLimitLiters] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleFuel = (code: FuelCode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setSuccess(null);
    setError(null);
  };

  const selectAllPriced = () => {
    setSelected(new Set(pricedCodes));
    setSuccess(null);
    setError(null);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setSuccess(null);
    setError(null);
  };

  const submit = async (status: 'available' | 'unavailable') => {
    if (selected.size === 0) {
      setError('Выберите одно или несколько топлив');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const sharedLimit = limitLiters ? parseInt(limitLiters, 10) : null;
    const sharedComment = comment.trim() || null;
    const overridePrice = priceOverride ? parseFloat(priceOverride) : null;
    const useOverride = selected.size === 1 && overridePrice != null && Number.isFinite(overridePrice);

    const codes = [...selected];
    let ok = 0;
    const errors: string[] = [];

    for (const code of codes) {
      const existing = fuels.find((f) => f.fuel_code === code);
      const price = useOverride ? overridePrice : (existing?.price ?? null);

      try {
        await createReport({
          station_id: stationId,
          fuel_type: code,
          status,
          queue_status: queueStatus,
          limit_liters: sharedLimit,
          price,
          comment: sharedComment,
          user_fingerprint: getUserFingerprint(),
        });
        ok += 1;
      } catch (e) {
        const label = fuelOptions.find((f) => f.code === code)?.label ?? code;
        errors.push(`${label}: ${e instanceof Error ? e.message : 'ошибка'}`);
      }
    }

    if (ok > 0) {
      setSuccess(
        ok === codes.length
          ? `Отправлено отчётов: ${ok}`
          : `Отправлено ${ok} из ${codes.length}${errors.length ? `. Ошибки: ${errors.join('; ')}` : ''}`
      );
      setComment('');
      onSuccess();
      if (errors.length === 0) setSelected(new Set());
    } else {
      setError(errors.join('; ') || 'Не удалось отправить отчёты');
    }

    setSubmitting(false);
  };

  const selectedCount = selected.size;

  return (
    <div className="quick-report">
      <div className="quick-report__head">
        <h3 className="quick-report__title">Сообщить о наличии</h3>
        {pricedCodes.length > 1 && (
          <div className="quick-report__bulk-actions">
            <button type="button" className="btn-text" onClick={selectAllPriced}>
              Все с ценой
            </button>
            {selectedCount > 0 && (
              <button type="button" className="btn-text" onClick={clearSelection}>
                Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      <p className="quick-report__hint">
        Нажмите на топливо (можно несколько), затем «Есть» или «Нет»
      </p>

      <div className="fuel-pick-grid" role="group" aria-label="Выбор топлива">
        {fuelOptions.map((f) => {
          const isSelected = selected.has(f.code);
          return (
            <button
              key={f.code}
              type="button"
              className={`fuel-pick-card${isSelected ? ' fuel-pick-card--selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => toggleFuel(f.code)}
            >
              <span className="fuel-pick-card__name">{f.label}</span>
              {f.price != null ? (
                <strong className="fuel-pick-card__price">{formatPrice(f.price)}</strong>
              ) : (
                <span className="fuel-pick-card__empty">нет цены</span>
              )}
              {isSelected && <span className="fuel-pick-card__check" aria-hidden>✓</span>}
            </button>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <p className="quick-report__selected">Выбрано: {selectedCount}</p>
      )}

      <div className="quick-report__actions">
        <button
          type="button"
          className="btn btn--yes"
          disabled={submitting || selectedCount === 0}
          onClick={() => submit('available')}
        >
          Есть{selectedCount > 1 ? ` (${selectedCount})` : ''}
        </button>
        <button
          type="button"
          className="btn btn--no"
          disabled={submitting || selectedCount === 0}
          onClick={() => submit('unavailable')}
        >
          Нет{selectedCount > 1 ? ` (${selectedCount})` : ''}
        </button>
      </div>

      <details className="quick-report__more">
        <summary>Очередь, лимит, цена, комментарий</summary>
        <div className="quick-report__fields">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hp-field"
            aria-hidden="true"
          />
          <label className="field">
            <span>Очередь</span>
            <select
              value={queueStatus}
              onChange={(e) => setQueueStatus(e.target.value as QueueStatus)}
            >
              {QUEUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Лимит, л</span>
            <input
              type="number"
              min="0"
              placeholder="—"
              value={limitLiters}
              onChange={(e) => setLimitLiters(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Цена, ₽ {selectedCount > 1 && <small>(только если выбрано одно)</small>}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="из карточки"
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              disabled={selectedCount > 1}
            />
          </label>

          <label className="field field--full">
            <span>Комментарий</span>
            <textarea
              rows={2}
              placeholder="Для всех выбранных…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
        </div>
      </details>

      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}
    </div>
  );
}
