/**
 * Nominatim API response interface
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */
export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

/**
 * Parsed result with typed coordinates
 */
export interface ParsedNominatimResult {
  placeId: number;
  lat: number;
  lon: number;
  class: string;
  type: string;
  name: string;
  displayName: string;
  boundingbox: [number, number, number, number];
}

/**
 * Location type categories for icons
 */
export type LocationCategory =
  | 'city'
  | 'town'
  | 'village'
  | 'street'
  | 'building'
  | 'poi'
  | 'natural'
  | 'other';

/**
 * Map Nominatim class/type to a category for icon display
 */
export function getLocationCategory(result: ParsedNominatimResult): LocationCategory {
  const { class: placeClass, type } = result;

  // Cities and settlements
  if (placeClass === 'place') {
    if (['city', 'metropolis'].includes(type)) return 'city';
    if (['town', 'municipality'].includes(type)) return 'town';
    if (['village', 'hamlet', 'suburb', 'neighbourhood', 'locality'].includes(type)) return 'village';
  }

  // Administrative boundaries often represent cities/towns
  if (placeClass === 'boundary' && type === 'administrative') {
    return 'city';
  }

  // Streets and roads
  if (placeClass === 'highway') {
    return 'street';
  }

  // Buildings
  if (placeClass === 'building' || placeClass === 'amenity') {
    return 'building';
  }

  // POIs (shops, tourism, leisure)
  if (['shop', 'tourism', 'leisure', 'office', 'craft'].includes(placeClass)) {
    return 'poi';
  }

  // Natural features
  if (['natural', 'waterway', 'landuse'].includes(placeClass)) {
    return 'natural';
  }

  return 'other';
}
