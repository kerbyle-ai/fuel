import type { FuelCode } from '../../api/types';
import { FUEL_TYPES } from '../../constants';

interface FuelFiltersProps {
  selected: FuelCode[];
  hideWithoutFuel: boolean;
  onToggleFuel: (code: FuelCode) => void;
  onHideWithoutFuelChange: (value: boolean) => void;
}

export function FuelFilters({
  selected,
  hideWithoutFuel,
  onToggleFuel,
  onHideWithoutFuelChange,
}: FuelFiltersProps) {
  return (
    <div className="fuel-filters">
      <div className="fuel-filters__label">Тип топлива</div>
      <div className="fuel-filters__chips">
        {FUEL_TYPES.map((ft) => {
          const active = selected.includes(ft.code);
          return (
            <button
              key={ft.code}
              type="button"
              className={`chip ${active ? 'chip--active' : ''}`}
              onClick={() => onToggleFuel(ft.code)}
            >
              {ft.label}
            </button>
          );
        })}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={hideWithoutFuel}
          onChange={(e) => onHideWithoutFuelChange(e.target.checked)}
        />
        <span>Скрывать АЗС без выбранного топлива</span>
      </label>
    </div>
  );
}
