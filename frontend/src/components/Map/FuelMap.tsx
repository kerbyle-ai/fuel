import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { StationSummary } from '../../api/types';
import { MAP_DEFAULTS } from '../../constants';
import { createStationIcon } from '../../utils/markers';

interface FuelMapProps {
  stations: StationSummary[];
  selectedId: number | null;
  userPosition: { lat: number; lng: number } | null;
  flyTo: { lat: number; lng: number; zoom?: number } | null;
  onStationClick: (id: number) => void;
  onBboxChange: (bbox: {
    south: number;
    west: number;
    north: number;
    east: number;
  }) => void;
}

export function FuelMap({
  stations,
  selectedId,
  userPosition,
  flyTo,
  onStationClick,
  onBboxChange,
}: FuelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const onBboxRef = useRef(onBboxChange);
  const onClickRef = useRef(onStationClick);

  onBboxRef.current = onBboxChange;
  onClickRef.current = onStationClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom,
      minZoom: MAP_DEFAULTS.minZoom,
      maxZoom: MAP_DEFAULTS.maxZoom,
      maxBounds: MAP_DEFAULTS.bounds,
      maxBoundsViscosity: 0.8,
      attributionControl: false,
    });
    L.control.attribution({ prefix: false }).addTo(map);


    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });
    map.addLayer(cluster);

    const emitBbox = () => {
      const b = map.getBounds();
      onBboxRef.current({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    };

    const syncMap = () => {
      map.invalidateSize();
      emitBbox();
    };

    map.on('moveend', emitBbox);
    mapRef.current = map;
    clusterRef.current = cluster;

    map.whenReady(() => {
      syncMap();
      window.setTimeout(syncMap, 150);
    });

    window.addEventListener('resize', syncMap);

    return () => {
      window.removeEventListener('resize', syncMap);
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();

    for (const station of stations) {
      const marker = L.marker([station.lat, station.lng], {
        icon: createStationIcon(station.status, station.is_stale),
      });
      marker.on('click', () => onClickRef.current(station.id));
      if (station.id === selectedId) {
        marker.setZIndexOffset(1000);
      }
      cluster.addLayer(marker);
    }
  }, [stations, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 14, { duration: 1 });
  }, [flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userPosition) return;

    const marker = L.circleMarker([userPosition.lat, userPosition.lng], {
      radius: 8,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map);

    userMarkerRef.current = marker;
    map.flyTo([userPosition.lat, userPosition.lng], Math.max(map.getZoom(), 13), {
      duration: 1,
    });
  }, [userPosition]);

  return <div ref={containerRef} className="fuel-map" />;
}
