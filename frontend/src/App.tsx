import { useCallback, useState } from 'react';
import type { FuelCode, SearchResult } from './api/types';
import { FuelMap } from './components/Map/FuelMap';
import { WelcomeModal } from './components/WelcomeModal';
import { LocationButton } from './components/LocationButton';
import { Sidebar } from './components/Sidebar/Sidebar';
import { StationBottomSheet } from './components/StationDetails/StationBottomSheet';
import { StationDetailsPanel } from './components/StationDetails/StationDetailsPanel';
import { useGeolocation } from './hooks/useGeolocation';
import { useIsMobile } from './hooks/useMediaQuery';
import { useStations } from './hooks/useStations';

export default function App() {
  const isMobile = useIsMobile();
  const [selectedFuels, setSelectedFuels] = useState<FuelCode[]>([]);
  const [hideWithoutFuel, setHideWithoutFuel] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  const { stations, loading, onBboxChange, refresh } = useStations({
    fuelTypes: selectedFuels,
    hideWithoutFuel,
  });

  const { position, loading: geoLoading, error: geoError, locate } = useGeolocation();

  const toggleFuel = useCallback((code: FuelCode) => {
    setSelectedFuels((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const handleSearchSelect = useCallback((station: SearchResult) => {
    setSelectedId(station.id);
    setFlyTo({ lat: station.lat, lng: station.lng, zoom: 15 });
  }, []);

  const handleStationClick = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleReportSuccess = useCallback(() => {
    refresh();
    setStatsRefreshKey((k) => k + 1);
  }, [refresh]);

  return (
    <div className="app">
      <WelcomeModal />
      <Sidebar
        selectedFuels={selectedFuels}
        hideWithoutFuel={hideWithoutFuel}
        stationCount={stations.length}
        loading={loading}
        statsRefreshKey={statsRefreshKey}
        onToggleFuel={toggleFuel}
        onHideWithoutFuelChange={setHideWithoutFuel}
        onSearchSelect={handleSearchSelect}
      />

      <main className="map-area">
        <FuelMap
          stations={stations}
          selectedId={selectedId}
          userPosition={position}
          flyTo={flyTo}
          onStationClick={handleStationClick}
          onBboxChange={onBboxChange}
        />

        <div className="map-controls">
          <LocationButton onClick={locate} loading={geoLoading} />
        </div>

        {geoError && <div className="map-toast map-toast--error">{geoError}</div>}

        {!isMobile && (
          <StationDetailsPanel
            stationId={selectedId}
            onClose={handleCloseDetails}
            onReportSuccess={handleReportSuccess}
          />
        )}
      </main>

      {isMobile && (
        <StationBottomSheet
          stationId={selectedId}
          onClose={handleCloseDetails}
          onReportSuccess={handleReportSuccess}
        />
      )}
    </div>
  );
}
