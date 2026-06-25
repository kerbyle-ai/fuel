import { useState } from 'react';
import { createReport } from '../../api/client';
import type { FuelCode, QueueStatus } from '../../api/types';
import { FUEL_TYPES } from '../../constants';
import { getUserFingerprint } from '../../utils/fingerprint';

interface QuickReportProps {
  stationId: number;
  defaultFuel?: FuelCode;
  onSuccess: () => void;
}

const QUEUE_OPTIONS: { value: QueueStatus; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'short', label: 'Короткая' },
  { value: 'long', label: 'Длинная' },
];

export function QuickReport({ stationId, defaultFuel, onSuccess }: QuickReportProps) {
  const [fuelType, setFuelType] = useState<FuelCode>(defaultFuel ?? 'ai95');
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('none');
  const [limitLiters, setLimitLiters] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (status: 'available' | 'unavailable') => {
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await createReport({
        station_id: stationId,
        fuel_type: fuelType,
        status,
        queue_status: queueStatus,
        limit_liters: limitLiters ? parseInt(limitLiters, 10) : null,
        price: price ? parseFloat(price) : null,
        comment: comment.trim() || null,
        user_fingerprint: getUserFingerprint(),
      });
      setSuccess(true);
      setComment('');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить отчёт');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="quick-report">
      <h3 className="quick-report__title">Сообщить о наличии</h3>

      <div className="quick-report__actions">
        <button
          type="button"
          className="btn btn--yes"
          disabled={submitting}
          onClick={() => submit('available')}
        >
          Есть
        </button>
        <button
          type="button"
          className="btn btn--no"
          disabled={submitting}
          onClick={() => submit('unavailable')}
        >
          Нет
        </button>
      </div>

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
          <span>Топливо</span>
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelCode)}>
            {FUEL_TYPES.map((f) => (
              <option key={f.code} value={f.code}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

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
          <span>Цена, ₽</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="—"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label className="field field--full">
          <span>Комментарий</span>
          <textarea
            rows={2}
            placeholder="Дополнительная информация…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">Спасибо! Отчёт принят.</p>}
    </div>
  );
}
