import * as GeoJSON from 'geojson';

/**
 * OSM element types
 */
export type OsmType = 'node' | 'way' | 'relation';

/**
 * Boundary categories for filtering and display
 */
export type BoundaryCategory =
  | 'administrative' // States, cities, districts
  | 'protected_area' // National parks, nature reserves
  | 'route' // Hiking trails, cycling routes
  | 'natural' // Natural features like forests, lakes
  | 'other';

/**
 * Result from boundary search (Nominatim)
 */
export interface BoundarySearchResult {
  /** OSM place ID */
  placeId: number;
  /** OSM ID */
  osmId: number;
  /** OSM type (node, way, relation) */
  osmType: OsmType;
  /** Display name from Nominatim */
  displayName: string;
  /** Short name */
  name: string;
  /** OSM class (e.g., 'boundary', 'route', 'natural') */
  class: string;
  /** OSM type/subtype (e.g., 'administrative', 'hiking', 'national_park') */
  type: string;
  /** Category for display purposes */
  category: BoundaryCategory;
  /** Bounding box [south, north, west, east] */
  boundingBox: [number, number, number, number];
  /** Importance score from Nominatim */
  importance: number;
  /** Simple GeoJSON geometry if available from Nominatim */
  geojson?: GeoJSON.Geometry;
}

/**
 * Active boundary displayed on the map
 */
export interface ActiveBoundary {
  /** Unique ID (combination of osmType and osmId) */
  id: string;
  /** OSM ID */
  osmId: number;
  /** OSM type */
  osmType: OsmType;
  /** Display name */
  name: string;
  /** Full display name with context */
  displayName: string;
  /** Category */
  category: BoundaryCategory;
  /** Assigned display color */
  color: string;
  /** Whether the boundary is visible on the map */
  visible: boolean;
  /** Whether geometry is currently loading */
  loading?: boolean;
  /** GeoJSON feature with the boundary geometry (optional for lazy loading) */
  feature?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.LineString | GeoJSON.MultiLineString>;
  /** Bounding box for fit-to-bounds */
  bounds?: [[number, number], [number, number]]; // [[south, west], [north, east]]
}

/**
 * Nominatim search result with polygon geometry
 */
export interface NominatimBoundaryResult {
  place_id: number;
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
  boundingbox: [string, string, string, string];
  geojson?: GeoJSON.Geometry;
}

/**
 * Overpass API response element
 */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: OverpassMember[];
  geometry?: Array<{ lat: number; lon: number }>;
  bounds?: {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  };
}

/**
 * Overpass relation member
 */
export interface OverpassMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: Array<{ lat: number; lon: number }>;
}

/**
 * Overpass API response structure
 */
export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

/**
 * Predefined boundary colors for auto-assignment
 */
export const BOUNDARY_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#ef4444', // red
  '#6366f1', // indigo
  '#84cc16', // lime
] as const;

/**
 * Map OSM class/type to boundary category
 */
export function getBoundaryCategory(osmClass: string, osmType: string): BoundaryCategory {
  // Administrative boundaries
  if (osmClass === 'boundary' && osmType === 'administrative') {
    return 'administrative';
  }

  // Protected areas
  if (
    osmClass === 'boundary' &&
    ['protected_area', 'national_park', 'nature_reserve'].includes(osmType)
  ) {
    return 'protected_area';
  }
  if (osmClass === 'leisure' && osmType === 'nature_reserve') {
    return 'protected_area';
  }

  // Routes (hiking trails, cycling routes)
  if (osmClass === 'route' || osmType === 'route') {
    return 'route';
  }

  // Natural features
  if (['natural', 'landuse', 'waterway'].includes(osmClass)) {
    return 'natural';
  }

  return 'other';
}
