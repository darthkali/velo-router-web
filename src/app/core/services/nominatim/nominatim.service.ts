import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { NominatimResult, ParsedNominatimResult } from './nominatim.types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_LIMIT = 5;
const USER_AGENT = 'VeloRouter/1.0 (https://github.com/nrenner/brouter-web)';

/**
 * Service for geocoding using OpenStreetMap Nominatim API
 *
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */
@Injectable({ providedIn: 'root' })
export class NominatimService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<ParsedNominatimResult[]>>();

  /**
   * Search for locations matching the query string
   *
   * @param query - The search string (e.g., "Berlin" or "Hauptstrasse 1, Munich")
   * @param limit - Maximum number of results (default: 5)
   * @returns Observable of parsed search results
   */
  search(query: string, limit: number = DEFAULT_LIMIT): Observable<ParsedNominatimResult[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return of([]);
    }

    const cacheKey = `${trimmedQuery}:${limit}`;

    // Return cached result if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const params = new URLSearchParams({
      q: trimmedQuery,
      format: 'json',
      limit: String(limit),
      addressdetails: '0',
    });

    const url = `${NOMINATIM_BASE_URL}/search?${params}`;

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      // Note: User-Agent header may be blocked by browser for cross-origin requests
      // Nominatim recommends setting it, but it's optional for browser clients
    });

    const request$ = this.http
      .get<NominatimResult[]>(url, { headers })
      .pipe(
        map((results) => this.parseResults(results)),
        catchError((error) => this.handleError(error)),
        shareReplay(1)
      );

    // Cache the request for 5 minutes
    this.cache.set(cacheKey, request$);
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

    return request$;
  }

  /**
   * Reverse geocode: get address from coordinates
   *
   * @param lat - Latitude
   * @param lon - Longitude
   * @returns Observable of the location result
   */
  reverse(lat: number, lon: number): Observable<ParsedNominatimResult | null> {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'json',
    });

    const url = `${NOMINATIM_BASE_URL}/reverse?${params}`;

    return this.http.get<NominatimResult>(url).pipe(
      map((result) => (result ? this.parseResult(result) : null)),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Clear the search cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  private parseResults(results: NominatimResult[]): ParsedNominatimResult[] {
    return results.map((result) => this.parseResult(result));
  }

  private parseResult(result: NominatimResult): ParsedNominatimResult {
    return {
      placeId: result.place_id,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      class: result.class,
      type: result.type,
      name: result.name || result.display_name.split(',')[0],
      displayName: result.display_name,
      boundingbox: [
        parseFloat(result.boundingbox[0]),
        parseFloat(result.boundingbox[1]),
        parseFloat(result.boundingbox[2]),
        parseFloat(result.boundingbox[3]),
      ],
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message: string;

    if (error.status === 0) {
      message = 'Network error: Could not connect to Nominatim service';
    } else if (error.status === 429) {
      message = 'Too many requests: Please wait before searching again';
    } else {
      message = `Nominatim error: ${error.status} ${error.statusText}`;
    }

    console.error('NominatimService Error:', message);
    return throwError(() => new Error(message));
  }
}
