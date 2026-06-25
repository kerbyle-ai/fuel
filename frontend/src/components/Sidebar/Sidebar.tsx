import type { FuelCode } from '../../api/types';
import { FUEL_TYPES } from '../../constants';
import ReputationBadge from '../ReputationBadge';
import { FuelFilters } from './FuelFilters';
import { StationSearch } from './StationSearch';
import { SupportBanner } from './SupportBanner';
import type { SearchResult } from '../../api/types';

interface SidebarProps {
  selectedFuels: FuelCode[];
  hideWithoutFuel: boolean;
  stationCount: number;
  loading: boolean;
  statsRefreshKey?: number;
  onToggleFuel: (code: FuelCode) => void;
  onHideWithoutFuelChange: (value: boolean) => void;
  onSearchSelect: (station: SearchResult) => void;
}

export function Sidebar({
  selectedFuels,
  hideWithoutFuel,
  stationCount,
  loading,
  statsRefreshKey,
  onToggleFuel,
  onHideWithoutFuelChange,
  onSearchSelect,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="sidebar__logo">
          <span className="sidebar__logo-icon">⛽</span>
          <div>
            <h1>Карта топлива</h1>
            <p className="sidebar__tagline">Наличие на АЗС России</p>
          </div>
        </div>
        <ReputationBadge refreshKey={statsRefreshKey} />
      </header>

      <div className="sidebar__body">
        <StationSearch onSelect={onSearchSelect} />
        <FuelFilters
          selected={selectedFuels}
          hideWithoutFuel={hideWithoutFuel}
          onToggleFuel={onToggleFuel}
          onHideWithoutFuelChange={onHideWithoutFuelChange}
        />

        <div className="sidebar__legend">
          <div className="sidebar__legend-title">Обозначения</div>
          <ul>
            <li><span className="legend-dot legend-dot--available" /> Есть топливо</li>
            <li><span className="legend-dot legend-dot--unavailable" /> Нет топлива</li>
            <li><span className="legend-dot legend-dot--unknown" /> Неизвестно</li>
            <li><span className="legend-dot legend-dot--stale" /> Устарело (&gt;3 ч)</li>
          </ul>
        </div>

        <SupportBanner />
      </div>

      <footer className="sidebar__footer">
        <span className="sidebar__count">
          {loading ? 'Загрузка…' : `На карте: ${stationCount} АЗС`}
        </span>
        <span className="sidebar__fuels-hint">
          {selectedFuels.length > 0
            ? FUEL_TYPES.filter((f) => selectedFuels.includes(f.code))
                .map((f) => f.label)
                .join(', ')
            : 'Все типы топлива'}
        </span>
      </footer>
    </aside>
  );
}
