import { Injectable } from '@angular/core';
import { RouteSegment } from '../brouter/brouter.types';

export type ExportFormat = 'gpx' | 'kml' | 'geojson';

interface CombinedRouteData {
  coordinates: number[][];
  properties: {
    name?: string;
    'track-length': number;
    'filtered ascend': number;
    'plain-ascend': number;
    'total-time': number;
    cost: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  /**
   * Export route as GPX file
   */
  exportAsGpx(segments: RouteSegment[], filename: string): void {
    const routeData = this.combineSegments(segments);
    if (!routeData) {
      console.warn('No valid route data to export');
      return;
    }

    const gpxContent = this.buildGpx(routeData, filename);
    this.downloadFile(gpxContent, `${filename}.gpx`, 'application/gpx+xml');
  }

  /**
   * Export route as KML file
   */
  exportAsKml(segments: RouteSegment[], filename: string): void {
    const routeData = this.combineSegments(segments);
    if (!routeData) {
      console.warn('No valid route data to export');
      return;
    }

    const kmlContent = this.buildKml(routeData, filename);
    this.downloadFile(kmlContent, `${filename}.kml`, 'application/vnd.google-earth.kml+xml');
  }

  /**
   * Export route as GeoJSON file
   */
  exportAsGeoJson(segments: RouteSegment[], filename: string): void {
    const routeData = this.combineSegments(segments);
    if (!routeData) {
      console.warn('No valid route data to export');
      return;
    }

    const geojsonContent = this.buildGeoJson(routeData, filename);
    this.downloadFile(geojsonContent, `${filename}.geojson`, 'application/geo+json');
  }

  /**
   * Export route in specified format
   */
  export(segments: RouteSegment[], filename: string, format: ExportFormat): void {
    switch (format) {
      case 'gpx':
        this.exportAsGpx(segments, filename);
        break;
      case 'kml':
        this.exportAsKml(segments, filename);
        break;
      case 'geojson':
        this.exportAsGeoJson(segments, filename);
        break;
    }
  }

  /**
   * Combine all segment geojsons into one continuous route
   */
  private combineSegments(segments: RouteSegment[]): CombinedRouteData | null {
    const validSegments = segments.filter(
      (s) => s.geojson && !s.loading && !s.error
    );

    if (validSegments.length === 0) {
      return null;
    }

    const coordinates: number[][] = [];
    let totalLength = 0;
    let totalAscent = 0;
    let totalPlainAscent = 0;
    let totalTime = 0;
    let totalCost = 0;

    validSegments.forEach((segment, index) => {
      const geojson = segment.geojson!;
      const coords = geojson.geometry.coordinates;

      // For subsequent segments, skip the first coordinate to avoid duplicates
      // (it's the same as the last coordinate of the previous segment)
      const startIndex = index === 0 ? 0 : 1;

      for (let i = startIndex; i < coords.length; i++) {
        coordinates.push(coords[i]);
      }

      // Aggregate properties
      const props = geojson.properties || {};
      totalLength += this.parseNumber(props['track-length']);
      totalAscent += this.parseNumber(props['filtered ascend']);
      totalPlainAscent += this.parseNumber(props['plain-ascend']);
      totalTime += this.parseNumber(props['total-time']);
      totalCost += this.parseNumber(props['cost']);
    });

    return {
      coordinates,
      properties: {
        'track-length': totalLength,
        'filtered ascend': totalAscent,
        'plain-ascend': totalPlainAscent,
        'total-time': totalTime,
        cost: totalCost,
      },
    };
  }

  /**
   * Build GPX XML string
   */
  private buildGpx(data: CombinedRouteData, name: string): string {
    const { coordinates, properties } = data;

    // Build track points
    const trackpoints = coordinates
      .map((coord) => {
        const [lon, lat, ele] = coord;
        const eleTag = ele !== undefined ? `<ele>${ele}</ele>` : '';
        return `      <trkpt lat="${lat}" lon="${lon}">${eleTag}</trkpt>`;
      })
      .join('\n');

    // Build stats comment like brouter-web
    const statsComment = this.buildGpxStatsComment(properties);

    // Format time for display
    const formattedTime = this.formatTime(properties['total-time']);

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
${statsComment}
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
     version="1.1"
     creator="VeloRouter">
  <metadata>
    <name>${this.escapeXml(name)}</name>
    <desc>Distance: ${(properties['track-length'] / 1000).toFixed(2)} km, Ascent: ${Math.round(properties['filtered ascend'])} m, Time: ${formattedTime}</desc>
    <link href="${typeof window !== 'undefined' ? window.location.href : ''}">
      <text>VeloRouter</text>
    </link>
  </metadata>
  <trk>
    <name>${this.escapeXml(name)}</name>
    <trkseg>
${trackpoints}
    </trkseg>
  </trk>
</gpx>`;

    return gpx;
  }

  /**
   * Build GPX stats comment (like brouter-web)
   */
  private buildGpxStatsComment(properties: CombinedRouteData['properties']): string {
    let comment = '<!-- ';
    comment += `track-length = ${properties['track-length']}`;
    comment += ` filtered ascend = ${properties['filtered ascend']}`;
    comment += ` plain-ascend = ${properties['plain-ascend']}`;
    comment += ` cost=${properties.cost}`;
    if (properties['total-time']) {
      comment += ` time=${this.formatTime(properties['total-time'])}`;
    }
    comment += ' -->';
    return comment;
  }

  /**
   * Build KML XML string
   */
  private buildKml(data: CombinedRouteData, name: string): string {
    const { coordinates, properties } = data;

    // Build coordinate string (lon,lat,ele format for KML)
    const coordString = coordinates
      .map((coord) => {
        const [lon, lat, ele] = coord;
        return ele !== undefined ? `${lon},${lat},${ele}` : `${lon},${lat},0`;
      })
      .join('\n            ');

    const formattedTime = this.formatTime(properties['total-time']);

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${this.escapeXml(name)}</name>
    <description>Distance: ${(properties['track-length'] / 1000).toFixed(2)} km, Ascent: ${Math.round(properties['filtered ascend'])} m, Time: ${formattedTime}</description>
    <Style id="routeStyle">
      <LineStyle>
        <color>ffff7800</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${this.escapeXml(name)}</name>
      <styleUrl>#routeStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
            ${coordString}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

    return kml;
  }

  /**
   * Build GeoJSON string
   */
  private buildGeoJson(data: CombinedRouteData, name: string): string {
    const { coordinates, properties } = data;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name,
            ...properties,
          },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      ],
    };

    return JSON.stringify(geojson, null, 2);
  }

  /**
   * Trigger file download
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse number from string or number value
   */
  private parseNumber(value: unknown): number {
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Format seconds as time string (like brouter-web)
   */
  private formatTime(seconds: number): string {
    const hours = Math.trunc(seconds / 3600);
    const minutes = Math.trunc((seconds - hours * 3600) / 60);
    const secs = Math.trunc(seconds - hours * 3600 - minutes * 60);

    let time = '';
    if (hours !== 0) time += `${hours}h `;
    if (minutes !== 0) time += `${minutes}m `;
    if (secs !== 0) time += `${secs}s`;

    return time.trim() || '0s';
  }
}
