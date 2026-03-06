import { Component, OnInit, inject, effect, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import * as L from 'leaflet';
import { RouteState } from '../../../../state/route.state';
import { MapState } from '../../../../state/map.state';
import { RoutingService } from '../../services/routing.service';
import { environment } from '../../../../../environments/environment';
import { Waypoint } from '../../../../core/services/brouter/brouter.types';

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
        width: 28px;
        height: 28px;
        background: ${color.bg};
        border: 3px solid ${color.border};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: grab;
      ">${label}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule, LeafletModule],
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
          <div class="card flex gap-4 text-sm">
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

      <!-- Draw mode indicator -->
      @if (mapState.isDrawing()) {
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
          <div class="bg-primary-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span class="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span>Click on map to add waypoints</span>
            <button
              (click)="mapState.stopDrawMode()"
              class="ml-2 hover:bg-primary-700 rounded p-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      }

      <!-- Loading indicator -->
      @if (routeState.isCalculating()) {
        <div class="absolute top-4 right-4 z-[1000]">
          <div class="bg-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <svg class="animate-spin h-4 w-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Calculating route...</span>
          </div>
        </div>
      }
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
  `],
})
export class MapContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly routeState = inject(RouteState);
  readonly mapState = inject(MapState);
  private readonly routingService = inject(RoutingService);

  private map: L.Map | null = null;
  private routeLayer: L.LayerGroup = L.layerGroup();
  private waypointLayer: L.LayerGroup = L.layerGroup();
  private markerMap = new Map<string, L.Marker>();
  private removeWaypointHandler: ((e: Event) => void) | null = null;

  mapOptions: L.MapOptions = {
    center: [environment.defaultCenter.lat, environment.defaultCenter.lng],
    zoom: environment.defaultZoom,
    zoomControl: true,
  };

  layers: L.Layer[] = [
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
  ];

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
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if (this.removeWaypointHandler) {
      window.removeEventListener('removeWaypoint', this.removeWaypointHandler);
    }
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.mapState.setMap(map);

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

    segments.forEach((segment) => {
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

        marker.bindPopup(`
          <div class="p-2">
            <div class="font-semibold">${wp.name || `Waypoint ${index + 1}`}</div>
            <div class="text-sm text-gray-500">
              ${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}
            </div>
            <button onclick="window.dispatchEvent(new CustomEvent('removeWaypoint', {detail: '${wp.id}'}))"
                    class="mt-2 text-red-600 text-sm hover:underline">
              Remove
            </button>
          </div>
        `);

        this.waypointLayer.addLayer(marker);
        this.markerMap.set(wp.id, marker);
      }
    });
  }
}
