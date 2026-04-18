import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon, icons } from './Icons';

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const donorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const clusterIcon = (count) =>
  L.divIcon({
    className: 'donor-cluster-icon',
    html: `<div class="donor-cluster-badge">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });

function FitBounds({ target, donors }) {
  const map = useMap();

  const bounds = useMemo(() => {
    const points = [
      [target.lat, target.lng],
      ...donors
        .filter((donor) => Number.isFinite(donor.lat) && Number.isFinite(donor.lng))
        .map((donor) => [donor.lat, donor.lng])
    ];

    if (!L?.latLngBounds) {
      return null;
    }

    return L.latLngBounds(points);
  }, [donors, target.lat, target.lng]);

  useEffect(() => {
    if (!bounds || typeof bounds.isValid !== 'function' || !bounds.isValid()) {
      return;
    }

    map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 13
    });
  }, [bounds, map]);

  return null;
}

function MapInteractions({
  pickMode,
  onPickTarget,
  focusedDonor
}) {
  const map = useMap();

  useMapEvents({
    click(event) {
      if (!pickMode) return;
      onPickTarget?.(event.latlng);
    }
  });

  useEffect(() => {
    if (!focusedDonor) {
      return;
    }

    map.flyTo([focusedDonor.lat, focusedDonor.lng], Math.max(map.getZoom?.() || 12, 13), {
      duration: 0.6
    });
  }, [focusedDonor, map]);

  return null;
}

function formatPinnedName(lat, lng) {
  const latLabel = Number(lat).toFixed(4);
  const lngLabel = Number(lng).toFixed(4);
  return `Pinned (${latLabel}, ${lngLabel})`;
}

function clusterDonors(donors, grid = 0.012) {
  const buckets = new Map();

  donors.forEach((donor) => {
    const bucketLat = Math.round(donor.lat / grid);
    const bucketLng = Math.round(donor.lng / grid);
    const key = `${bucketLat}:${bucketLng}`;
    const bucket = buckets.get(key) || { members: [], sumLat: 0, sumLng: 0 };
    bucket.members.push(donor);
    bucket.sumLat += donor.lat;
    bucket.sumLng += donor.lng;
    buckets.set(key, bucket);
  });

  return [...buckets.entries()].map(([key, bucket]) => ({
    id: `cluster:${key}`,
    lat: bucket.sumLat / bucket.members.length,
    lng: bucket.sumLng / bucket.members.length,
    members: bucket.members
  }));
}

async function fetchOsrmRoute({ fromLat, fromLng, toLat, toLng, signal }) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`OSRM route request failed (${response.status}).`);
  }

  const data = await response.json();
  const route = data?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error('OSRM returned an invalid route geometry.');
  }

  return coordinates.map(([lng, lat]) => [lat, lng]);
}

export default function LiveMap({
  donors = [],
  activeRequest,
  focusedDonorId = null,
  onFocusDonor,
  pickMode = false,
  onPickTarget,
  showControls = true,
  showLegendDefault = true,
  maxRoutedDonors = 6
}) {
  const target = {
    name: activeRequest?.location || 'AIIMS Emergency Wing',
    status: activeRequest?.status || 'Awaiting update',
    blood: activeRequest?.blood || 'O-',
    units: activeRequest?.units || 1,
    lat: Number(activeRequest?.lat ?? 28.567),
    lng: Number(activeRequest?.lng ?? 77.21)
  };

  const safeDonors = donors.filter((donor) => Number.isFinite(donor.lat) && Number.isFinite(donor.lng));
  const [showLegend, setShowLegend] = useState(showLegendDefault);
  const [showEtaPanel, setShowEtaPanel] = useState(true);
  const [, bumpRoutesVersion] = useState(0);
  const routesRef = useRef(new Map());
  const shouldFetchOsrm = typeof window !== 'undefined' && process.env.NODE_ENV !== 'test';

  const focusedDonor = useMemo(() => {
    if (!focusedDonorId) return null;
    const direct = safeDonors.find((donor) => donor.id === focusedDonorId);
    if (direct) return direct;
    return safeDonors.find((donor) => donor.name === focusedDonorId) || null;
  }, [focusedDonorId, safeDonors]);

  const donorsSorted = useMemo(() => {
    const etaValue = (donor) => (Number.isFinite(Number(donor.eta)) ? Number(donor.eta) : Number.POSITIVE_INFINITY);
    return [...safeDonors].sort((left, right) => etaValue(left) - etaValue(right));
  }, [safeDonors]);

  const clusters = useMemo(() => clusterDonors(safeDonors), [safeDonors]);

  const donorsToRoute = useMemo(() => {
    const selected = donorsSorted.slice(0, maxRoutedDonors);
    if (focusedDonor && !selected.some((donor) => donor.id === focusedDonor.id)) {
      selected.unshift(focusedDonor);
    }
    return selected.slice(0, Math.max(1, maxRoutedDonors));
  }, [donorsSorted, focusedDonor, maxRoutedDonors]);

  useEffect(() => {
    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const ensureRoute = async (donor) => {
      const key = `${donor.id || donor.name}:${target.lat.toFixed(5)},${target.lng.toFixed(5)}`;
      if (routesRef.current.has(key)) {
        return;
      }

      routesRef.current.set(key, {
        status: 'loading',
        points: [
          [donor.lat, donor.lng],
          [target.lat, target.lng]
        ]
      });
      bumpRoutesVersion((value) => value + 1);

      try {
        if (!shouldFetchOsrm) {
          throw new Error('OSRM disabled.');
        }

        const points = await fetchOsrmRoute({
          fromLat: donor.lat,
          fromLng: donor.lng,
          toLat: target.lat,
          toLng: target.lng,
          signal: controller?.signal
        });

        if (cancelled) return;
        routesRef.current.set(key, { status: 'ready', points });
        bumpRoutesVersion((value) => value + 1);
      } catch (error) {
        if (cancelled) return;
        routesRef.current.set(key, {
          status: 'fallback',
          points: [
            [donor.lat, donor.lng],
            [target.lat, target.lng]
          ]
        });
        bumpRoutesVersion((value) => value + 1);
      }
    };

    donorsToRoute.forEach((donor) => void ensureRoute(donor));

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [donorsToRoute, shouldFetchOsrm, target.lat, target.lng]);

  return (
    <div className={`map-wrapper live-map-shell ${pickMode ? 'live-map-pick' : ''}`} aria-label="Live donor tracking map">
      {showControls && (
        <div className="live-map-overlay live-map-toolbar">
          <button
            type="button"
            className="live-map-btn"
            onClick={() => setShowEtaPanel((value) => !value)}
          >
            <Icon d={icons.users} size={14} />
            {showEtaPanel ? 'Hide ETAs' : 'Show ETAs'}
          </button>
          <button
            type="button"
            className="live-map-btn"
            onClick={() => setShowLegend((value) => !value)}
          >
            <Icon d={icons.menu} size={14} />
            {showLegend ? 'Hide Legend' : 'Show Legend'}
          </button>
        </div>
      )}

      {showLegend && (
        <div className="live-map-overlay live-map-legend">
          <div><span className="legend-swatch legend-swatch-hospital"></span> Drop site</div>
          <div><span className="legend-swatch legend-swatch-route"></span> Route (OSRM)</div>
          <div><span className="legend-swatch legend-swatch-donor"></span> Donor</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 12 }}>
            OSRM failures fall back to straight-line.
          </div>
        </div>
      )}

      {showEtaPanel && (
        <div className="live-map-overlay live-map-eta">
          <div className="live-map-eta-title">Inbound Donors</div>
          {donorsSorted.slice(0, 5).map((donor) => {
            const isFocused = focusedDonor?.id === donor.id;
            return (
              <button
                key={donor.id || donor.name}
                type="button"
                className={`live-map-eta-row ${isFocused ? 'active' : ''}`}
                onClick={() => onFocusDonor?.(donor.id || donor.name)}
              >
                <span className="live-map-eta-name">{donor.name}</span>
                <span className="live-map-eta-meta">{Number.isFinite(Number(donor.eta)) ? `${donor.eta}m` : '--'}</span>
              </button>
            );
          })}
        </div>
      )}

      {pickMode && (
        <div className="live-map-overlay live-map-pick-hint" role="status">
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-map-crosshair"></span>
            Click the map to set the drop site
          </div>
          <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
            Current: {activeRequest?.location || formatPinnedName(target.lat, target.lng)}
          </div>
        </div>
      )}

      <MapContainer
        center={[target.lat, target.lng]}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {!focusedDonor && <FitBounds target={target} donors={safeDonors} />}
        <MapInteractions
          pickMode={pickMode}
          onPickTarget={onPickTarget}
          focusedDonor={focusedDonor}
        />

        <Marker position={[target.lat, target.lng]} icon={hospitalIcon}>
          <Popup className="glass-popup">
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon d={icons.map_pin} size={14} color="var(--primary)" />
              {target.name}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {target.blood} need, {target.units} unit{target.units === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{target.status}</div>
          </Popup>
        </Marker>

        <Circle
          center={[target.lat, target.lng]}
          radius={2200}
          pathOptions={{ color: '#e8193c', fillColor: '#e8193c', fillOpacity: 0.08 }}
        />

        {clusters.map((cluster) => {
          if (cluster.members.length === 1) {
            const donor = cluster.members[0];
            const isFocused = focusedDonor?.id === donor.id;
            return (
              <Marker
                key={donor.id || donor.name}
                position={[donor.lat, donor.lng]}
                icon={donorIcon}
                eventHandlers={{
                  click: () => onFocusDonor?.(donor.id || donor.name)
                }}
              >
                <Popup>
                  <strong>{donor.name}</strong>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{donor.blood} donor</div>
                  <div style={{ fontSize: 12 }}>ETA {Number.isFinite(Number(donor.eta)) ? donor.eta : '--'} min</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{donor.status}</div>
                  {!isFocused && (
                    <button
                      type="button"
                      style={{ marginTop: 10 }}
                      className="live-map-inline-btn"
                      onClick={() => onFocusDonor?.(donor.id || donor.name)}
                    >
                      Focus
                    </button>
                  )}
                </Popup>
              </Marker>
            );
          }

          return (
            <Marker
              key={cluster.id}
              position={[cluster.lat, cluster.lng]}
              icon={clusterIcon(cluster.members.length)}
            >
              <Popup>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Cluster ({cluster.members.length})</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {cluster.members.slice(0, 8).map((donor) => (
                    <button
                      key={donor.id || donor.name}
                      type="button"
                      className="live-map-inline-row"
                      onClick={() => onFocusDonor?.(donor.id || donor.name)}
                    >
                      <span>{donor.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{Number.isFinite(Number(donor.eta)) ? `${donor.eta}m` : '--'}</span>
                    </button>
                  ))}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {donorsToRoute.map((donor) => {
          const key = `${donor.id || donor.name}:${target.lat.toFixed(5)},${target.lng.toFixed(5)}`;
          const route = routesRef.current.get(key);
          const points = route?.points || [
            [donor.lat, donor.lng],
            [target.lat, target.lng]
          ];

          const isFocused = focusedDonor?.id === donor.id;
          const dimmed = Boolean(focusedDonor) && !isFocused;
          const isFallback = route?.status === 'fallback';

          return (
            <Polyline
              key={`route:${key}`}
              positions={points}
              pathOptions={{
                color: isFallback ? '#f59e0b' : '#10b981',
                dashArray: isFallback ? '2 10' : '6 10',
                weight: isFocused ? 5 : 3,
                opacity: dimmed ? 0.25 : 0.85
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
