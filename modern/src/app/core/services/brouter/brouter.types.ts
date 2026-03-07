export interface LatLng {
  lat: number;
  lng: number;
}

export interface Waypoint extends LatLng {
  id: string;
  name?: string;
  type?: 'start' | 'via' | 'end';
}

export interface NogoArea {
  lat: number;
  lng: number;
  radius: number;
  name?: string;
}

export interface NogoPolyline {
  points: LatLng[];
  name?: string;
}

export interface NogoPolygon {
  points: LatLng[];
  name?: string;
}

export interface BRouterRequest {
  waypoints: LatLng[];
  profile: string;
  alternativeIdx?: number;
  format?: 'geojson' | 'gpx' | 'kml';
  nogos?: NogoArea[];
  nogoPolylines?: NogoPolyline[];
  nogoPolygons?: NogoPolygon[];
  straightIndices?: number[];
  pois?: PointOfInterest[];
}

export interface PointOfInterest extends LatLng {
  name: string;
}

export interface RouteProperties {
  'track-length': number;
  'filtered ascend': number;
  'plain-ascend': number;
  cost: number;
  'total-time': number;
  'total-energy': number;
  messages?: RouteMessage[];
}

export interface RouteMessage {
  Longitude: string;
  Latitude: string;
  Elevation: string;
  Distance: string;
  CostPerKm: string;
  ElevCost: string;
  TurnCost: string;
  NodeCost: string;
  InitialCost: string;
  WayTags: string;
  NodeTags: string;
  Time: string;
  Energy: string;
}

export interface RouteSegment {
  from: Waypoint;
  to: Waypoint;
  geojson: GeoJSON.Feature<GeoJSON.LineString> | null;
  loading: boolean;
  error?: string;
}

export interface RouteResult {
  geojson: GeoJSON.FeatureCollection;
  properties: RouteProperties;
  messages: RouteMessage[];
}

export interface ProfileInfo {
  id: string;
  name: string;
  description?: string;
  isCustom: boolean;
}

export const DEFAULT_PROFILES: ProfileInfo[] = [
  { id: 'trekking', name: 'Trekking', description: 'Allround-Profil für Radtouren', isCustom: false },
  { id: 'quaelnix-gravel', name: 'Quaelnix Gravel', description: 'Optimiert für Gravel und Steigungen', isCustom: false },
  { id: 'gravel', name: 'Gravel', description: 'Schotterweg-optimiert', isCustom: false },
  { id: 'fastbike', name: 'Fast Bike', description: 'Schnelle Straßenrouten', isCustom: false },
  { id: 'trekking-steep', name: 'Trekking Steep', description: 'Steile Strecken bevorzugt', isCustom: false },
  { id: 'mtb', name: 'MTB', description: 'Mountainbike-Trails', isCustom: false },
  { id: 'safety', name: 'Safety', description: 'Sichere Wege bevorzugt', isCustom: false },
  { id: 'shortest', name: 'Shortest', description: 'Kürzeste Distanz', isCustom: false },
];
