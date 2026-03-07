/**
 * Overpass API types for POI queries
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 */

/**
 * Raw Overpass API element from JSON response
 */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

/**
 * Raw Overpass API response
 */
export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OverpassElement[];
}

/**
 * Parsed POI result with typed coordinates
 */
export interface POIResult {
  id: number;
  lat: number;
  lng: number;
  name: string;
  type: string;
  category: string;
  tags: Record<string, string>;
  osmType: 'node' | 'way' | 'relation';
}

/**
 * POI category definition
 */
export interface POICategory {
  id: string;
  name: string;
  nameKey: string; // i18n key for translation
  icon: string; // Emoji or icon identifier
  color: string; // Hex color for markers
  markerIcon: string; // SVG path or icon name
  osmTags: POIOsmTag[];
}

/**
 * OSM tag definition for a POI category
 */
export interface POIOsmTag {
  key: string;
  value: string;
}

/**
 * Bounding box for Overpass queries
 * Format: south, west, north, east
 */
export interface OverpassBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Cache entry for POI queries
 */
export interface POICacheEntry {
  results: POIResult[];
  timestamp: number;
  bounds: OverpassBounds;
}

/**
 * Rate limit state
 */
export interface RateLimitState {
  lastRequest: number;
  requestCount: number;
  isLimited: boolean;
  retryAfter?: number;
}

/**
 * Predefined POI categories with Overpass query definitions
 */
export const POI_CATEGORIES: POICategory[] = [
  {
    id: 'hotels',
    name: 'Hotels & Accommodation',
    nameKey: 'poi.hotels',
    icon: '🏨',
    color: '#8B5CF6',
    markerIcon: 'hotel',
    osmTags: [
      { key: 'tourism', value: 'hotel' },
      { key: 'tourism', value: 'hostel' },
      { key: 'tourism', value: 'guest_house' },
    ],
  },
  {
    id: 'water-sources',
    name: 'Drinking Water',
    nameKey: 'poi.waterSources',
    icon: '💧',
    color: '#06B6D4',
    markerIcon: 'water',
    osmTags: [
      { key: 'amenity', value: 'drinking_water' },
    ],
  },
  {
    id: 'springs',
    name: 'Natural Springs',
    nameKey: 'poi.springs',
    icon: '🌊',
    color: '#0EA5E9',
    markerIcon: 'spring',
    osmTags: [
      { key: 'natural', value: 'spring' },
    ],
  },
  {
    id: 'shelters',
    name: 'Shelters & Huts',
    nameKey: 'poi.shelters',
    icon: '🏠',
    color: '#10B981',
    markerIcon: 'shelter',
    osmTags: [
      { key: 'amenity', value: 'shelter' },
      { key: 'tourism', value: 'alpine_hut' },
      { key: 'tourism', value: 'wilderness_hut' },
    ],
  },
  {
    id: 'camping',
    name: 'Camping',
    nameKey: 'poi.camping',
    icon: '⛺',
    color: '#059669',
    markerIcon: 'camping',
    osmTags: [
      { key: 'tourism', value: 'camp_site' },
      { key: 'tourism', value: 'caravan_site' },
    ],
  },
  {
    id: 'restaurants',
    name: 'Restaurants & Cafes',
    nameKey: 'poi.restaurants',
    icon: '🍽️',
    color: '#F59E0B',
    markerIcon: 'restaurant',
    osmTags: [
      { key: 'amenity', value: 'restaurant' },
      { key: 'amenity', value: 'cafe' },
      { key: 'amenity', value: 'fast_food' },
    ],
  },
  {
    id: 'bike-shops',
    name: 'Bike Shops & Repair',
    nameKey: 'poi.bikeShops',
    icon: '🔧',
    color: '#EF4444',
    markerIcon: 'bicycle',
    osmTags: [
      { key: 'shop', value: 'bicycle' },
      { key: 'amenity', value: 'bicycle_repair_station' },
    ],
  },
  {
    id: 'toilets',
    name: 'Toilets',
    nameKey: 'poi.toilets',
    icon: '🚻',
    color: '#6366F1',
    markerIcon: 'toilet',
    osmTags: [{ key: 'amenity', value: 'toilets' }],
  },
  {
    id: 'viewpoints',
    name: 'Viewpoints',
    nameKey: 'poi.viewpoints',
    icon: '👁️',
    color: '#EC4899',
    markerIcon: 'viewpoint',
    osmTags: [{ key: 'tourism', value: 'viewpoint' }],
  },
];

/**
 * Get POI category by ID
 */
export function getPOICategory(categoryId: string): POICategory | undefined {
  return POI_CATEGORIES.find((cat) => cat.id === categoryId);
}

/**
 * Get all available category IDs
 */
export function getPOICategoryIds(): string[] {
  return POI_CATEGORIES.map((cat) => cat.id);
}

/**
 * Determine POI type from OSM tags
 */
export function determinePOIType(tags: Record<string, string>): string {
  // Check common tag keys in priority order
  const priorityKeys = ['tourism', 'amenity', 'shop', 'natural', 'man_made'];

  for (const key of priorityKeys) {
    if (tags[key]) {
      return tags[key];
    }
  }

  // Return first available tag value
  const values = Object.values(tags);
  return values.length > 0 ? values[0] : 'unknown';
}

/**
 * Extract display name from OSM tags
 */
export function extractPOIName(tags: Record<string, string>, type: string): string {
  // Try common name tags in priority order
  const nameKeys = ['name', 'name:en', 'name:de', 'alt_name', 'loc_name', 'official_name'];

  for (const key of nameKeys) {
    if (tags[key]) {
      return tags[key];
    }
  }

  // Fall back to type with first letter capitalized
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}
