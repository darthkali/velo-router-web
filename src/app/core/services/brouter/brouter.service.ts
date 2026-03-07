import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  BRouterRequest,
  LatLng,
  NogoArea,
  NogoPolyline,
  NogoPolygon,
  PointOfInterest,
  RouteResult,
  RouteProperties,
  RouteMessage,
} from './brouter.types';

@Injectable({ providedIn: 'root' })
export class BRouterService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.brouterUrl;
  private readonly precision = environment.coordinatePrecision;

  getRoute(request: BRouterRequest): Observable<RouteResult> {
    const url = this.buildUrl(request);

    return this.http.get<GeoJSON.FeatureCollection>(url).pipe(
      map((geojson) => this.parseRouteResult(geojson)),
      catchError(this.handleError)
    );
  }

  uploadProfile(profileContent: string): Observable<string> {
    return this.http
      .post<{ profileid: string }>(
        `${this.baseUrl}/profile`,
        profileContent,
        { headers: { 'Content-Type': 'text/plain' } }
      )
      .pipe(
        map((res) => res.profileid),
        catchError(this.handleError)
      );
  }

  buildUrl(request: BRouterRequest): string {
    const { waypoints, profile, alternativeIdx = 0, format = 'geojson' } = request;

    const lonlats = waypoints
      .map((wp) => `${wp.lng.toFixed(this.precision)},${wp.lat.toFixed(this.precision)}`)
      .join('|');

    const params = new URLSearchParams({
      lonlats,
      profile,
      alternativeidx: String(alternativeIdx),
      format,
    });

    if (request.nogos?.length) {
      params.set('nogos', this.formatNogos(request.nogos));
    }

    if (request.nogoPolylines?.length) {
      params.set('polylines', this.formatNogoPolylines(request.nogoPolylines));
    }

    if (request.nogoPolygons?.length) {
      params.set('polygons', this.formatNogoPolygons(request.nogoPolygons));
    }

    if (request.straightIndices?.length) {
      params.set('straight', request.straightIndices.join(','));
    }

    if (request.pois?.length) {
      params.set('pois', this.formatPois(request.pois));
    }

    return `${this.baseUrl}/brouter?${params}`;
  }

  private formatNogos(nogos: NogoArea[]): string {
    return nogos
      .map((n) => `${n.lng.toFixed(this.precision)},${n.lat.toFixed(this.precision)},${n.radius}`)
      .join('|');
  }

  private formatNogoPolylines(polylines: NogoPolyline[]): string {
    return polylines
      .map((p) =>
        p.points
          .map((pt) => `${pt.lng.toFixed(this.precision)},${pt.lat.toFixed(this.precision)}`)
          .join(',')
      )
      .join('|');
  }

  private formatNogoPolygons(polygons: NogoPolygon[]): string {
    return polygons
      .map((p) =>
        p.points
          .map((pt) => `${pt.lng.toFixed(this.precision)},${pt.lat.toFixed(this.precision)}`)
          .join(',')
      )
      .join('|');
  }

  private formatPois(pois: PointOfInterest[]): string {
    return pois
      .map((p) => `${p.lng.toFixed(this.precision)},${p.lat.toFixed(this.precision)},${encodeURIComponent(p.name)}`)
      .join('|');
  }

  private parseRouteResult(geojson: GeoJSON.FeatureCollection): RouteResult {
    const feature = geojson.features[0];
    const properties = (feature?.properties || {}) as RouteProperties;
    const messages = this.extractMessages(properties);

    return {
      geojson,
      properties,
      messages,
    };
  }

  private extractMessages(properties: RouteProperties): RouteMessage[] {
    if (!properties.messages) {
      return [];
    }

    // Messages come as array of arrays, convert to objects
    const rawMessages = properties.messages as unknown;
    if (!Array.isArray(rawMessages) || rawMessages.length < 2) {
      return [];
    }

    const headers = rawMessages[0] as string[];
    const rows = rawMessages.slice(1) as string[][];

    return rows.map((row) => {
      const message: Record<string, string> = {};
      headers.forEach((header, index) => {
        message[header] = row[index] || '';
      });
      return message as unknown as RouteMessage;
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message: string;

    if (error.error instanceof ErrorEvent) {
      message = `Network error: ${error.error.message}`;
    } else if (typeof error.error === 'string') {
      message = error.error;
    } else {
      message = `Server error: ${error.status} ${error.statusText}`;
    }

    console.error('BRouter Error:', message);
    return throwError(() => new Error(message));
  }
}
