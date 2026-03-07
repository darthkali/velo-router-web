import { Injectable, signal, computed } from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../environments/environment';

export type DrawMode = 'none' | 'route' | 'nogo-circle' | 'nogo-polyline' | 'nogo-polygon';

export interface MapLayer {
  id: string;
  name: string;
  url: string;
  attribution: string;
  visible: boolean;
  opacity: number;
}

@Injectable({ providedIn: 'root' })
export class MapState {
  // Map instance reference (signal-based for reactivity)
  readonly map = signal<L.Map | null>(null);

  // Map view state
  readonly center = signal<L.LatLngExpression>([
    environment.defaultCenter.lat,
    environment.defaultCenter.lng,
  ]);
  readonly zoom = signal<number>(environment.defaultZoom);

  // Interaction mode
  readonly drawMode = signal<DrawMode>('none');
  readonly isDrawing = computed(() => this.drawMode() !== 'none');

  // Layer state
  readonly baseLayers = signal<MapLayer[]>([
    {
      id: 'osm',
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      visible: true,
      opacity: 1,
    },
    {
      id: 'osm-cycle',
      name: 'OpenCycleMap',
      url: 'https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png',
      attribution: '&copy; Thunderforest, &copy; OpenStreetMap',
      visible: false,
      opacity: 1,
    },
  ]);

  readonly overlayLayers = signal<MapLayer[]>([]);

  readonly activeBaseLayer = computed(() =>
    this.baseLayers().find((l) => l.visible) ?? this.baseLayers()[0]
  );

  // UI state
  readonly sidebarOpen = signal<boolean>(true);
  readonly sidebarTab = signal<string>('route');

  // Actions
  setMap(map: L.Map): void {
    this.map.set(map);
  }

  getMap(): L.Map | null {
    return this.map();
  }

  setCenter(center: L.LatLngExpression): void {
    this.center.set(center);
    this.map()?.setView(center, this.zoom());
  }

  setZoom(zoom: number): void {
    this.zoom.set(zoom);
    this.map()?.setZoom(zoom);
  }

  setView(center: L.LatLngExpression, zoom: number): void {
    this.center.set(center);
    this.zoom.set(zoom);
    this.map()?.setView(center, zoom);
  }

  fitBounds(bounds: L.LatLngBoundsExpression, options?: L.FitBoundsOptions): void {
    this.map()?.fitBounds(bounds, options);
  }

  startDrawMode(mode: DrawMode): void {
    this.drawMode.set(mode);
  }

  stopDrawMode(): void {
    this.drawMode.set('none');
  }

  toggleDrawMode(mode: DrawMode): void {
    if (this.drawMode() === mode) {
      this.stopDrawMode();
    } else {
      this.startDrawMode(mode);
    }
  }

  setBaseLayer(layerId: string): void {
    this.baseLayers.update((layers) =>
      layers.map((l) => ({ ...l, visible: l.id === layerId }))
    );
  }

  toggleOverlay(layerId: string): void {
    this.overlayLayers.update((layers) =>
      layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      )
    );
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.overlayLayers.update((layers) =>
      layers.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  setSidebarTab(tab: string): void {
    this.sidebarTab.set(tab);
    if (!this.sidebarOpen()) {
      this.sidebarOpen.set(true);
    }
  }
}
