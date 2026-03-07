import {
  Component,
  inject,
  effect,
  OnDestroy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import * as GeoJSON from 'geojson';
import { MapState } from '../../../../state/map.state';
import { BoundaryService, ActiveBoundary } from '../../../../core/services/boundary';

/**
 * Component that renders boundary polygons on the Leaflet map
 *
 * This component manages the display of boundary GeoJSON features
 * on the map, handling visibility, styling, and interaction.
 */
@Component({
  selector: 'app-boundary-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- This component has no visible template - it manages Leaflet layers -->
  `,
  styles: [
    `
      :host {
        display: none;
      }
    `,
  ],
})
export class BoundaryDisplayComponent implements OnDestroy {
  private readonly mapState = inject(MapState);
  private readonly boundaryService = inject(BoundaryService);

  // Output event when a boundary is clicked
  readonly boundaryClick = output<ActiveBoundary>();

  // Layer group for all boundary layers
  private boundaryLayerGroup: L.LayerGroup | null = null;

  // Map of boundary ID to Leaflet layer
  private boundaryLayers = new Map<string, L.GeoJSON>();

  // Preview layer (separate from active boundaries)
  private previewLayer: L.GeoJSON | null = null;

  constructor() {
    // Effect to sync boundaries with map when they change
    effect(() => {
      const boundaries = this.boundaryService.activeBoundaries();
      this.syncBoundariesWithMap(boundaries);
    });

    // Effect to render preview boundary
    effect(() => {
      const preview = this.boundaryService.previewBoundary();
      this.updatePreviewLayer(preview);
    });

    // Effect to ensure layer group is added when map is ready
    effect(() => {
      const map = this.mapState.map();
      if (map && !this.boundaryLayerGroup) {
        this.initializeLayerGroup(map);
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Fit the map to a specific boundary's bounds
   */
  fitToBoundary(boundaryId: string): void {
    const boundary = this.boundaryService.getBoundaryById(boundaryId);
    if (boundary?.bounds) {
      const [[south, west], [north, east]] = boundary.bounds;
      this.mapState.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [20, 20] }
      );
    }
  }

  /**
   * Fit the map to show all visible boundaries
   */
  fitToAllBoundaries(): void {
    const visibleBoundaries = this.boundaryService.visibleBoundaries()
      .filter((b) => b.bounds); // Only boundaries with loaded geometry
    if (visibleBoundaries.length === 0) return;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    for (const boundary of visibleBoundaries) {
      const [[south, west], [north, east]] = boundary.bounds!;
      minLat = Math.min(minLat, south);
      maxLat = Math.max(maxLat, north);
      minLon = Math.min(minLon, west);
      maxLon = Math.max(maxLon, east);
    }

    this.mapState.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [20, 20] }
    );
  }

  private initializeLayerGroup(map: L.Map): void {
    this.boundaryLayerGroup = L.layerGroup().addTo(map);

    // Re-sync any existing boundaries
    const boundaries = this.boundaryService.activeBoundaries();
    if (boundaries.length > 0) {
      this.syncBoundariesWithMap(boundaries);
    }
  }

  private syncBoundariesWithMap(boundaries: ActiveBoundary[]): void {
    const map = this.mapState.map();
    if (!map || !this.boundaryLayerGroup) return;

    const currentIds = new Set(boundaries.map((b) => b.id));

    // Remove layers that no longer exist
    this.boundaryLayers.forEach((layer, id) => {
      if (!currentIds.has(id)) {
        this.boundaryLayerGroup!.removeLayer(layer);
        this.boundaryLayers.delete(id);
      }
    });

    // Update or create layers
    for (const boundary of boundaries) {
      // Skip boundaries without geometry (not yet loaded)
      if (!boundary.feature) continue;

      const existingLayer = this.boundaryLayers.get(boundary.id);

      if (existingLayer) {
        // Update existing layer visibility and style
        if (boundary.visible) {
          if (!this.boundaryLayerGroup.hasLayer(existingLayer)) {
            this.boundaryLayerGroup.addLayer(existingLayer);
          }
          // Update style if color changed
          existingLayer.setStyle(this.getBoundaryStyle(boundary));
        } else {
          this.boundaryLayerGroup.removeLayer(existingLayer);
        }
      } else if (boundary.visible) {
        // Create new layer
        const layer = this.createBoundaryLayer(boundary);
        this.boundaryLayers.set(boundary.id, layer);
        this.boundaryLayerGroup.addLayer(layer);
      }
    }
  }

  private createBoundaryLayer(boundary: ActiveBoundary): L.GeoJSON {
    const layer = L.geoJSON(boundary.feature, {
      style: () => this.getBoundaryStyle(boundary),
      onEachFeature: (feature, layer) => {
        // Bind popup with boundary name
        layer.bindPopup(this.createPopupContent(boundary));

        // Handle click events
        layer.on('click', () => {
          this.boundaryClick.emit(boundary);
        });
      },
    });

    return layer;
  }

  private getBoundaryStyle(boundary: ActiveBoundary): L.PathOptions {
    if (!boundary.feature) {
      return { color: boundary.color, weight: 2, opacity: 0.5 };
    }
    const geometryType = boundary.feature.geometry.type;

    // Line styles for routes
    if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      return {
        color: boundary.color,
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 4',
      };
    }

    // Polygon styles for areas
    return {
      color: boundary.color,
      weight: 3,
      opacity: 0.9,
      fillColor: boundary.color,
      fillOpacity: 0.15,
    };
  }

  private createPopupContent(boundary: ActiveBoundary): string {
    const categoryLabel = this.getCategoryLabel(boundary.category);

    return `
      <div class="boundary-popup" style="min-width: 150px;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">
          ${boundary.name}
        </h4>
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
          ${categoryLabel}
        </div>
        <div style="font-size: 11px; color: #999;">
          ${this.truncateDisplayName(boundary.displayName)}
        </div>
      </div>
    `;
  }

  private getCategoryLabel(category: string): string {
    switch (category) {
      case 'administrative':
        return 'Administrative Region';
      case 'protected_area':
        return 'Protected Area';
      case 'route':
        return 'Route / Trail';
      case 'natural':
        return 'Natural Feature';
      default:
        return 'Region';
    }
  }

  private truncateDisplayName(displayName: string, maxLength = 60): string {
    if (displayName.length <= maxLength) {
      return displayName;
    }
    return displayName.substring(0, maxLength) + '...';
  }

  private updatePreviewLayer(preview: ActiveBoundary | null): void {
    const map = this.mapState.map();
    if (!map) return;

    // Remove existing preview layer
    if (this.previewLayer) {
      map.removeLayer(this.previewLayer);
      this.previewLayer = null;
    }

    // Add new preview layer if provided
    if (preview && preview.feature) {
      const geometryType = preview.feature.geometry.type;

      // Preview style - orange dashed line
      const style: L.PathOptions =
        geometryType === 'LineString' || geometryType === 'MultiLineString'
          ? {
              color: '#f97316',
              weight: 5,
              opacity: 0.9,
              dashArray: '10, 6',
            }
          : {
              color: '#f97316',
              weight: 3,
              opacity: 0.9,
              fillColor: '#f97316',
              fillOpacity: 0.2,
              dashArray: '6, 4',
            };

      this.previewLayer = L.geoJSON(preview.feature, { style: () => style });
      this.previewLayer.addTo(map);

      // Bring preview to front
      this.previewLayer.bringToFront();
    }
  }

  private cleanup(): void {
    const map = this.mapState.map();

    if (this.boundaryLayerGroup && map) {
      map.removeLayer(this.boundaryLayerGroup);
    }

    if (this.previewLayer && map) {
      map.removeLayer(this.previewLayer);
    }

    this.boundaryLayers.clear();
    this.boundaryLayerGroup = null;
    this.previewLayer = null;
  }
}
