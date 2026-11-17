import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, MapPin, Search, XCircle } from 'lucide-react';
import {
  containsOverseasLocationText,
  findNearestIndianPreset,
  INDIA_MAINLAND_POLYGON,
  INDIAN_PLACE_PRESETS,
  isCoordinateWithinIndia,
  NominatimSearchItem,
  ParsedIndianNominatimResult,
  validateAndParseNominatimIndiaResult,
} from '../utils/indiaGeo';

export interface SelectedIndiaMapLocation {
  lat: number;
  lng: number;
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  zoneLabel: string;
}

interface LocationPickerMapProps {
  selected?: SelectedIndiaMapLocation;
  onSelect: (location: SelectedIndiaMapLocation) => void;
}

const INDIA_CENTER: [number, number] = [21.7679, 78.8718];
const INDIA_BOUNDS: L.LatLngBoundsExpression = [
  [5.8, 66.5],
  [37.8, 98.5],
];

function createCivilensePinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'civilense-map-pin',
    html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#254B33;border:2px solid #ffffff;border-radius:9999px;box-shadow:0 2px 6px rgba(6,39,26,0.35);color:#ffffff;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  selected,
  onSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ParsedIndianNominatimResult[]>([]);
  const [mapNotice, setMapNotice] = useState<{
    type: 'error' | 'info' | 'confirmed';
    message: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const placeMarkerOnMap = (lat: number, lng: number, zoomTo = 13) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], {
        icon: createCivilensePinIcon(),
      }).addTo(map);
    }
    map.setView([lat, lng], Math.max(map.getZoom(), zoomTo), { animate: true });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: 4,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 0.9,
      zoomControl: true,
    });

    // OpenStreetMap tile layer (falls back cleanly onto India polygon boundary if offline)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // Geographic boundary polygon of India for clear visual framing and offline resilience
    L.polygon(
      INDIA_MAINLAND_POLYGON.map(([lat, lng]) => [lat, lng] as [number, number]),
      {
        color: '#254B33',
        weight: 1.5,
        opacity: 0.75,
        fillColor: '#B5D8C7',
        fillOpacity: 0.16,
      },
    ).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (!isCoordinateWithinIndia(lat, lng)) {
        setConfirmed(false);
        setMapNotice({
          type: 'error',
          message:
            'Locations outside India cannot be selected. Click inside Indian territory or search an Indian city/PIN.',
        });
        return;
      }

      const nearest = findNearestIndianPreset(lat, lng);
      const nextLoc: SelectedIndiaMapLocation = {
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        state: nearest?.state ?? '',
        district: nearest?.district ?? '',
        city: nearest?.city ?? '',
        locality: nearest?.locality ?? '',
        pin_code: nearest?.pin_code ?? '',
        zoneLabel: nearest
          ? `Pinned near ${nearest.city}, ${nearest.state}`
          : `India (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      };

      placeMarkerOnMap(lat, lng, 12);
      onSelect(nextLoc);
      setConfirmed(false);
      setMapNotice({
        type: 'info',
        message:
          'Pin placed inside India. Review or adjust the locality/PIN fields below, then confirm.',
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (selected && isCoordinateWithinIndia(selected.lat, selected.lng)) {
      placeMarkerOnMap(selected.lat, selected.lng, 12);
    }
  }, [selected?.lat, selected?.lng]);

  const handleIndiaSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setConfirmed(false);
    if (containsOverseasLocationText(q)) {
      setSearchResults([]);
      setMapNotice({
        type: 'error',
        message:
          'Overseas location searches are blocked. Civilense operates exclusively within India.',
      });
      return;
    }

    setSearching(true);
    setMapNotice(null);

    // 1. Instant local Indian city/locality/PIN preset matches
    const lowerQ = q.toLowerCase();
    const localMatches: ParsedIndianNominatimResult[] = INDIAN_PLACE_PRESETS.filter(
      (p) =>
        p.label.toLowerCase().includes(lowerQ) ||
        p.city.toLowerCase().includes(lowerQ) ||
        p.state.toLowerCase().includes(lowerQ) ||
        p.locality.toLowerCase().includes(lowerQ) ||
        p.pin_code.includes(q),
    ).map((p) => ({
      id: p.id,
      displayName: `${p.locality}, ${p.city}, ${p.district}, ${p.state} ${p.pin_code}, India`,
      country_code: 'IN',
      state: p.state,
      district: p.district,
      city: p.city,
      locality: p.locality,
      pin_code: p.pin_code,
      lat: p.lat,
      lng: p.lng,
    }));

    try {
      // 2. OpenStreetMap Nominatim strictly restricted to countrycodes=in
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&addressdetails=1&limit=6&q=${encodeURIComponent(
        q,
      )}`;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3500);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      window.clearTimeout(timeout);

      if (response.ok) {
        const raw = (await response.json()) as NominatimSearchItem[];
        const validated = raw
          .map(validateAndParseNominatimIndiaResult)
          .filter((item): item is ParsedIndianNominatimResult => item !== null);

        const merged = [...localMatches];
        for (const item of validated) {
          if (!merged.some((m) => m.displayName === item.displayName)) {
            merged.push(item);
          }
        }
        setSearchResults(merged);
        if (merged.length === 0) {
          setMapNotice({
            type: 'info',
            message:
              'No matching Indian locations found. You can enter State, District, City, Locality, and PIN Code manually above.',
          });
        }
      } else {
        setSearchResults(localMatches);
      }
    } catch {
      // Offline / sandbox fallback uses validated local Indian matches
      setSearchResults(localMatches);
      if (localMatches.length === 0) {
        setMapNotice({
          type: 'info',
          message:
            'No preset Indian locality matched that search. Select a city chip below, click India on the map, or enter fields manually.',
        });
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (res: ParsedIndianNominatimResult) => {
    if (!isCoordinateWithinIndia(res.lat, res.lng) || res.country_code !== 'IN') {
      setMapNotice({
        type: 'error',
        message: 'Rejected non-India search result.',
      });
      return;
    }

    placeMarkerOnMap(res.lat, res.lng, 14);
    onSelect({
      lat: res.lat,
      lng: res.lng,
      state: res.state,
      district: res.district,
      city: res.city,
      locality: res.locality,
      pin_code: res.pin_code,
      zoneLabel: `${res.locality || res.city}, ${res.state}`,
    });
    setSearchResults([]);
    setConfirmed(false);
    setMapNotice({
      type: 'info',
      message: `Selected ${res.city || res.locality}, ${res.state}. Adjust if needed and confirm.`,
    });
  };

  const handlePresetClick = (presetId: string) => {
    const preset = INDIAN_PLACE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    placeMarkerOnMap(preset.lat, preset.lng, 14);
    onSelect({
      lat: preset.lat,
      lng: preset.lng,
      state: preset.state,
      district: preset.district,
      city: preset.city,
      locality: preset.locality,
      pin_code: preset.pin_code,
      zoneLabel: `${preset.locality}, ${preset.city} (${preset.pin_code})`,
    });
    setSearchResults([]);
    setConfirmed(false);
    setMapNotice({
      type: 'info',
      message: `Map centered on ${preset.city}, ${preset.state}. Click Confirm Selected Location or click the map to fine-tune.`,
    });
  };

  return (
    <div className="rounded-xl border border-[#B5D8C7] bg-[#F5FAF7] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#06271A]">
            India Map Location Selector (OpenStreetMap / Nominatim · IN Only)
          </p>
          <p className="text-xs text-[#254B33]/85">
            Search Indian cities, localities, or 6-digit PIN codes, or click inside
            India to drop a pin. Overseas locations are blocked.
          </p>
        </div>
        {selected && (
          <span className="font-mono-tabular rounded border border-[#9CCCCC] bg-white px-2.5 py-1 text-xs font-medium text-[#06271A]">
            {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
          </span>
        )}
      </div>

      {/* India-Restricted Search Input */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="india-map-search" className="sr-only">
            Search Indian city, locality, or PIN code
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#5E9185]"
            aria-hidden="true"
          />
          <input
            id="india-map-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleIndiaSearch();
              }
            }}
            placeholder="Search Indian locality, city, or PIN (e.g., Indiranagar 560038)"
            className="w-full rounded-lg border border-[#9CCCCC] bg-white py-2 pr-3 pl-9 text-xs text-[#06271A] placeholder:text-[#5E9185]/80 focus:border-[#254B33] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleIndiaSearch()}
          disabled={searching}
          className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-[#254B33] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#06271A] disabled:opacity-60 whitespace-nowrap"
        >
          {searching ? 'Searching India...' : 'Search India'}
        </button>
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <ul
          aria-label="Indian location search results"
          className="divide-y divide-[#B5D8C7]/60 rounded-lg border border-[#9CCCCC] bg-white"
        >
          {searchResults.map((res) => (
            <li key={res.id}>
              <button
                type="button"
                onClick={() => handleSelectSearchResult(res)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-[#06271A] hover:bg-[#F5FAF7]"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#254B33]" aria-hidden="true" />
                <span>{res.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Quick Indian City Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-[#254B33]">Quick zoom:</span>
        {Array.from(
          new Map(INDIAN_PLACE_PRESETS.map((p) => [p.city, p])).values(),
        )
          .slice(0, 7)
          .map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset.id)}
              className="rounded border border-[#B5D8C7] bg-white px-2 py-1 text-[11px] font-medium text-[#254B33] transition-colors hover:border-[#254B33] hover:bg-[#B5D8C7]/35"
            >
              {preset.city}
            </button>
          ))}
        <button
          type="button"
          onClick={() => {
            mapRef.current?.setView(INDIA_CENTER, 4, { animate: true });
          }}
          className="rounded border border-[#9CCCCC] bg-[#EAF4EE] px-2 py-1 text-[11px] font-medium text-[#06271A] hover:bg-[#B5D8C7]/45"
        >
          Reset to India
        </button>
      </div>

      {/* Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        data-testid="india-leaflet-map"
        className="h-64 w-full overflow-hidden rounded-lg border border-[#9CCCCC] bg-[#EAF4EE] z-0"
      />

      {/* Feedback & Confirmation Controls */}
      {mapNotice && (
        <div
          role={mapNotice.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
            mapNotice.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900'
              : mapNotice.type === 'confirmed'
                ? 'border-[#254B33] bg-[#B5D8C7]/40 text-[#06271A]'
                : 'border-[#9CCCCC] bg-white text-[#254B33]'
          }`}
        >
          {mapNotice.type === 'error' ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#254B33]" aria-hidden="true" />
          )}
          <span>{mapNotice.message}</span>
        </div>
      )}

      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#B5D8C7] bg-white px-3 py-2 text-xs">
          <span className="text-[#254B33]">
            Selected pin: <strong className="text-[#06271A]">{selected.zoneLabel}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setConfirmed(true);
              setMapNotice({
                type: 'confirmed',
                message: `Confirmed reporting coordinates inside India (${selected.lat.toFixed(
                  4,
                )}, ${selected.lng.toFixed(4)}).`,
              });
            }}
            className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition-colors ${
              confirmed
                ? 'bg-[#254B33] text-white'
                : 'border border-[#254B33] bg-[#F5FAF7] text-[#254B33] hover:bg-[#254B33] hover:text-white'
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{confirmed ? 'Location Confirmed' : 'Confirm Selected Location'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
