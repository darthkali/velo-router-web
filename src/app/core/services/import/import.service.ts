import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LatLng } from '../brouter/brouter.types';

export type ImportFormat = 'gpx' | 'kml' | 'geojson';

export interface ImportResult {
  waypoints: LatLng[];
  name?: string;
  format: ImportFormat;
}

export interface ImportError {
  message: string;
  code: 'INVALID_FORMAT' | 'PARSE_ERROR' | 'NO_POINTS' | 'READ_ERROR';
}

/** Maximum points before sampling kicks in */
const MAX_POINTS_BEFORE_SAMPLING = 200;

@Injectable({ providedIn: 'root' })
export class ImportService {
  /**
   * Import a file and parse waypoints from it
   * Supports GPX, KML, and GeoJSON formats
   */
  importFile(file: File): Observable<ImportResult> {
    return from(this.readFileAsText(file)).pipe(
      map((content) => this.parseFile(file.name, content)),
      catchError((error) => {
        if (this.isImportError(error)) {
          return throwError(() => error);
        }
        return throwError(() => ({
          message: `Failed to read file: ${error.message || 'Unknown error'}`,
          code: 'READ_ERROR' as const,
        }));
      })
    );
  }

  /**
   * Detect format from file extension or content
   */
  detectFormat(filename: string, content: string): ImportFormat | null {
    const extension = filename.toLowerCase().split('.').pop();

    // Check by extension first
    if (extension === 'gpx') return 'gpx';
    if (extension === 'kml') return 'kml';
    if (extension === 'geojson' || extension === 'json') {
      // Verify it's actually GeoJSON
      try {
        const parsed = JSON.parse(content);
        if (parsed.type && (parsed.type === 'FeatureCollection' || parsed.type === 'Feature' || parsed.type === 'Point' || parsed.type === 'LineString')) {
          return 'geojson';
        }
      } catch {
        return null;
      }
    }

    // Try to detect by content
    const trimmedContent = content.trim();

    // Check for XML-based formats
    if (trimmedContent.startsWith('<?xml') || trimmedContent.startsWith('<')) {
      if (trimmedContent.includes('<gpx') || trimmedContent.includes('<GPX')) {
        return 'gpx';
      }
      if (trimmedContent.includes('<kml') || trimmedContent.includes('<KML')) {
        return 'kml';
      }
    }

    // Check for JSON-based formats
    if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmedContent);
        if (parsed.type) {
          return 'geojson';
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Parse file content based on detected format
   */
  private parseFile(filename: string, content: string): ImportResult {
    const format = this.detectFormat(filename, content);

    if (!format) {
      throw {
        message: 'Unable to detect file format. Supported formats: GPX, KML, GeoJSON',
        code: 'INVALID_FORMAT',
      } as ImportError;
    }

    let result: ImportResult;

    switch (format) {
      case 'gpx':
        result = this.parseGpx(content);
        break;
      case 'kml':
        result = this.parseKml(content);
        break;
      case 'geojson':
        result = this.parseGeoJson(content);
        break;
    }

    if (result.waypoints.length === 0) {
      throw {
        message: 'No waypoints or track points found in file',
        code: 'NO_POINTS',
      } as ImportError;
    }

    return result;
  }

  /**
   * Parse GPX file content
   * Extracts <wpt> elements as waypoints, or <trkpt> from tracks if no waypoints
   */
  private parseGpx(content: string): ImportResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw {
        message: 'Invalid GPX file: XML parsing failed',
        code: 'PARSE_ERROR',
      } as ImportError;
    }

    const waypoints: LatLng[] = [];
    let name: string | undefined;

    // Try to get route/track name from metadata or first track
    const metadataName = doc.querySelector('metadata > name');
    const trackName = doc.querySelector('trk > name');
    const routeName = doc.querySelector('rte > name');
    name = metadataName?.textContent || trackName?.textContent || routeName?.textContent || undefined;

    // First, try to extract waypoints (<wpt> elements)
    const wptElements = doc.querySelectorAll('wpt');
    if (wptElements.length > 0) {
      wptElements.forEach((wpt) => {
        const lat = parseFloat(wpt.getAttribute('lat') || '');
        const lng = parseFloat(wpt.getAttribute('lon') || '');
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng });
        }
      });
    }

    // If no waypoints, extract from route points (<rtept> elements)
    if (waypoints.length === 0) {
      const rteptElements = doc.querySelectorAll('rtept');
      if (rteptElements.length > 0) {
        rteptElements.forEach((rtept) => {
          const lat = parseFloat(rtept.getAttribute('lat') || '');
          const lng = parseFloat(rtept.getAttribute('lon') || '');
          if (!isNaN(lat) && !isNaN(lng)) {
            waypoints.push({ lat, lng });
          }
        });
      }
    }

    // If still no points, extract from track points (<trkpt> elements)
    if (waypoints.length === 0) {
      const trkptElements = doc.querySelectorAll('trkpt');
      const allTrackPoints: LatLng[] = [];

      trkptElements.forEach((trkpt) => {
        const lat = parseFloat(trkpt.getAttribute('lat') || '');
        const lng = parseFloat(trkpt.getAttribute('lon') || '');
        if (!isNaN(lat) && !isNaN(lng)) {
          allTrackPoints.push({ lat, lng });
        }
      });

      // Sample track points if there are too many
      const sampledPoints = this.samplePoints(allTrackPoints);
      waypoints.push(...sampledPoints);
    }

    return {
      waypoints,
      name,
      format: 'gpx',
    };
  }

  /**
   * Parse KML file content
   * Extracts coordinates from <LineString> or <Point> elements
   */
  private parseKml(content: string): ImportResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw {
        message: 'Invalid KML file: XML parsing failed',
        code: 'PARSE_ERROR',
      } as ImportError;
    }

    const waypoints: LatLng[] = [];
    let name: string | undefined;

    // Try to get document or placemark name
    const documentName = doc.querySelector('Document > name');
    const placemarkName = doc.querySelector('Placemark > name');
    name = documentName?.textContent || placemarkName?.textContent || undefined;

    // Extract from LineString elements first (most common for routes)
    const lineStrings = doc.querySelectorAll('LineString coordinates');
    if (lineStrings.length > 0) {
      lineStrings.forEach((coordElement) => {
        const coords = this.parseKmlCoordinates(coordElement.textContent || '');
        waypoints.push(...coords);
      });
    }

    // If no LineStrings, try MultiGeometry
    if (waypoints.length === 0) {
      const multiGeometryLineStrings = doc.querySelectorAll('MultiGeometry LineString coordinates');
      multiGeometryLineStrings.forEach((coordElement) => {
        const coords = this.parseKmlCoordinates(coordElement.textContent || '');
        waypoints.push(...coords);
      });
    }

    // If still no points, extract from Point elements
    if (waypoints.length === 0) {
      const points = doc.querySelectorAll('Point coordinates');
      points.forEach((coordElement) => {
        const coords = this.parseKmlCoordinates(coordElement.textContent || '');
        waypoints.push(...coords);
      });
    }

    // Sample if too many points
    const sampledWaypoints = this.samplePoints(waypoints);

    return {
      waypoints: sampledWaypoints,
      name,
      format: 'kml',
    };
  }

  /**
   * Parse KML coordinate string (lon,lat,alt format, space-separated)
   */
  private parseKmlCoordinates(coordString: string): LatLng[] {
    const points: LatLng[] = [];
    const coordPairs = coordString.trim().split(/\s+/);

    for (const pair of coordPairs) {
      const parts = pair.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          points.push({ lat, lng });
        }
      }
    }

    return points;
  }

  /**
   * Parse GeoJSON file content
   * Handles Point and LineString features
   */
  private parseGeoJson(content: string): ImportResult {
    let geojson: GeoJSON.GeoJSON;

    try {
      geojson = JSON.parse(content);
    } catch {
      throw {
        message: 'Invalid GeoJSON: JSON parsing failed',
        code: 'PARSE_ERROR',
      } as ImportError;
    }

    const waypoints: LatLng[] = [];
    let name: string | undefined;

    // Handle different GeoJSON types
    if (geojson.type === 'FeatureCollection') {
      const collection = geojson as GeoJSON.FeatureCollection;

      // Get name from first feature with a name property
      for (const feature of collection.features) {
        if (feature.properties?.['name']) {
          name = feature.properties['name'] as string;
          break;
        }
      }

      // Extract coordinates from all features
      for (const feature of collection.features) {
        this.extractGeoJsonCoordinates(feature.geometry, waypoints);
      }
    } else if (geojson.type === 'Feature') {
      const feature = geojson as GeoJSON.Feature;
      name = feature.properties?.['name'] as string | undefined;
      this.extractGeoJsonCoordinates(feature.geometry, waypoints);
    } else {
      // Direct geometry object
      this.extractGeoJsonCoordinates(geojson as GeoJSON.Geometry, waypoints);
    }

    // Sample if too many points
    const sampledWaypoints = this.samplePoints(waypoints);

    return {
      waypoints: sampledWaypoints,
      name,
      format: 'geojson',
    };
  }

  /**
   * Extract coordinates from a GeoJSON geometry object
   */
  private extractGeoJsonCoordinates(geometry: GeoJSON.Geometry, waypoints: LatLng[]): void {
    if (!geometry) return;

    switch (geometry.type) {
      case 'Point':
        const [lng, lat] = geometry.coordinates;
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng });
        }
        break;

      case 'LineString':
        for (const coord of geometry.coordinates) {
          const [coordLng, coordLat] = coord;
          if (!isNaN(coordLat) && !isNaN(coordLng)) {
            waypoints.push({ lat: coordLat, lng: coordLng });
          }
        }
        break;

      case 'MultiPoint':
        for (const coord of geometry.coordinates) {
          const [coordLng, coordLat] = coord;
          if (!isNaN(coordLat) && !isNaN(coordLng)) {
            waypoints.push({ lat: coordLat, lng: coordLng });
          }
        }
        break;

      case 'MultiLineString':
        for (const line of geometry.coordinates) {
          for (const coord of line) {
            const [coordLng, coordLat] = coord;
            if (!isNaN(coordLat) && !isNaN(coordLng)) {
              waypoints.push({ lat: coordLat, lng: coordLng });
            }
          }
        }
        break;

      case 'Polygon':
        // Use the outer ring (first array)
        if (geometry.coordinates.length > 0) {
          for (const coord of geometry.coordinates[0]) {
            const [coordLng, coordLat] = coord;
            if (!isNaN(coordLat) && !isNaN(coordLng)) {
              waypoints.push({ lat: coordLat, lng: coordLng });
            }
          }
        }
        break;

      case 'GeometryCollection':
        for (const geom of geometry.geometries) {
          this.extractGeoJsonCoordinates(geom, waypoints);
        }
        break;
    }
  }

  /**
   * Sample points from a large array to reduce the number of waypoints
   * Keeps first and last points, samples every Nth point in between
   */
  private samplePoints(points: LatLng[], maxPoints = MAX_POINTS_BEFORE_SAMPLING): LatLng[] {
    if (points.length <= maxPoints) {
      return points;
    }

    const result: LatLng[] = [];

    // Always include first point
    result.push(points[0]);

    // Calculate sampling interval
    const interval = Math.ceil(points.length / maxPoints);

    // Sample intermediate points
    for (let i = interval; i < points.length - 1; i += interval) {
      result.push(points[i]);
    }

    // Always include last point (if different from first)
    if (points.length > 1) {
      result.push(points[points.length - 1]);
    }

    return result;
  }

  /**
   * Read file as text using FileReader
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };

      reader.onerror = () => {
        reject(new Error('File reading failed'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Type guard for ImportError
   */
  private isImportError(error: unknown): error is ImportError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      'code' in error
    );
  }
}
