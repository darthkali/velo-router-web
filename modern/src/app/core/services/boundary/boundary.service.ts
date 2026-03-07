import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap, shareReplay } from 'rxjs/operators';
import * as GeoJSON from 'geojson';
import {
  BoundarySearchResult,
  ActiveBoundary,
  BoundaryCategory,
  NominatimBoundaryResult,
  OverpassResponse,
  OverpassElement,
  OsmType,
  BOUNDARY_COLORS,
  getBoundaryCategory,
} from './boundary.types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
// Multiple Overpass endpoints for fallback when primary is overloaded
// Kumi first as it's more reliable, main server often overloaded
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const SEARCH_LIMIT = 10;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'velo-router-boundaries';

/** Serializable boundary data for localStorage */
interface StoredBoundary {
  id: string;
  osmId: number;
  osmType: OsmType;
  name: string;
  displayName: string;
  category: BoundaryCategory;
  color: string;
  visible: boolean;
  /** Bounding box for quick display without fetching geometry */
  boundingBox?: [number, number, number, number]; // [south, north, west, east]
}

/**
 * Service for searching and displaying region/boundary features
 *
 * Uses Nominatim for search and Overpass API for detailed geometry
 */
@Injectable({ providedIn: 'root' })
export class BoundaryService {
  private readonly http = inject(HttpClient);

  // Search result cache
  private readonly searchCache = new Map<string, Observable<BoundarySearchResult[]>>();

  // Geometry cache
  private readonly geometryCache = new Map<string, Observable<GeoJSON.Feature>>();

  // Active boundaries state
  private readonly _activeBoundaries = signal<ActiveBoundary[]>([]);
  readonly activeBoundaries = this._activeBoundaries.asReadonly();

  // Preview boundary (temporary, shown on hover)
  private readonly _previewBoundary = signal<ActiveBoundary | null>(null);
  readonly previewBoundary = this._previewBoundary.asReadonly();

  // Computed signals
  readonly visibleBoundaries = computed(() =>
    this._activeBoundaries().filter((b) => b.visible)
  );

  readonly hasBoundaries = computed(() => this._activeBoundaries().length > 0);

  // Color assignment tracking
  private colorIndex = 0;

  // Current Overpass endpoint index (rotates on failure)
  private overpassEndpointIndex = 0;

  // Loading state for restored boundaries
  private readonly _isRestoring = signal(false);
  readonly isRestoring = this._isRestoring.asReadonly();

  constructor() {
    // Restore saved boundaries on init
    this.restoreBoundaries();
  }

  /**
   * Search for boundaries/regions by name
   * Combines Nominatim search with Overpass route search
   *
   * @param query - Search string (e.g., "Schwarzwald", "Rennsteig")
   * @returns Observable of boundary search results
   */
  searchBoundaries(query: string): Observable<BoundarySearchResult[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) {
      return of([]);
    }

    const cacheKey = trimmedQuery.toLowerCase();

    // Return cached result if available
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    // Run both Nominatim and Overpass searches in parallel
    const nominatimSearch$ = this.searchNominatim(trimmedQuery);
    const overpassRouteSearch$ = this.searchOverpassRoutes(trimmedQuery);

    const lowerQuery = trimmedQuery.toLowerCase();

    const request$ = forkJoin([nominatimSearch$, overpassRouteSearch$]).pipe(
      map(([nominatimResults, overpassResults]) => {
        // Merge results, prioritizing relations and removing duplicates
        const allResults = [...overpassResults, ...nominatimResults];
        const seen = new Set<string>();
        const uniqueResults: BoundarySearchResult[] = [];

        for (const result of allResults) {
          const key = `${result.osmType}:${result.osmId}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueResults.push(result);
          }
        }

        // Sort: exact name matches first, then relations, then by importance
        return uniqueResults.sort((a, b) => {
          // 1. Exact name matches first
          const aExact = a.name.toLowerCase() === lowerQuery;
          const bExact = b.name.toLowerCase() === lowerQuery;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // 2. Prioritize relations
          if (a.osmType === 'relation' && b.osmType !== 'relation') return -1;
          if (a.osmType !== 'relation' && b.osmType === 'relation') return 1;

          // 3. Then by importance
          return (b.importance || 0) - (a.importance || 0);
        });
      }),
      catchError((error) => this.handleError(error)),
      shareReplay(1)
    );

    // Cache the request
    this.searchCache.set(cacheKey, request$);
    setTimeout(() => this.searchCache.delete(cacheKey), CACHE_DURATION_MS);

    return request$;
  }

  /**
   * Search Nominatim for places and boundaries
   */
  private searchNominatim(query: string): Observable<BoundarySearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: String(SEARCH_LIMIT),
      polygon_geojson: '1',
      polygon_threshold: '0.005', // Simplified geometry for faster responses
      addressdetails: '0',
      extratags: '0',
      namedetails: '0',
    });

    const url = `${NOMINATIM_BASE_URL}/search?${params}`;

    return this.http.get<NominatimBoundaryResult[]>(url).pipe(
      map((results) => this.parseSearchResults(results)),
      catchError(() => of([]))
    );
  }

  /**
   * Search Overpass for route relations (hiking, cycling, etc.)
   * Tries multiple endpoints if the first one fails
   */
  private searchOverpassRoutes(query: string): Observable<BoundarySearchResult[]> {
    // Escape special regex characters in query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Simple search: find any route relation with matching name
    const overpassQuery = `[out:json][timeout:10];(relation["name"~"${escapedQuery}",i]["route"];relation["name"~"${escapedQuery}",i]["boundary"~"protected_area|national_park"];);out tags bb 15;`;

    return this.queryOverpassWithFallback(overpassQuery).pipe(
      map((response) => this.parseOverpassSearchResults(response, query)),
      catchError(() => of([]))
    );
  }

  /**
   * Query Overpass API with automatic fallback to alternative endpoints
   */
  private queryOverpassWithFallback(query: string, endpointIndex = 0): Observable<OverpassResponse> {
    if (endpointIndex >= OVERPASS_ENDPOINTS.length) {
      return throwError(() => new Error('All Overpass endpoints failed'));
    }

    const endpoint = OVERPASS_ENDPOINTS[endpointIndex];

    return this.http
      .post<OverpassResponse>(endpoint, `data=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        catchError((error) => {
          console.warn(`Overpass endpoint ${endpoint} failed, trying next...`);
          // Try next endpoint
          return this.queryOverpassWithFallback(query, endpointIndex + 1);
        })
      );
  }

  /**
   * Parse Overpass search results into BoundarySearchResult format
   * Sorts results to prioritize exact name matches
   */
  private parseOverpassSearchResults(response: OverpassResponse, query?: string): BoundarySearchResult[] {
    if (!response.elements) {
      return [];
    }

    const results = response.elements
      .filter((el) => el.tags?.['name'])
      .map((el) => {
        const tags = el.tags || {};
        const routeType = tags['route'] || tags['type'] || 'route';
        const network = tags['network'] || '';

        // Determine category
        let category: BoundaryCategory = 'route' as BoundaryCategory;
        if (tags['boundary'] === 'protected_area' || tags['boundary'] === 'national_park') {
          category = 'protected_area';
        }

        // Build display name
        const parts = [tags['name']];
        if (network) parts.push(`(${network})`);
        if (tags['from'] && tags['to']) {
          parts.push(`${tags['from']} → ${tags['to']}`);
        }

        // Get bounding box if available
        let boundingBox: [number, number, number, number] = [0, 0, 0, 0];
        if (el.bounds) {
          boundingBox = [el.bounds.minlat, el.bounds.maxlat, el.bounds.minlon, el.bounds.maxlon];
        }

        return {
          placeId: el.id,
          osmId: el.id,
          osmType: 'relation' as OsmType,
          displayName: parts.join(' '),
          name: tags['name'] || '',
          class: 'route',
          type: routeType,
          category,
          boundingBox,
          importance: network === 'nwn' || network === 'iwn' ? 1 : 0.5,
          geojson: undefined,
        };
      });

    // Sort results: exact matches first, then by importance
    if (query) {
      const lowerQuery = query.toLowerCase();
      results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === lowerQuery;
        const bExact = b.name.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        // Then by importance
        return (b.importance || 0) - (a.importance || 0);
      });
    }

    return results;
  }

  /**
   * Fetch boundary geometry from Overpass API
   * Uses optimized query for large relations (routes, boundaries)
   *
   * @param osmId - OSM ID of the element
   * @param osmType - OSM type (node, way, relation)
   * @returns Observable of GeoJSON Feature with the boundary geometry
   */
  getBoundaryGeometry(osmId: number, osmType: OsmType): Observable<GeoJSON.Feature> {
    const cacheKey = `${osmType}:${osmId}`;

    // Return cached result if available
    if (this.geometryCache.has(cacheKey)) {
      return this.geometryCache.get(cacheKey)!;
    }

    // Build Overpass query based on element type
    // For relations, we use a longer timeout and fetch geometry efficiently
    const elementType = this.getOverpassElementType(osmType);
    let query: string;

    if (osmType === 'relation') {
      // For relations: fetch with longer timeout, get full geometry
      query = `[out:json][timeout:60];rel(${osmId});out geom;`;
    } else {
      query = `[out:json][timeout:30];${elementType}(${osmId});out geom;`;
    }

    const request$ = this.queryOverpassWithFallback(query).pipe(
      map((response) => this.parseOverpassResponse(response, osmId, osmType)),
      catchError(() => {
        // If geometry fetch fails, try to return bounding box as fallback
        console.warn(`Geometry fetch failed for ${osmType}:${osmId}, trying bbox fallback`);
        return this.getBoundingBoxFallback(osmId, osmType);
      }),
      shareReplay(1)
    );

    // Cache the request
    this.geometryCache.set(cacheKey, request$);
    setTimeout(() => this.geometryCache.delete(cacheKey), CACHE_DURATION_MS);

    return request$;
  }

  /**
   * Fallback: fetch just the bounding box when full geometry times out
   */
  private getBoundingBoxFallback(osmId: number, osmType: OsmType): Observable<GeoJSON.Feature> {
    const elementType = this.getOverpassElementType(osmType);
    const query = `[out:json][timeout:10];${elementType}(${osmId});out tags bb;`;

    return this.queryOverpassWithFallback(query)
      .pipe(
        map((response) => {
          if (!response.elements || response.elements.length === 0) {
            throw new Error(`No data found for ${osmType}:${osmId}`);
          }

          const element = response.elements[0];
          const tags = element.tags || {};

          // Create bounding box polygon as fallback geometry
          if (element.bounds) {
            const { minlat, minlon, maxlat, maxlon } = element.bounds;
            return {
              type: 'Feature' as const,
              properties: {
                osmId,
                osmType,
                name: tags['name'] || '',
                fallback: true, // Mark as fallback geometry
                ...tags,
              },
              geometry: {
                type: 'Polygon' as const,
                coordinates: [[
                  [minlon, minlat],
                  [maxlon, minlat],
                  [maxlon, maxlat],
                  [minlon, maxlat],
                  [minlon, minlat],
                ]],
              },
            };
          }

          throw new Error(`No bounds found for ${osmType}:${osmId}`);
        }),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Convenience method: Search for a boundary by name and fetch its geometry
   *
   * @param name - Name to search for
   * @returns Observable of GeoJSON Feature or null if not found
   */
  getBoundaryByName(name: string): Observable<GeoJSON.Feature | null> {
    return this.searchBoundaries(name).pipe(
      switchMap((results) => {
        if (results.length === 0) {
          return of(null);
        }

        const firstResult = results[0];

        // If Nominatim already provided geometry, use it
        if (firstResult.geojson) {
          const feature: GeoJSON.Feature = {
            type: 'Feature',
            properties: {
              name: firstResult.name,
              displayName: firstResult.displayName,
              osmId: firstResult.osmId,
              osmType: firstResult.osmType,
              category: firstResult.category,
            },
            geometry: firstResult.geojson,
          };
          return of(feature);
        }

        // Otherwise fetch from Overpass
        return this.getBoundaryGeometry(firstResult.osmId, firstResult.osmType);
      })
    );
  }

  /**
   * Add a boundary to the active boundaries list
   *
   * @param searchResult - The boundary search result to add
   * @returns Observable that completes when the boundary is added
   */
  addBoundary(searchResult: BoundarySearchResult): Observable<ActiveBoundary> {
    const id = `${searchResult.osmType}:${searchResult.osmId}`;

    // Check if already exists
    const existing = this._activeBoundaries().find((b) => b.id === id);
    if (existing) {
      return of(existing);
    }

    // Determine if we need to fetch geometry
    const geometrySource$: Observable<GeoJSON.Feature> = searchResult.geojson
      ? of({
          type: 'Feature' as const,
          properties: {
            name: searchResult.name,
            displayName: searchResult.displayName,
            osmId: searchResult.osmId,
            osmType: searchResult.osmType,
            category: searchResult.category,
          },
          geometry: searchResult.geojson,
        })
      : this.getBoundaryGeometry(searchResult.osmId, searchResult.osmType);

    return geometrySource$.pipe(
      map((feature) => {
        const activeBoundary: ActiveBoundary = {
          id,
          osmId: searchResult.osmId,
          osmType: searchResult.osmType,
          name: searchResult.name,
          displayName: searchResult.displayName,
          category: searchResult.category,
          color: this.getNextColor(),
          visible: true,
          feature: feature as ActiveBoundary['feature'],
          bounds: this.calculateBounds(feature.geometry),
        };

        this._activeBoundaries.update((boundaries) => [...boundaries, activeBoundary]);
        this.saveBoundaries();

        return activeBoundary;
      })
    );
  }

  /**
   * Remove a boundary from the active list
   */
  removeBoundary(id: string): void {
    this._activeBoundaries.update((boundaries) =>
      boundaries.filter((b) => b.id !== id)
    );
    this.saveBoundaries();
  }

  /**
   * Toggle visibility of a boundary
   * If geometry isn't loaded yet, it will be fetched when made visible
   */
  toggleBoundaryVisibility(id: string): void {
    const boundary = this._activeBoundaries().find((b) => b.id === id);
    if (!boundary) return;

    const newVisible = !boundary.visible;

    this._activeBoundaries.update((boundaries) =>
      boundaries.map((b) =>
        b.id === id ? { ...b, visible: newVisible } : b
      )
    );

    // Load geometry if toggling visible and not already loaded
    if (newVisible && !boundary.feature && !boundary.loading) {
      this.loadBoundaryGeometry(id);
    }

    this.saveBoundaries();
  }

  /**
   * Set boundary color
   */
  setBoundaryColor(id: string, color: string): void {
    this._activeBoundaries.update((boundaries) =>
      boundaries.map((b) =>
        b.id === id ? { ...b, color } : b
      )
    );
    this.saveBoundaries();
  }

  /**
   * Clear all active boundaries
   */
  clearAllBoundaries(): void {
    this._activeBoundaries.set([]);
    this.colorIndex = 0;
    this.saveBoundaries();
  }

  /**
   * Get a boundary by ID
   */
  getBoundaryById(id: string): ActiveBoundary | undefined {
    return this._activeBoundaries().find((b) => b.id === id);
  }

  /**
   * Show a preview boundary on the map (for hover states)
   * This loads the boundary geometry and displays it temporarily
   */
  showPreview(searchResult: BoundarySearchResult): void {
    const id = `preview:${searchResult.osmType}:${searchResult.osmId}`;

    // If already loading this preview, skip
    if (this._previewBoundary()?.id === id) {
      return;
    }

    // For routes without geometry, we need to fetch from Overpass
    let geometrySource$: Observable<GeoJSON.Feature>;

    if (searchResult.geojson) {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { name: searchResult.name },
        geometry: searchResult.geojson,
      };
      geometrySource$ = of(feature);
    } else {
      geometrySource$ = this.getBoundaryGeometry(searchResult.osmId, searchResult.osmType);
    }

    geometrySource$.subscribe({
      next: (feature: GeoJSON.Feature) => {
        const previewBoundary: ActiveBoundary = {
          id,
          osmId: searchResult.osmId,
          osmType: searchResult.osmType,
          name: searchResult.name,
          displayName: searchResult.displayName,
          category: searchResult.category,
          color: '#f97316', // Orange for preview
          visible: true,
          feature: feature as ActiveBoundary['feature'],
          bounds: this.calculateBounds(feature.geometry),
        };

        this._previewBoundary.set(previewBoundary);
      },
      error: () => {
        // Silently fail for preview
      },
    });
  }

  /**
   * Show a bounding box preview immediately (no network request)
   * This provides instant visual feedback while full geometry loads
   */
  showBoundsPreview(searchResult: BoundarySearchResult): void {
    if (!searchResult.boundingBox || searchResult.boundingBox.every(v => v === 0)) {
      return;
    }

    const [south, north, west, east] = searchResult.boundingBox;
    const id = `preview:bbox:${searchResult.osmType}:${searchResult.osmId}`;

    // Create a bounding box polygon
    const boxFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature',
      properties: { name: searchResult.name, preview: true },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ]],
      },
    };

    const previewBoundary: ActiveBoundary = {
      id,
      osmId: searchResult.osmId,
      osmType: searchResult.osmType,
      name: searchResult.name,
      displayName: searchResult.displayName,
      category: searchResult.category,
      color: '#f97316', // Orange for preview
      visible: true,
      feature: boxFeature,
      bounds: [[south, west], [north, east]],
    };

    this._previewBoundary.set(previewBoundary);
  }

  /**
   * Clear the preview boundary
   */
  clearPreview(): void {
    this._previewBoundary.set(null);
  }

  /**
   * Save boundaries to localStorage (metadata + bounding box for quick restore)
   */
  private saveBoundaries(): void {
    const boundaries = this._activeBoundaries();
    const stored: StoredBoundary[] = boundaries.map((b) => {
      // Extract bounding box from bounds if available
      let boundingBox: [number, number, number, number] | undefined;
      if (b.bounds) {
        const [[south, west], [north, east]] = b.bounds;
        boundingBox = [south, north, west, east];
      }

      return {
        id: b.id,
        osmId: b.osmId,
        osmType: b.osmType,
        name: b.name,
        displayName: b.displayName,
        category: b.category,
        color: b.color,
        visible: b.visible,
        boundingBox,
      };
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // localStorage might be full or disabled
    }
  }

  /**
   * Restore boundaries from localStorage with bounding box geometry
   */
  private restoreBoundaries(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const boundaries: StoredBoundary[] = JSON.parse(stored);
      if (!Array.isArray(boundaries) || boundaries.length === 0) return;

      // Restore boundaries with bounding box as geometry (no network request needed)
      const restored: ActiveBoundary[] = boundaries.map((stored) => {
        let feature: ActiveBoundary['feature'] | undefined;
        let bounds: ActiveBoundary['bounds'] | undefined;

        // Create bounding box polygon from saved data
        if (stored.boundingBox) {
          const [south, north, west, east] = stored.boundingBox;
          bounds = [[south, west], [north, east]];
          feature = {
            type: 'Feature',
            properties: {
              name: stored.name,
              osmId: stored.osmId,
              osmType: stored.osmType,
              restored: true, // Mark as restored (bounding box only)
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ]],
            },
          };
        }

        return {
          id: stored.id,
          osmId: stored.osmId,
          osmType: stored.osmType,
          name: stored.name,
          displayName: stored.displayName,
          category: stored.category,
          color: stored.color,
          visible: stored.visible && !!feature, // Only visible if we have geometry
          loading: false,
          feature,
          bounds,
        };
      });

      this._activeBoundaries.set(restored);
    } catch {
      // Invalid JSON or other error
    }
  }

  /**
   * Load geometry for a boundary (called when toggling visibility on)
   */
  private loadBoundaryGeometry(id: string): void {
    const boundary = this._activeBoundaries().find((b) => b.id === id);
    if (!boundary || boundary.feature || boundary.loading) return;

    // Set loading state
    this._activeBoundaries.update((boundaries) =>
      boundaries.map((b) => (b.id === id ? { ...b, loading: true } : b))
    );

    this.getBoundaryGeometry(boundary.osmId, boundary.osmType).subscribe({
      next: (feature) => {
        this._activeBoundaries.update((boundaries) =>
          boundaries.map((b) =>
            b.id === id
              ? {
                  ...b,
                  loading: false,
                  feature: feature as ActiveBoundary['feature'],
                  bounds: this.calculateBounds(feature.geometry),
                }
              : b
          )
        );
      },
      error: () => {
        // Reset loading state on error
        this._activeBoundaries.update((boundaries) =>
          boundaries.map((b) => (b.id === id ? { ...b, loading: false } : b))
        );
      },
    });
  }

  // Private helper methods

  private parseSearchResults(results: NominatimBoundaryResult[]): BoundarySearchResult[] {
    return results
      .filter((r) => this.isValidBoundaryResult(r))
      .map((r) => this.parseSearchResult(r));
  }

  private isValidBoundaryResult(result: NominatimBoundaryResult): boolean {
    // Accept results that are:
    // - Relations (usually boundaries, routes, etc.)
    // - Boundaries or routes by class
    // - Have a polygon/linestring geometry
    const validClasses = ['boundary', 'route', 'place', 'natural', 'landuse', 'leisure'];
    const isValidClass = validClasses.includes(result.class);
    const isRelation = result.osm_type === 'relation';
    const hasGeometry = result.geojson !== undefined;

    return isRelation || isValidClass || hasGeometry;
  }

  private parseSearchResult(result: NominatimBoundaryResult): BoundarySearchResult {
    return {
      placeId: result.place_id,
      osmId: result.osm_id,
      osmType: this.parseOsmType(result.osm_type),
      displayName: result.display_name,
      name: result.name || result.display_name.split(',')[0],
      class: result.class,
      type: result.type,
      category: getBoundaryCategory(result.class, result.type),
      boundingBox: [
        parseFloat(result.boundingbox[0]),
        parseFloat(result.boundingbox[1]),
        parseFloat(result.boundingbox[2]),
        parseFloat(result.boundingbox[3]),
      ],
      importance: result.importance,
      geojson: result.geojson,
    };
  }

  private parseOsmType(osmType: string): OsmType {
    switch (osmType.toLowerCase()) {
      case 'n':
      case 'node':
        return 'node';
      case 'w':
      case 'way':
        return 'way';
      case 'r':
      case 'relation':
        return 'relation';
      default:
        return 'node';
    }
  }

  private getOverpassElementType(osmType: OsmType): string {
    switch (osmType) {
      case 'node':
        return 'node';
      case 'way':
        return 'way';
      case 'relation':
        return 'rel';
      default:
        return 'rel';
    }
  }

  private parseOverpassResponse(
    response: OverpassResponse,
    osmId: number,
    osmType: OsmType
  ): GeoJSON.Feature {
    if (!response.elements || response.elements.length === 0) {
      throw new Error(`No geometry found for ${osmType}:${osmId}`);
    }

    const element = response.elements[0];
    const geometry = this.elementToGeometry(element);
    const tags = element.tags || {};

    return {
      type: 'Feature',
      properties: {
        osmId,
        osmType,
        name: tags['name'] || '',
        ...tags,
      },
      geometry,
    };
  }

  private elementToGeometry(element: OverpassElement): GeoJSON.Geometry {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      return {
        type: 'Point',
        coordinates: [element.lon, element.lat],
      };
    }

    if (element.type === 'way' && element.geometry) {
      const coordinates: GeoJSON.Position[] = element.geometry.map((p) => [p.lon, p.lat]);

      // Check if it's a closed way (polygon)
      const first = element.geometry[0];
      const last = element.geometry[element.geometry.length - 1];
      if (first.lat === last.lat && first.lon === last.lon) {
        return {
          type: 'Polygon',
          coordinates: [coordinates],
        };
      }

      return {
        type: 'LineString',
        coordinates,
      };
    }

    if (element.type === 'relation' && element.members) {
      return this.relationToGeometry(element);
    }

    // Fallback: if bounds are available, create a bounding box polygon
    if (element.bounds) {
      const { minlat, minlon, maxlat, maxlon } = element.bounds;
      return {
        type: 'Polygon',
        coordinates: [
          [
            [minlon, minlat],
            [maxlon, minlat],
            [maxlon, maxlat],
            [minlon, maxlat],
            [minlon, minlat],
          ],
        ],
      };
    }

    throw new Error(`Cannot extract geometry from element type: ${element.type}`);
  }

  private relationToGeometry(element: OverpassElement): GeoJSON.Geometry {
    const outerSegments: GeoJSON.Position[][] = [];
    const innerSegments: GeoJSON.Position[][] = [];
    const lineStrings: GeoJSON.Position[][] = [];

    if (!element.members) {
      throw new Error('Relation has no members');
    }

    for (const member of element.members) {
      if (member.geometry && member.geometry.length > 0) {
        const coords: GeoJSON.Position[] = member.geometry.map((p) => [p.lon, p.lat]);

        if (member.role === 'outer') {
          outerSegments.push(coords);
        } else if (member.role === 'inner') {
          innerSegments.push(coords);
        } else {
          // For routes, collect as line strings
          lineStrings.push(coords);
        }
      }
    }

    // If we have outer segments, try to stitch them into rings
    if (outerSegments.length > 0) {
      // Stitch outer segments together to form closed rings
      const outerRings = this.stitchSegmentsIntoRings(outerSegments);
      const innerRings = innerSegments.length > 0
        ? this.stitchSegmentsIntoRings(innerSegments)
        : [];

      if (outerRings.length === 1) {
        // Single polygon, possibly with holes
        const coordinates = [outerRings[0], ...innerRings];
        return {
          type: 'Polygon',
          coordinates,
        };
      }

      // MultiPolygon - each outer ring (simplified: no inner ring assignment)
      const polygons = outerRings.map((outer) => [outer]);
      return {
        type: 'MultiPolygon',
        coordinates: polygons,
      };
    }

    // If we have line strings (routes), return as MultiLineString
    if (lineStrings.length > 0) {
      // Try to stitch line strings together for routes
      const stitched = this.stitchSegmentsIntoLines(lineStrings);

      if (stitched.length === 1) {
        return {
          type: 'LineString',
          coordinates: stitched[0],
        };
      }

      return {
        type: 'MultiLineString',
        coordinates: stitched,
      };
    }

    throw new Error('Could not extract geometry from relation');
  }

  /**
   * Stitch multiple line segments together into closed rings
   * Segments are joined when their endpoints match
   */
  private stitchSegmentsIntoRings(segments: GeoJSON.Position[][]): GeoJSON.Position[][] {
    if (segments.length === 0) return [];
    if (segments.length === 1) return [this.ensureClosedRing(segments[0])];

    const rings: GeoJSON.Position[][] = [];
    const unused = [...segments];

    while (unused.length > 0) {
      // Start a new ring with the first unused segment
      let ring = [...unused.shift()!];

      // Keep trying to extend the ring
      let changed = true;
      while (changed) {
        changed = false;
        const ringStart = ring[0];
        const ringEnd = ring[ring.length - 1];

        for (let i = 0; i < unused.length; i++) {
          const segment = unused[i];
          const segStart = segment[0];
          const segEnd = segment[segment.length - 1];

          // Check if segment connects to ring end
          if (this.coordsMatch(ringEnd, segStart)) {
            // Append segment (skip first point to avoid duplicate)
            ring = [...ring, ...segment.slice(1)];
            unused.splice(i, 1);
            changed = true;
            break;
          } else if (this.coordsMatch(ringEnd, segEnd)) {
            // Append reversed segment
            ring = [...ring, ...segment.slice(0, -1).reverse()];
            unused.splice(i, 1);
            changed = true;
            break;
          } else if (this.coordsMatch(ringStart, segEnd)) {
            // Prepend segment
            ring = [...segment.slice(0, -1), ...ring];
            unused.splice(i, 1);
            changed = true;
            break;
          } else if (this.coordsMatch(ringStart, segStart)) {
            // Prepend reversed segment
            ring = [...segment.slice(1).reverse(), ...ring];
            unused.splice(i, 1);
            changed = true;
            break;
          }
        }
      }

      rings.push(this.ensureClosedRing(ring));
    }

    return rings;
  }

  /**
   * Stitch multiple line segments together into continuous lines (for routes)
   */
  private stitchSegmentsIntoLines(segments: GeoJSON.Position[][]): GeoJSON.Position[][] {
    if (segments.length === 0) return [];
    if (segments.length === 1) return segments;

    const lines: GeoJSON.Position[][] = [];
    const unused = [...segments];

    while (unused.length > 0) {
      let line = [...unused.shift()!];

      let changed = true;
      while (changed) {
        changed = false;
        const lineStart = line[0];
        const lineEnd = line[line.length - 1];

        for (let i = 0; i < unused.length; i++) {
          const segment = unused[i];
          const segStart = segment[0];
          const segEnd = segment[segment.length - 1];

          if (this.coordsMatch(lineEnd, segStart)) {
            line = [...line, ...segment.slice(1)];
            unused.splice(i, 1);
            changed = true;
            break;
          } else if (this.coordsMatch(lineEnd, segEnd)) {
            line = [...line, ...segment.slice(0, -1).reverse()];
            unused.splice(i, 1);
            changed = true;
            break;
          } else if (this.coordsMatch(lineStart, segEnd)) {
            line = [...segment.slice(0, -1), ...line];
            unused.splice(i, 1);
            changed = true;
            break;
          } else if (this.coordsMatch(lineStart, segStart)) {
            line = [...segment.slice(1).reverse(), ...line];
            unused.splice(i, 1);
            changed = true;
            break;
          }
        }
      }

      lines.push(line);
    }

    return lines;
  }

  /**
   * Check if two coordinates are the same (within small tolerance)
   */
  private coordsMatch(a: GeoJSON.Position, b: GeoJSON.Position): boolean {
    const tolerance = 0.00001; // ~1 meter tolerance
    return Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance;
  }

  private ensureClosedRing(ring: GeoJSON.Position[]): GeoJSON.Position[] {
    if (ring.length < 2) return ring;

    const first = ring[0];
    const last = ring[ring.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      return [...ring, first];
    }

    return ring;
  }

  private calculateBounds(
    geometry: GeoJSON.Geometry
  ): [[number, number], [number, number]] {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    const processCoordinates = (coords: unknown): void => {
      if (!Array.isArray(coords)) return;

      // Check if it's a coordinate pair [lon, lat]
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const [lon, lat] = coords as [number, number];
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      } else {
        // It's an array of coordinates
        coords.forEach(processCoordinates);
      }
    };

    if ('coordinates' in geometry) {
      processCoordinates(geometry.coordinates);
    }

    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
  }

  private getNextColor(): string {
    const color = BOUNDARY_COLORS[this.colorIndex % BOUNDARY_COLORS.length];
    this.colorIndex++;
    return color;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message: string;

    if (error.status === 0) {
      message = 'Network error: Could not connect to service';
    } else if (error.status === 429) {
      message = 'Too many requests: Please wait before searching again';
    } else if (error.status === 504) {
      message = 'Request timeout: The boundary geometry is too large';
    } else {
      message = `Error: ${error.status} ${error.statusText}`;
    }

    console.error('BoundaryService Error:', message, error);
    return throwError(() => new Error(message));
  }
}
