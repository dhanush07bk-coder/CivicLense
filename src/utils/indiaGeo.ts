export const INDIA_COUNTRY_CODE = 'IN' as const;
export const INDIA_COUNTRY_NAME = 'India' as const;

export const INDIAN_STATES_AND_UTS: readonly string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

const STATE_SET = new Set(INDIAN_STATES_AND_UTS.map((s) => s.toLowerCase()));

export interface IndianPlacePreset {
  id: string;
  label: string;
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  lat: number;
  lng: number;
}

export const INDIAN_PLACE_PRESETS: IndianPlacePreset[] = [
  {
    id: 'in-blr-indiranagar',
    label: 'Indiranagar, Bengaluru, Karnataka',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    locality: 'Indiranagar 12th Main',
    pin_code: '560038',
    lat: 12.9719,
    lng: 77.6412,
  },
  {
    id: 'in-blr-koramangala',
    label: 'Koramangala, Bengaluru, Karnataka',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    locality: 'Koramangala 4th Block',
    pin_code: '560034',
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    id: 'in-mys-gokulam',
    label: 'Gokulam, Mysuru, Karnataka',
    state: 'Karnataka',
    district: 'Mysuru',
    city: 'Mysuru',
    locality: 'Gokulam 3rd Stage',
    pin_code: '570002',
    lat: 12.3264,
    lng: 76.6256,
  },
  {
    id: 'in-chn-mylapore',
    label: 'Mylapore, Chennai, Tamil Nadu',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    locality: 'Mylapore Tank Square',
    pin_code: '600004',
    lat: 13.0339,
    lng: 80.2676,
  },
  {
    id: 'in-hyd-banjara',
    label: 'Banjara Hills, Hyderabad, Telangana',
    state: 'Telangana',
    district: 'Hyderabad',
    city: 'Hyderabad',
    locality: 'Banjara Hills Road No. 12',
    pin_code: '500034',
    lat: 17.4126,
    lng: 78.4398,
  },
  {
    id: 'in-cok-fortkochi',
    label: 'Fort Kochi, Kochi, Kerala',
    state: 'Kerala',
    district: 'Ernakulam',
    city: 'Kochi',
    locality: 'Fort Kochi Parade Ground',
    pin_code: '682001',
    lat: 9.9658,
    lng: 76.2421,
  },
  {
    id: 'in-pnq-shivajinagar',
    label: 'Shivajinagar, Pune, Maharashtra',
    state: 'Maharashtra',
    district: 'Pune',
    city: 'Pune',
    locality: 'Shivajinagar FC Road',
    pin_code: '411004',
    lat: 18.5289,
    lng: 73.8419,
  },
  {
    id: 'in-del-lodhi',
    label: 'Lodhi Colony, New Delhi, Delhi',
    state: 'Delhi',
    district: 'New Delhi',
    city: 'New Delhi',
    locality: 'Lodhi Colony Block 4',
    pin_code: '110003',
    lat: 28.5877,
    lng: 77.2248,
  },
  {
    id: 'in-bom-bandra',
    label: 'Bandra West, Mumbai, Maharashtra',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    city: 'Mumbai',
    locality: 'Pali Hill, Bandra West',
    pin_code: '400050',
    lat: 19.0607,
    lng: 72.8295,
  },
  {
    id: 'in-ccu-saltlake',
    label: 'Salt Lake Sector I, Kolkata, West Bengal',
    state: 'West Bengal',
    district: 'North 24 Parganas',
    city: 'Kolkata',
    locality: 'Bidhannagar Sector I',
    pin_code: '700064',
    lat: 22.5867,
    lng: 88.4171,
  },
  {
    id: 'in-jpr-cscheme',
    label: 'C-Scheme, Jaipur, Rajasthan',
    state: 'Rajasthan',
    district: 'Jaipur',
    city: 'Jaipur',
    locality: 'Ashok Nagar, C-Scheme',
    pin_code: '302001',
    lat: 26.9068,
    lng: 75.7995,
  },
  {
    id: 'in-gau-panbazar',
    label: 'Pan Bazaar, Guwahati, Assam',
    state: 'Assam',
    district: 'Kamrup Metropolitan',
    city: 'Guwahati',
    locality: 'Pan Bazaar Station Road',
    pin_code: '781001',
    lat: 26.1859,
    lng: 91.7443,
  },
];

/**
 * Simplified multi-polygon geographic boundary for India [lat, lng]
 * (Mainland India + Andaman & Nicobar + Lakshadweep).
 * Rejects neighbouring overseas countries and open ocean even inside outer lat/lng bounds.
 */
export const INDIA_MAINLAND_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [23.7, 68.15],
  [24.5, 68.7],
  [24.9, 71.1],
  [26.9, 69.5],
  [28.0, 70.5],
  [30.1, 73.8],
  [31.6, 74.55],
  [32.6, 74.4],
  [34.3, 73.7],
  [35.2, 74.3],
  [37.05, 74.6],
  [35.6, 77.9],
  [34.4, 79.1],
  [32.7, 78.9],
  [31.3, 79.1],
  [30.1, 80.3],
  [28.9, 80.1],
  [27.9, 81.9],
  [27.4, 84.5],
  [26.4, 88.1],
  [27.15, 88.0],
  [28.05, 88.65],
  [27.2, 88.9],
  [26.7, 89.8],
  [26.8, 92.1],
  [27.8, 91.6],
  [29.4, 96.1],
  [28.2, 97.4],
  [26.8, 95.6],
  [24.5, 94.6],
  [23.7, 93.4],
  [21.95, 93.05],
  [22.9, 92.2],
  [24.4, 92.2],
  [25.15, 92.4],
  [25.2, 89.9],
  [26.1, 89.8],
  [26.3, 88.3],
  [25.1, 88.8],
  [24.1, 88.6],
  [22.6, 89.0],
  [21.55, 88.9],
  [21.6, 87.5],
  [19.8, 86.1],
  [17.7, 83.4],
  [15.8, 81.2],
  [13.1, 80.35],
  [10.3, 79.9],
  [9.2, 79.45],
  [8.05, 77.55],
  [8.45, 76.9],
  [10.0, 76.18],
  [12.8, 74.82],
  [15.4, 73.75],
  [18.95, 72.75],
  [20.8, 72.7],
  [21.6, 72.1],
  [20.7, 70.9],
  [22.2, 68.9],
  [23.1, 68.3],
];

const ANDAMAN_NICOBAR_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [13.7, 92.8],
  [13.6, 93.2],
  [11.5, 93.1],
  [9.2, 92.95],
  [6.74, 93.95],
  [6.8, 93.6],
  [9.1, 92.55],
  [11.5, 92.4],
  [13.4, 92.6],
];

const LAKSHADWEEP_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [12.4, 71.7],
  [12.4, 73.9],
  [8.2, 73.9],
  [8.2, 71.7],
];

function pointInPolygon(
  lat: number,
  lng: number,
  polygon: ReadonlyArray<readonly [number, number]>,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isCoordinateWithinIndia(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < 6.5 || lat > 37.2 || lng < 68.0 || lng > 97.5) return false;

  return (
    pointInPolygon(lat, lng, INDIA_MAINLAND_POLYGON) ||
    pointInPolygon(lat, lng, ANDAMAN_NICOBAR_POLYGON) ||
    pointInPolygon(lat, lng, LAKSHADWEEP_POLYGON)
  );
}

export function isValidIndianState(state: string): boolean {
  return STATE_SET.has(state.trim().toLowerCase());
}

export function validateIndianPinCode(pin: string): boolean {
  const cleaned = pin.trim();
  // Indian PIN codes are exactly 6 digits and begin with 1-8 (9 is Army Post Office / invalid civilian circle, 0 is unused)
  return /^[1-8][0-9]{5}$/.test(cleaned);
}

const OVERSEAS_KEYWORDS = [
  'united states',
  'usa',
  'u.s.a',
  'united kingdom',
  'uk',
  'england',
  'london',
  'new york',
  'los angeles',
  'san francisco',
  'toronto',
  'canada',
  'dubai',
  'uae',
  'singapore',
  'australia',
  'sydney',
  'melbourne',
  'germany',
  'berlin',
  'france',
  'paris',
  'tokyo',
  'japan',
  'pakistan',
  'karachi',
  'lahore',
  'islamabad',
  'bangladesh',
  'dhaka',
  'sri lanka',
  'colombo',
  'nepal',
  'kathmandu',
  'bhutan',
  'thimphu',
  'china',
  'beijing',
  'shanghai',
];

export function containsOverseasLocationText(text: string): boolean {
  const normalized = text.toLowerCase();
  return OVERSEAS_KEYWORDS.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(normalized);
  });
}

export interface NominatimSearchItem {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    country_code?: string;
    country?: string;
    state?: string;
    state_district?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    road?: string;
    postcode?: string;
  };
}

export interface ParsedIndianNominatimResult {
  id: string;
  displayName: string;
  country_code: 'IN';
  state: string;
  district: string;
  city: string;
  locality: string;
  pin_code: string;
  lat: number;
  lng: number;
}

export function matchIndianStateName(rawState?: string): string {
  if (!rawState) return '';
  const trimmed = rawState.trim();
  const exact = INDIAN_STATES_AND_UTS.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return exact;

  // Handle common Nominatim aliases in India
  const lower = trimmed.toLowerCase();
  if (lower.includes('delhi') || lower.includes('nct')) return 'Delhi';
  if (lower.includes('orissa')) return 'Odisha';
  if (lower.includes('pondicherry')) return 'Puducherry';
  if (lower.includes('dadra') || lower.includes('daman')) {
    return 'Dadra and Nagar Haveli and Daman and Diu';
  }
  if (lower.includes('andaman')) return 'Andaman and Nicobar Islands';
  if (lower.includes('jammu')) return 'Jammu and Kashmir';
  return '';
}

export function validateAndParseNominatimIndiaResult(
  item: NominatimSearchItem,
): ParsedIndianNominatimResult | null {
  const countryCode = item.address?.country_code?.toLowerCase();
  if (countryCode !== 'in') {
    return null;
  }

  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!isCoordinateWithinIndia(lat, lng)) {
    return null;
  }

  const matchedState = matchIndianStateName(item.address?.state);
  const district = (
    item.address?.state_district ||
    item.address?.county ||
    item.address?.city ||
    ''
  )
    .replace(/\s+district$/i, '')
    .trim();
  const city = (
    item.address?.city ||
    item.address?.town ||
    item.address?.village ||
    district ||
    ''
  ).trim();
  const locality = (
    item.address?.suburb ||
    item.address?.neighbourhood ||
    item.address?.road ||
    city ||
    ''
  ).trim();
  const rawPost = (item.address?.postcode ?? '').replace(/\s+/g, '');
  const pin_code = validateIndianPinCode(rawPost) ? rawPost : '';

  return {
    id: String(item.place_id),
    displayName: item.display_name,
    country_code: 'IN',
    state: matchedState,
    district,
    city,
    locality,
    pin_code,
    lat,
    lng,
  };
}

export function findNearestIndianPreset(
  lat: number,
  lng: number,
): IndianPlacePreset | null {
  if (!isCoordinateWithinIndia(lat, lng)) return null;
  let closest: IndianPlacePreset | null = null;
  let minDist = Infinity;

  for (const preset of INDIAN_PLACE_PRESETS) {
    const dLat = preset.lat - lat;
    const dLng = preset.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDist) {
      minDist = dist;
      closest = preset;
    }
  }
  return closest;
}
