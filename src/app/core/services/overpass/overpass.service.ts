import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, forkJoin, timer } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap, retry } from 'rxjs/operators';
import {
  OverpassResponse,
  OverpassElement,
  OverpassBounds,
  POIResult,
  POICategory,
  POICacheEntry,
  RateLimitState,
  POI_CATEGORIES,
  getPOICategory,
  determinePOIType,
  extractPOIName,
} from './overpass.types';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const QUERY_TIMEOUT = 25; // seconds
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
const MAX_RETRIES = 2;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Service for querying OpenStreetMap POIs via Overpass API
 *
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 */
@Injectable({ providedIn: 'root' })
export class OverpassService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, POICacheEntry>();
  private readonly pendingRequests = new Map<string, Observable<POIResult[]>>();
  private rateLimitState: RateLimitState = {
    lastRequest: 0,
    requestCount: 0,
    isLimited: false,
  };

  /**
   * Query POIs for a single category within the given bounds
   *
   * @param categoryId - The POI category ID (e.g., 'hotels', 'water-sources')
   * @param bounds - Map bounds object with getSouth(), getWest(), getNorth(), getEast() methods
   * @returns Observable of POI results
   */
  queryPOIs(
    categoryId: string,
    bounds: { getSouth(): number; getWest(): number; getNorth(): number; getEast(): number }
  ): Observable<POIResult[]> {
    const category = getPOICategory(categoryId);
    if (!category) {
      return throwError(() => new Error(`Unknown POI category: ${categoryId}`));
    }

    const overpassBounds: OverpassBounds = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };

    return this.queryCategory(category, overpassBounds);
  }

  /**
   * Query multiple POI categories at once
   *
   * @param categoryIds - Array of category IDs to query
   * @param bounds - Map bounds object
   * @returns Observable of combined POI results
   */
  queryMultipleCategories(
    categoryIds: string[],
    bounds: { getSouth(): number; getWest(): number; getNorth(): number; getEast(): number }
  ): Observable<POIResult[]> {
    if (categoryIds.length === 0) {
      return of([]);
    }

    const validCategories = categoryIds
      .map((id) => getPOICategory(id))
      .filter((cat): cat is POICategory => cat !== undefined);

    if (validCategories.length === 0) {
      return throwError(() => new Error('No valid POI categories provided'));
    }

    const overpassBounds: OverpassBounds = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };

    // Query all categories in parallel
    const queries$ = validCategories.map((cat) => this.queryCategory(cat, overpassBounds));

    return forkJoin(queries$).pipe(
      map((results) => results.flat()),
      // Remove duplicates by OSM ID
      map((results) => this.deduplicateResults(results))
    );
  }

  /**
   * Query all available POI categories
   *
   * @param bounds - Map bounds object
   * @returns Observable of all POI results
   */
  queryAllCategories(bounds: {
    getSouth(): number;
    getWest(): number;
    getNorth(): number;
    getEast(): number;
  }): Observable<POIResult[]> {
    const categoryIds = POI_CATEGORIES.map((cat) => cat.id);
    return this.queryMultipleCategories(categoryIds, bounds);
  }

  /**
   * Get available POI categories
   */
  getCategories(): POICategory[] {
    return [...POI_CATEGORIES];
  }

  /**
   * Get a specific category by ID
   */
  getCategory(categoryId: string): POICategory | undefined {
    return getPOICategory(categoryId);
  }

  /**
   * Clear the POI cache
   */
  clearCache(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Clear cache for a specific category
   */
  clearCategoryCache(categoryId: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(`${categoryId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Check if rate limited
   */
  isRateLimited(): boolean {
    this.updateRateLimitState();
    return this.rateLimitState.isLimited;
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getRateLimitRetryAfter(): number {
    return this.rateLimitState.retryAfter ?? 0;
  }

  private queryCategory(category: POICategory, bounds: OverpassBounds): Observable<POIResult[]> {
    const cacheKey = this.createCacheKey(category.id, bounds);

    // Check cache first
    const cached = this.getFromCache(cacheKey, bounds);
    if (cached) {
      return of(cached);
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Build and execute query
    const query = this.buildQuery(category, bounds);
    const request$ = this.executeQuery(query, category.id, bounds, cacheKey);

    // Store pending request
    this.pendingRequests.set(cacheKey, request$);

    return request$;
  }

  private buildQuery(category: POICategory, bounds: OverpassBounds): string {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

    // Build node queries for each tag
    const nodeQueries = category.osmTags
      .map((tag) => `  node["${tag.key}"="${tag.value}"](${bbox});`)
      .join('\n');

    // Also query ways with center output for polygons (like campsites)
    const wayQueries = category.osmTags
      .map((tag) => `  way["${tag.key}"="${tag.value}"](${bbox});`)
      .join('\n');

    return `[out:json][timeout:${QUERY_TIMEOUT}];
(
${nodeQueries}
${wayQueries}
);
out center body;`;
  }

  private executeQuery(
    query: string,
    categoryId: string,
    bounds: OverpassBounds,
    cacheKey: string
  ): Observable<POIResult[]> {
    return this.waitForRateLimit().pipe(
      switchMap(() => {
        this.recordRequest();

        return this.http
          .post<OverpassResponse>(OVERPASS_API_URL, query, {
            headers: {
              'Content-Type': 'text/plain',
            },
          })
          .pipe(
            retry({
              count: MAX_RETRIES,
              delay: (error, retryCount) => {
                if (error.status === 429) {
                  // Rate limited - wait longer
                  const delay = Math.min(30000, 5000 * Math.pow(2, retryCount));
                  this.setRateLimited(delay);
                  return timer(delay);
                }
                if (error.status >= 500) {
                  // Server error - retry with backoff
                  return timer(1000 * Math.pow(2, retryCount));
                }
                // Don't retry other errors
                throw error;
              },
            }),
            map((response) => this.parseResponse(response, categoryId)),
            tap((results) => {
              this.saveToCache(cacheKey, results, bounds);
              this.pendingRequests.delete(cacheKey);
            }),
            catchError((error) => {
              this.pendingRequests.delete(cacheKey);
              return this.handleError(error);
            }),
            shareReplay(1)
          );
      })
    );
  }

  private parseResponse(response: OverpassResponse, categoryId: string): POIResult[] {
    if (!response.elements || !Array.isArray(response.elements)) {
      return [];
    }

    return response.elements
      .map((element) => this.parseElement(element, categoryId))
      .filter((result): result is POIResult => result !== null);
  }

  private parseElement(element: OverpassElement, categoryId: string): POIResult | null {
    // Get coordinates - either directly from node or from center for ways
    let lat: number | undefined;
    let lng: number | undefined;

    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      lat = element.lat;
      lng = element.lon;
    } else if (element.center) {
      lat = element.center.lat;
      lng = element.center.lon;
    }

    if (lat === undefined || lng === undefined) {
      return null;
    }

    const tags = element.tags ?? {};
    const type = determinePOIType(tags);
    const name = extractPOIName(tags, type);

    return {
      id: element.id,
      lat,
      lng,
      name,
      type,
      category: categoryId,
      tags,
      osmType: element.type,
    };
  }

  private createCacheKey(categoryId: string, bounds: OverpassBounds): string {
    // Round bounds to reduce cache fragmentation
    const precision = 3; // ~100m precision
    const south = bounds.south.toFixed(precision);
    const west = bounds.west.toFixed(precision);
    const north = bounds.north.toFixed(precision);
    const east = bounds.east.toFixed(precision);

    return `${categoryId}:${south},${west},${north},${east}`;
  }

  private getFromCache(key: string, bounds: OverpassBounds): POIResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    // Check if cached bounds still cover the requested bounds
    if (!this.boundsContain(entry.bounds, bounds)) {
      return null;
    }

    return entry.results;
  }

  private saveToCache(key: string, results: POIResult[], bounds: OverpassBounds): void {
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      bounds,
    });

    // Schedule cache cleanup
    setTimeout(() => this.cache.delete(key), CACHE_DURATION);
  }

  private boundsContain(outer: OverpassBounds, inner: OverpassBounds): boolean {
    return (
      outer.south <= inner.south &&
      outer.west <= inner.west &&
      outer.north >= inner.north &&
      outer.east >= inner.east
    );
  }

  private deduplicateResults(results: POIResult[]): POIResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const key = `${result.osmType}:${result.id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private waitForRateLimit(): Observable<void> {
    this.updateRateLimitState();

    if (this.rateLimitState.isLimited && this.rateLimitState.retryAfter) {
      return timer(this.rateLimitState.retryAfter).pipe(
        tap(() => this.updateRateLimitState()),
        map(() => undefined)
      );
    }

    // Ensure minimum interval between requests
    const now = Date.now();
    const elapsed = now - this.rateLimitState.lastRequest;
    if (elapsed < MIN_REQUEST_INTERVAL) {
      return timer(MIN_REQUEST_INTERVAL - elapsed).pipe(map(() => undefined));
    }

    return of(undefined);
  }

  private recordRequest(): void {
    const now = Date.now();
    this.rateLimitState.lastRequest = now;
    this.rateLimitState.requestCount++;
  }

  private updateRateLimitState(): void {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.rateLimitState.lastRequest > RATE_LIMIT_WINDOW) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.isLimited = false;
      this.rateLimitState.retryAfter = undefined;
    }

    // Check if we've hit the limit
    if (this.rateLimitState.requestCount >= MAX_REQUESTS_PER_WINDOW) {
      this.rateLimitState.isLimited = true;
      this.rateLimitState.retryAfter =
        RATE_LIMIT_WINDOW - (now - this.rateLimitState.lastRequest) + 1000;
    }
  }

  private setRateLimited(duration: number): void {
    this.rateLimitState.isLimited = true;
    this.rateLimitState.retryAfter = duration;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message: string;

    if (error.status === 0) {
      message = 'Network error: Could not connect to Overpass API';
    } else if (error.status === 400) {
      message = 'Bad request: Invalid Overpass query';
    } else if (error.status === 429) {
      message = 'Too many requests: Please wait before querying again';
      this.setRateLimited(30000);
    } else if (error.status === 504) {
      message = 'Gateway timeout: The query took too long. Try a smaller area.';
    } else {
      message = `Overpass API error: ${error.status} ${error.statusText}`;
    }

    console.error('OverpassService Error:', message, error);
    return throwError(() => new Error(message));
  }
}
