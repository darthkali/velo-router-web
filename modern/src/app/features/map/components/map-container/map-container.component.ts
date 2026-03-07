import { Component, OnInit, inject, effect, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import * as L from 'leaflet';
import { RouteState } from '../../../../state/route.state';
import { MapState } from '../../../../state/map.state';
import { RoutingService } from '../../services/routing.service';
import { environment } from '../../../../../environments/environment';
import { Waypoint } from '../../../../core/services/brouter/brouter.types';
import { BoundaryDisplayComponent } from '../boundary-display/boundary-display.component';
import { POIDisplayComponent } from '../poi-display/poi-display.component';
import { RouteHoverPoint } from '../../../elevation/components/elevation-chart/elevation-chart.component';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'];
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
});

// Custom icon factory for waypoint markers
function createWaypointIcon(type: 'start' | 'via' | 'end', index: number): L.DivIcon {
  const colors = {
    start: { bg: '#22c55e', border: '#16a34a' },
    via: { bg: '#3b82f6', border: '#2563eb' },
    end: { bg: '#ef4444', border: '#dc2626' },
  };
  const color = colors[type];
  const label = type === 'start' ? 'S' : type === 'end' ? 'E' : String(index);

  return L.divIcon({
    className: 'custom-waypoint-marker',
    html: `
      <div style="
        width: 16px;
        height: 16px;
        background: ${color.bg};
        border: 2px solid ${color.border};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: grab;
      ">${label}</div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule, LeafletModule, BoundaryDisplayComponent, POIDisplayComponent],
  template: `
    <div class="h-full w-full relative">
      <div
        leaflet
        [leafletOptions]="mapOptions"
        [leafletLayers]="layers"
        (leafletMapReady)="onMapReady($event)"
        (leafletClick)="onMapClick($event)"
        class="h-full w-full z-0">
      </div>

      <!-- Route polyline will be rendered here -->
      @if (routeState.hasRoute()) {
        <div class="absolute bottom-4 left-4 z-[1000]">
          <div class="card flex gap-4 text-sm" role="status" aria-label="Route Statistiken" aria-live="polite">
            <div>
              <span class="text-gray-500">Distance:</span>
              <span class="font-semibold ml-1">{{ routeState.formattedDistance() }}</span>
            </div>
            <div>
              <span class="text-gray-500">Ascent:</span>
              <span class="font-semibold ml-1">{{ routeState.formattedAscent() }}</span>
            </div>
            <div>
              <span class="text-gray-500">Time:</span>
              <span class="font-semibold ml-1">{{ routeState.formattedTime() }}</span>
            </div>
          </div>
        </div>
      }


      <!-- Loading indicator with aria-live for screen readers -->
      @if (routeState.isCalculating()) {
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none" aria-live="polite" aria-atomic="true">
          <div class="bg-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3" role="status">
            <svg class="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm font-medium">Route wird berechnet...</span>
          </div>
        </div>
      }

      <!-- Empty State - Show when no route and not drawing and not dismissed -->
      @if (!routeState.hasRoute() && !mapState.isDrawing() && !hasSeenOnboarding) {
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
          <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center pointer-events-auto max-w-sm mx-4">
            <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Route planen</h2>
            <p class="text-gray-500 mb-6 text-sm">Klicke auf die Karte oder suche einen Ort, um deine Route zu starten.</p>
            <button
              (click)="dismissOnboarding()"
              class="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
              Route zeichnen
            </button>
          </div>
        </div>
      }

      <!-- Boundary display component (renders GeoJSON boundaries on the map) -->
      <app-boundary-display />

      <!-- POI display component (renders POI markers on the map) -->
      <app-poi-display />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }

    :host ::ng-deep .route-loading-line {
      animation: dash-animation 1s linear infinite;
    }

    @keyframes dash-animation {
      to {
        stroke-dashoffset: -20;
      }
    }

    :host ::ng-deep .custom-waypoint-marker {
      background: transparent;
      border: none;
    }

    :host ::ng-deep .custom-poi-marker {
      background: transparent;
      border: none;
    }

    :host ::ng-deep .poi-popup .leaflet-popup-content {
      margin: 0;
    }

    :host ::ng-deep .elevation-cursor-marker {
      z-index: 1000;
      pointer-events: none;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }
  `],
})
export class MapContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly routeState = inject(RouteState);
  readonly mapState = inject(MapState);
  private readonly routingService = inject(RoutingService);

  // Onboarding state - check if user has seen the "Route planen" dialog before
  hasSeenOnboarding = typeof localStorage !== 'undefined' &&
    localStorage.getItem('velo-router-onboarding-dismissed') === 'true';

  dismissOnboarding(): void {
    this.hasSeenOnboarding = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('velo-router-onboarding-dismissed', 'true');
    }
    this.mapState.toggleDrawMode('route');
  }

  private map: L.Map | null = null;
  private routeLayer: L.LayerGroup = L.layerGroup();
  private waypointLayer: L.LayerGroup = L.layerGroup();
  private markerMap = new Map<string, L.Marker>();
  private removeWaypointHandler: ((e: Event) => void) | null = null;

  /** Signal for elevation chart hover point */
  readonly elevationHoverPoint = signal<RouteHoverPoint | null>(null);

  /** Cursor marker for elevation chart synchronization */
  private elevationCursorMarker: L.CircleMarker | null = null;

  mapOptions: L.MapOptions = {
    center: [environment.defaultCenter.lat, environment.defaultCenter.lng],
    zoom: environment.defaultZoom,
    zoomControl: true,
  };

  // Empty layers array - base layers are now managed by MapState
  layers: L.Layer[] = [];

  constructor() {
    // React to segment changes
    effect(() => {
      const segments = this.routeState.segments();
      this.updateRouteDisplay(segments);
    });

    // React to waypoint changes
    effect(() => {
      const waypoints = this.routeState.waypoints();
      this.updateWaypointMarkers(waypoints);
    });

    // Listen for remove waypoint events from popups
    this.removeWaypointHandler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        this.routeState.removeWaypoint(customEvent.detail);
      }
    };
    window.addEventListener('removeWaypoint', this.removeWaypointHandler);

    // React to elevation hover point changes
    effect(() => {
      const hoverPoint = this.elevationHoverPoint();
      this.updateElevationCursor(hoverPoint);
    });
  }

  /**
   * Update the elevation cursor marker on the map
   */
  private updateElevationCursor(point: RouteHoverPoint | null): void {
    if (!this.map) return;

    if (point) {
      if (this.elevationCursorMarker) {
        // Update existing marker position
        this.elevationCursorMarker.setLatLng([point.lat, point.lng]);
      } else {
        // Create new cursor marker
        this.elevationCursorMarker = L.circleMarker([point.lat, point.lng], {
          radius: 8,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          color: '#ffffff',
          weight: 3,
          className: 'elevation-cursor-marker',
        });
        this.elevationCursorMarker.addTo(this.map);
      }
    } else {
      // Remove cursor marker when not hovering
      if (this.elevationCursorMarker) {
        this.elevationCursorMarker.remove();
        this.elevationCursorMarker = null;
      }
    }
  }

  /**
   * Set the elevation hover point (called from parent component)
   */
  setElevationHoverPoint(point: RouteHoverPoint | null): void {
    this.elevationHoverPoint.set(point);
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if (this.removeWaypointHandler) {
      window.removeEventListener('removeWaypoint', this.removeWaypointHandler);
    }
    // Clean up elevation cursor marker
    if (this.elevationCursorMarker) {
      this.elevationCursorMarker.remove();
      this.elevationCursorMarker = null;
    }
    // Clean up layer instances
    this.mapState.clearLayerInstances();
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.mapState.setMap(map);

    // Initialize base layer from MapState
    this.mapState.initializeBaseLayer();

    // Add layer groups
    this.routeLayer.addTo(map);
    this.waypointLayer.addTo(map);

    // Listen for map events
    map.on('moveend', () => {
      this.mapState.center.set(map.getCenter());
      this.mapState.zoom.set(map.getZoom());
    });
  }

  onMapClick(event: L.LeafletMouseEvent): void {
    if (this.mapState.drawMode() === 'route') {
      this.routeState.addWaypoint({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    }
  }

  private updateRouteDisplay(segments: typeof this.routeState.segments extends () => infer T ? T : never): void {
    this.routeLayer.clearLayers();

    segments.forEach((segment, segmentIndex) => {
      if (segment.geojson) {
        // Calculated route - solid blue line
        const coords = segment.geojson.geometry.coordinates.map(
          (c) => [c[1], c[0]] as L.LatLngTuple
        );

        const polyline = L.polyline(coords, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.8,
        });

        // Make polyline clickable to insert via-points
        polyline.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);

          const clickLatLng = e.latlng;
          const waypoints = this.routeState.waypoints();

          // Find which segment was clicked by checking distance to each segment
          let insertIndex = segmentIndex + 1; // Default: insert after the segment's start waypoint

          // Check each segment to find the closest one
          let minDistance = Infinity;
          for (let i = 0; i < waypoints.length - 1; i++) {
            const from = L.latLng(waypoints[i].lat, waypoints[i].lng);
            const to = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lng);

            const distToSegment = this.distanceToSegment(clickLatLng, from, to);
            if (distToSegment < minDistance) {
              minDistance = distToSegment;
              insertIndex = i + 1;
            }
          }

          // Insert waypoint at the clicked position
          this.routeState.insertWaypointAt(insertIndex, {
            lat: clickLatLng.lat,
            lng: clickLatLng.lng,
          });
        });

        this.routeLayer.addLayer(polyline);
      } else if (segment.error) {
        // Error state - red dashed line
        const from = L.latLng(segment.from.lat, segment.from.lng);
        const to = L.latLng(segment.to.lat, segment.to.lng);

        const errorLine = L.polyline([from, to], {
          color: '#ef4444',
          weight: 3,
          opacity: 0.7,
          dashArray: '8, 8',
        });

        this.routeLayer.addLayer(errorLine);
      } else if (segment.loading) {
        // Loading state - animated orange dashed line
        const from = L.latLng(segment.from.lat, segment.from.lng);
        const to = L.latLng(segment.to.lat, segment.to.lng);

        const loadingLine = L.polyline([from, to], {
          color: '#f97316',
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 10',
          className: 'route-loading-line',
        });

        this.routeLayer.addLayer(loadingLine);
      }
    });
  }

  /**
   * Calculate the distance from a point to a line segment
   */
  private distanceToSegment(point: L.LatLng, segStart: L.LatLng, segEnd: L.LatLng): number {
    const x = point.lat;
    const y = point.lng;
    const x1 = segStart.lat;
    const y1 = segStart.lng;
    const x2 = segEnd.lat;
    const y2 = segEnd.lng;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx: number;
    let yy: number;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    // Return distance in meters (approximate)
    return Math.sqrt(dx * dx + dy * dy) * 111000;
  }

  private updateWaypointMarkers(waypoints: Waypoint[]): void {
    const currentIds = new Set(waypoints.map((wp) => wp.id));

    // Remove markers that no longer exist
    this.markerMap.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        this.waypointLayer.removeLayer(marker);
        this.markerMap.delete(id);
      }
    });

    // Update or create markers
    waypoints.forEach((wp, index) => {
      const existingMarker = this.markerMap.get(wp.id);

      const waypointType = wp.type || 'via';

      if (existingMarker) {
        // Update existing marker position and icon
        existingMarker.setLatLng([wp.lat, wp.lng]);
        existingMarker.setIcon(createWaypointIcon(waypointType, index));
      } else {
        // Create new draggable marker
        const marker = L.marker([wp.lat, wp.lng], {
          icon: createWaypointIcon(waypointType, index),
          draggable: true,
        });

        // Handle click to delete waypoint
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);

          // Don't delete if only 2 waypoints remain (need at least start and end)
          const waypoints = this.routeState.waypoints();
          if (waypoints.length <= 2) {
            return;
          }

          // Visual feedback: brief scale animation before removing
          const markerElement = (e.target as L.Marker).getElement();
          if (markerElement) {
            markerElement.style.transition = 'transform 0.15s ease-out, opacity 0.15s ease-out';
            markerElement.style.transform = 'scale(0)';
            markerElement.style.opacity = '0';
          }

          // Remove waypoint after brief animation
          setTimeout(() => {
            this.routeState.removeWaypoint(wp.id);
          }, 150);
        });

        // Handle drag events
        marker.on('dragstart', () => {
          marker.closePopup();
        });

        marker.on('drag', (e) => {
          // Optional: show preview during drag
        });

        marker.on('dragend', (e) => {
          const newLatLng = (e.target as L.Marker).getLatLng();
          this.routeState.updateWaypointPosition(wp.id, {
            lat: newLatLng.lat,
            lng: newLatLng.lng,
          });
        });

        this.waypointLayer.addLayer(marker);
        this.markerMap.set(wp.id, marker);
      }
    });
  }
}
