import { useCallback, useEffect, useRef, useState } from 'react';

import type { FuelCode, SearchResult } from './api/types';

import { FuelMap } from './components/Map/FuelMap';

import { WelcomeModal } from './components/WelcomeModal';

import { LocationButton } from './components/LocationButton';

import { Sidebar } from './components/Sidebar/Sidebar';

import { TelegramHeader } from './components/TelegramHeader';

import { StationBottomSheet } from './components/StationDetails/StationBottomSheet';

import { StationDetailsPanel } from './components/StationDetails/StationDetailsPanel';

import { useGeolocation } from './hooks/useGeolocation';

import { useIsMobile } from './hooks/useMediaQuery';

import { useStations } from './hooks/useStations';

import { useTelegramWebApp } from './hooks/useTelegramWebApp';



export default function App() {

  const isMobile = useIsMobile();

  const { isTelegram, openChannel, showMainButton, showBackButton, haptic } = useTelegramWebApp();

  const reportSectionRef = useRef<HTMLDivElement>(null);



  const [selectedFuels, setSelectedFuels] = useState<FuelCode[]>([]);

  const [hideWithoutFuel, setHideWithoutFuel] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const [statsRefreshKey, setStatsRefreshKey] = useState(0);



  const { stations, loading, error: stationsError, onBboxChange, refresh } = useStations({

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

    haptic('light');

  }, [haptic]);



  const handleStationClick = useCallback((id: number) => {

    setSelectedId(id);

    haptic('light');

  }, [haptic]);



  const handleCloseDetails = useCallback(() => {

    setSelectedId(null);

  }, []);



  const handleReportSuccess = useCallback(() => {

    refresh();

    setStatsRefreshKey((k) => k + 1);

    haptic('medium');

  }, [refresh, haptic]);



  const scrollToReport = useCallback(() => {

    reportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  }, []);



  useEffect(() => {

    if (!isTelegram || selectedId == null) return;

    return showBackButton(handleCloseDetails);

  }, [isTelegram, selectedId, showBackButton, handleCloseDetails]);



  useEffect(() => {

    if (!isTelegram || selectedId == null) return;

    return showMainButton('Сообщить о топливе', scrollToReport);

  }, [isTelegram, selectedId, showMainButton, scrollToReport]);



  const selectedStation = selectedId != null ? stations.find((s) => s.id === selectedId) : null;



  return (

    <div className={`app${isTelegram ? ' app--telegram' : ''}`}>

      {!isTelegram && <WelcomeModal />}



      {isTelegram && isMobile ? (

        <TelegramHeader

          stationCount={stations.length}

          loading={loading}

          onOpenChannel={openChannel}

        />

      ) : (

        <Sidebar

          selectedFuels={selectedFuels}

          hideWithoutFuel={hideWithoutFuel}

          stationCount={stations.length}

          loading={loading}

          statsRefreshKey={statsRefreshKey}

          compact={isTelegram && !isMobile}

          onToggleFuel={toggleFuel}

          onHideWithoutFuelChange={setHideWithoutFuel}

          onSearchSelect={handleSearchSelect}

          onOpenChannel={isTelegram ? openChannel : undefined}

        />

      )}



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



        {isTelegram && isMobile && (

          <div className="tg-filters-bar">

            <button

              type="button"

              className={`tg-filter-chip${selectedFuels.length === 0 ? ' tg-filter-chip--active' : ''}`}

              onClick={() => setSelectedFuels([])}

            >

              Все

            </button>

            {(['ai92', 'ai95', 'dt'] as FuelCode[]).map((code) => (

              <button

                key={code}

                type="button"

                className={`tg-filter-chip${selectedFuels.includes(code) ? ' tg-filter-chip--active' : ''}`}

                onClick={() => toggleFuel(code)}

              >

                {code === 'ai92' ? '92' : code === 'ai95' ? '95' : 'ДТ'}

              </button>

            ))}

          </div>

        )}



        {selectedStation && isTelegram && (

          <div className="map-price-preview" aria-live="polite">

            <strong>{selectedStation.name}</strong>

            <div className="map-price-preview__prices">

              {selectedStation.fuels

                .filter((f) => f.price != null)

                .map((f) => (

                  <span key={f.fuel_code} className="map-price-preview__chip">

                    {f.fuel_name}: {f.price} ₽

                  </span>

                ))}

              {selectedStation.fuels.every((f) => f.price == null) && (

                <span className="muted">Цены появятся после импорта</span>

              )}

            </div>

          </div>

        )}



        {stationsError && (

          <div className="map-toast map-toast--error">{stationsError}</div>

        )}



        {geoError && <div className="map-toast map-toast--error">{geoError}</div>}



        {!isMobile && (

          <StationDetailsPanel

            stationId={selectedId}

            onClose={handleCloseDetails}

            onReportSuccess={handleReportSuccess}

            reportSectionRef={reportSectionRef}

          />

        )}

      </main>



      {isMobile && (

        <StationBottomSheet

          stationId={selectedId}

          onClose={handleCloseDetails}

          onReportSuccess={handleReportSuccess}

          reportSectionRef={reportSectionRef}

        />

      )}

    </div>

  );

}


