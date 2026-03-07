import { Injectable, signal, computed } from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../environments/environment';

export type DrawMode = 'none' | 'route' | 'nogo-circle' | 'nogo-polyline' | 'nogo-polygon';

export type LayerType = 'base' | 'overlay';

export interface MapLayer {
  id: string;
  name: string;
  url: string;
  attribution: string;
  visible: boolean;
  opacity: number;
  type: LayerType;
  maxZoom?: number;
  subdomains?: string | string[];
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
      type: 'base',
      maxZoom: 19,
    },
    {
      id: 'opencyclemap',
      name: 'OpenCycleMap',
      url: 'https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=YOUR_API_KEY',
      attribution: '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      visible: false,
      opacity: 1,
      type: 'base',
      maxZoom: 22,
    },
    {
      id: 'opentopomap',
      name: 'OpenTopoMap',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      visible: false,
      opacity: 1,
      type: 'base',
      maxZoom: 17,
    },
    {
      id: 'esri-satellite',
      name: 'Esri World Imagery',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      visible: false,
      opacity: 1,
      type: 'base',
      maxZoom: 19,
      subdomains: '',
    },
    {
      id: 'stamen-terrain',
      name: 'Stamen Terrain',
      url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://stamen.com/">Stamen Design</a>',
      visible: false,
      opacity: 1,
      type: 'base',
      maxZoom: 18,
      subdomains: '',
    },
  ]);

  readonly overlayLayers = signal<MapLayer[]>([
    {
      id: 'cycling-routes',
      name: 'Cycling Routes',
      url: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>',
      visible: false,
      opacity: 0.7,
      type: 'overlay',
      maxZoom: 18,
      subdomains: '',
    },
    {
      id: 'hiking-routes',
      name: 'Hiking Routes',
      url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>',
      visible: false,
      opacity: 0.7,
      type: 'overlay',
      maxZoom: 18,
      subdomains: '',
    },
    {
      id: 'openrailwaymap',
      name: 'OpenRailwayMap',
      url: 'https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
      visible: false,
      opacity: 0.7,
      type: 'overlay',
      maxZoom: 19,
      subdomains: '',
    },
    {
      id: 'hillshading',
      name: 'Hillshading',
      url: 'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://wmflabs.org">Wikimedia Labs</a>',
      visible: false,
      opacity: 0.5,
      type: 'overlay',
      maxZoom: 18,
      subdomains: '',
    },
  ]);

  readonly activeBaseLayer = computed(() =>
    this.baseLayers().find((l) => l.visible) ?? this.baseLayers()[0]
  );

  readonly activeOverlays = computed(() =>
    this.overlayLayers().filter((l) => l.visible)
  );

  // Track Leaflet tile layer instances
  private baseLayerInstances = new Map<string, L.TileLayer>();
  private overlayLayerInstances = new Map<string, L.TileLayer>();

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
    // Update the actual tile layer opacity if it exists
    const tileLayer = this.overlayLayerInstances.get(layerId);
    if (tileLayer) {
      tileLayer.setOpacity(opacity);
    }
  }

  // Create a Leaflet tile layer from a MapLayer definition
  createTileLayer(layer: MapLayer): L.TileLayer {
    const options: L.TileLayerOptions = {
      attribution: layer.attribution,
      opacity: layer.opacity,
      maxZoom: layer.maxZoom,
    };

    if (layer.subdomains !== undefined && layer.subdomains !== '') {
      options.subdomains = layer.subdomains;
    }

    return L.tileLayer(layer.url, options);
  }

  // Initialize base layer on the map
  initializeBaseLayer(): void {
    const map = this.map();
    if (!map) return;

    const activeBase = this.activeBaseLayer();
    if (!activeBase) return;

    // Remove existing base layers
    this.baseLayerInstances.forEach((layer) => {
      map.removeLayer(layer);
    });
    this.baseLayerInstances.clear();

    // Add the active base layer
    const tileLayer = this.createTileLayer(activeBase);
    tileLayer.addTo(map);
    this.baseLayerInstances.set(activeBase.id, tileLayer);
  }

  // Switch base layer on the map
  switchBaseLayer(layerId: string): void {
    const map = this.map();
    if (!map) return;

    // Update state
    this.setBaseLayer(layerId);

    // Remove all existing base layers from map
    this.baseLayerInstances.forEach((layer) => {
      map.removeLayer(layer);
    });
    this.baseLayerInstances.clear();

    // Find the new base layer and add it
    const newBaseLayer = this.baseLayers().find((l) => l.id === layerId);
    if (newBaseLayer) {
      const tileLayer = this.createTileLayer(newBaseLayer);
      tileLayer.addTo(map);
      this.baseLayerInstances.set(layerId, tileLayer);
    }
  }

  // Toggle an overlay layer on the map
  toggleOverlayLayer(layerId: string): void {
    const map = this.map();
    if (!map) return;

    // Update state
    this.toggleOverlay(layerId);

    const overlayLayer = this.overlayLayers().find((l) => l.id === layerId);
    if (!overlayLayer) return;

    const existingLayer = this.overlayLayerInstances.get(layerId);

    if (overlayLayer.visible) {
      // Layer should be visible - add it if not already
      if (!existingLayer) {
        const tileLayer = this.createTileLayer(overlayLayer);
        tileLayer.addTo(map);
        this.overlayLayerInstances.set(layerId, tileLayer);
      }
    } else {
      // Layer should be hidden - remove it if exists
      if (existingLayer) {
        map.removeLayer(existingLayer);
        this.overlayLayerInstances.delete(layerId);
      }
    }
  }

  // Get combined attribution from all active layers
  getActiveAttributions(): string {
    const attributions: string[] = [];

    const activeBase = this.activeBaseLayer();
    if (activeBase) {
      attributions.push(activeBase.attribution);
    }

    this.activeOverlays().forEach((overlay) => {
      attributions.push(overlay.attribution);
    });

    return attributions.join(' | ');
  }

  // Clear all layer instances (for cleanup)
  clearLayerInstances(): void {
    const map = this.map();
    if (map) {
      this.baseLayerInstances.forEach((layer) => map.removeLayer(layer));
      this.overlayLayerInstances.forEach((layer) => map.removeLayer(layer));
    }
    this.baseLayerInstances.clear();
    this.overlayLayerInstances.clear();
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
