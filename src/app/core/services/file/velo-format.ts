/**
 * VeloRouter .velo file format definition
 *
 * This format stores complete route projects including:
 * - Waypoints and routing configuration
 * - Map view settings
 * - UI state
 */

/**
 * Waypoint in the .velo format
 */
export interface VeloWaypoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  type: 'start' | 'via' | 'end';
}

/**
 * Route configuration in the .velo format
 */
export interface VeloRoute {
  profile: string;
  alternativeIndex: number;
  waypoints: VeloWaypoint[];
}

/**
 * Map view settings in the .velo format
 */
export interface VeloMapView {
  center: [number, number];
  zoom: number;
  baseLayer: string;
  overlays: string[];
}

/**
 * UI settings in the .velo format
 */
export interface VeloUISettings {
  elevationChartExpanded: boolean;
  sidebarCollapsed: boolean;
}

/**
 * Loaded region/boundary reference
 */
export interface VeloRegion {
  id: string;
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  name: string;
  displayName: string;
  category: string;
  color: string;
  visible: boolean;
}

/**
 * File metadata
 */
export interface VeloMetadata {
  name: string;
  description?: string;
  created: string; // ISO 8601
  modified: string; // ISO 8601
  appVersion: string;
}

/**
 * Complete .velo file structure
 */
export interface VeloFile {
  format: 'velo-route';
  version: number;
  metadata: VeloMetadata;
  route: VeloRoute;
  mapView?: VeloMapView;
  ui?: VeloUISettings;
  regions?: VeloRegion[];
}

/**
 * Current format version
 */
export const VELO_FORMAT_VERSION = 1;

/**
 * App version for metadata
 */
export const APP_VERSION = '1.0.0';

/**
 * Create a new empty VeloFile
 */
export function createEmptyVeloFile(name = 'Neue Route'): VeloFile {
  const now = new Date().toISOString();
  return {
    format: 'velo-route',
    version: VELO_FORMAT_VERSION,
    metadata: {
      name,
      created: now,
      modified: now,
      appVersion: APP_VERSION,
    },
    route: {
      profile: 'trekking',
      alternativeIndex: 0,
      waypoints: [],
    },
  };
}

/**
 * Serialize VeloFile to JSON string
 */
export function serializeVeloFile(file: VeloFile): string {
  // Update modified timestamp
  const updated: VeloFile = {
    ...file,
    metadata: {
      ...file.metadata,
      modified: new Date().toISOString(),
    },
  };
  return JSON.stringify(updated, null, 2);
}

/**
 * Parse and validate a VeloFile from JSON string
 * Returns null if invalid
 */
export function parseVeloFile(jsonString: string): VeloFile | null {
  try {
    const parsed = JSON.parse(jsonString);
    return validateVeloFile(parsed);
  } catch (e) {
    console.error('Failed to parse .velo file:', e);
    return null;
  }
}

/**
 * Validate parsed JSON as VeloFile
 */
export function validateVeloFile(data: unknown): VeloFile | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const file = data as Partial<VeloFile>;

  // Check format identifier
  if (file.format !== 'velo-route') {
    console.error('Invalid format:', file.format);
    return null;
  }

  // Check version
  if (typeof file.version !== 'number' || file.version < 1) {
    console.error('Invalid version:', file.version);
    return null;
  }

  // Check metadata
  if (!file.metadata || typeof file.metadata.name !== 'string') {
    console.error('Invalid metadata');
    return null;
  }

  // Check route
  if (!file.route || !Array.isArray(file.route.waypoints)) {
    console.error('Invalid route');
    return null;
  }

  // Validate waypoints
  for (const wp of file.route.waypoints) {
    if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number') {
      console.error('Invalid waypoint:', wp);
      return null;
    }
    if (wp.lat < -90 || wp.lat > 90 || wp.lng < -180 || wp.lng > 180) {
      console.error('Waypoint coordinates out of range:', wp);
      return null;
    }
  }

  // Apply migrations for older versions
  const migrated = migrateVeloFile(file as VeloFile);

  return migrated;
}

/**
 * Migrate older file versions to current version
 */
function migrateVeloFile(file: VeloFile): VeloFile {
  let result = { ...file };

  // Version 1 is current, no migrations needed yet
  // Future migrations would go here:
  // if (result.version < 2) { ... migrate to v2 ... }

  return result;
}

/**
 * Generate a suggested filename from route name
 */
export function generateFilename(name: string): string {
  // Sanitize name for filename
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/gi, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  return `${sanitized || 'route'}.velo`;
}
