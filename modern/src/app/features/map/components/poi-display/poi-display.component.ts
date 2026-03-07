import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  effect,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, fromEvent, of } from 'rxjs';
import {
  debounceTime,
  takeUntil,
  catchError,
  filter,
  tap,
} from 'rxjs/operators';
import * as L from 'leaflet';
import { MapState } from '../../../../state/map.state';
import { POIState } from '../../../../state/poi.state';
import { OverpassService, POIResult, POICategory } from '../../../../core/services/overpass';

// Minimum zoom level for POI queries
const MIN_ZOOM_LEVEL = 10;

// Debounce time for map move events (ms)
const MAP_MOVE_DEBOUNCE = 500;

/**
 * POI Display Component
 *
 * Renders POI markers on the Leaflet map based on enabled categories.
 * Queries the Overpass API when the map moves (with debounce).
 */
@Component({
  selector: 'app-poi-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Zoom level message -->
    @if (showZoomMessage()) {
      <div class="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
        <div class="bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span>Zoom in to see Points of Interest</span>
        </div>
      </div>
    }

    <!-- Error message -->
    @if (poiState.error()) {
      <div class="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
        <div class="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span>{{ poiState.error() }}</span>
          <button
            (click)="dismissError()"
            class="ml-2 text-red-600 hover:text-red-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class POIDisplayComponent implements OnInit, OnDestroy {
  readonly mapState = inject(MapState);
  readonly poiState = inject(POIState);
  private readonly overpassService = inject(OverpassService);

  private readonly destroy$ = new Subject<void>();
  private poiLayer: L.LayerGroup = L.layerGroup();
  private markerMap = new Map<string, L.Marker>();
  private refreshHandler: ((e: Event) => void) | null = null;

  // Track current zoom level
  private readonly currentZoom = signal<number>(0);

  // Show zoom message when POIs enabled but zoom too low
  readonly showZoomMessage = computed(() => {
    return (
      this.poiState.hasEnabledCategories() &&
      this.currentZoom() < MIN_ZOOM_LEVEL &&
      !this.poiState.isLoading()
    );
  });

  constructor() {
    // React to POI changes and update markers
    effect(() => {
      const pois = this.poiState.pois();
      this.updateMarkers(pois);
    });

    // React to enabled categories changes
    effect(() => {
      const enabled = this.poiState.enabledCategories();
      const map = this.mapState.map();

      if (map && enabled.size > 0 && map.getZoom() >= MIN_ZOOM_LEVEL) {
        // Trigger a query when categories change
        this.queryPOIs();
      } else if (enabled.size === 0) {
        // Clear markers when all categories disabled
        this.clearAllMarkers();
      }
    });
  }

  ngOnInit(): void {
    // Wait for map to be ready
    const checkMap = () => {
      const map = this.mapState.map();
      if (map) {
        this.initializeMapListeners(map);
      } else {
        setTimeout(checkMap, 100);
      }
    };
    checkMap();

    // Listen for refresh events from the layers panel
    this.refreshHandler = () => {
      this.refreshPOIs();
    };
    window.addEventListener('refreshPOIs', this.refreshHandler);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Remove event listener
    if (this.refreshHandler) {
      window.removeEventListener('refreshPOIs', this.refreshHandler);
    }

    // Clean up layer
    const map = this.mapState.map();
    if (map && this.poiLayer) {
      map.removeLayer(this.poiLayer);
    }
  }

  private initializeMapListeners(map: L.Map): void {
    // Add POI layer to map
    this.poiLayer.addTo(map);

    // Update current zoom
    this.currentZoom.set(map.getZoom());

    // Listen for map move events with debounce
    fromEvent(map, 'moveend')
      .pipe(
        debounceTime(MAP_MOVE_DEBOUNCE),
        tap(() => {
          this.currentZoom.set(map.getZoom());
        }),
        filter(() => this.poiState.hasEnabledCategories()),
        filter(() => map.getZoom() >= MIN_ZOOM_LEVEL),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.queryPOIs();
      });

    // Listen for zoom changes to update zoom message
    fromEvent(map, 'zoomend')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentZoom.set(map.getZoom());

        // Clear markers if zoomed out too far
        if (map.getZoom() < MIN_ZOOM_LEVEL) {
          this.clearAllMarkers();
          this.poiState.clearPOIs();
        }
      });
  }

  /**
   * Query POIs for all enabled categories
   */
  queryPOIs(): void {
    const map = this.mapState.map();
    if (!map) return;

    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM_LEVEL) {
      return;
    }

    const enabledIds = this.poiState.enabledCategoryIds();
    if (enabledIds.length === 0) {
      return;
    }

    const bounds = map.getBounds();
    const boundsHash = this.getBoundsHash(map);

    // Skip if bounds haven't changed significantly
    if (boundsHash === this.poiState.lastBoundsHash()) {
      return;
    }

    this.poiState.setLoading(true);
    this.poiState.setError(null);
    this.poiState.setLastBoundsHash(boundsHash);

    this.overpassService
      .queryMultipleCategories(enabledIds, bounds)
      .pipe(
        catchError((error) => {
          this.poiState.setError(error.message || 'Failed to load POIs');
          return of([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((pois) => {
        // Group POIs by category
        const poisByCategory = new Map<string, POIResult[]>();
        enabledIds.forEach((id) => poisByCategory.set(id, []));

        pois.forEach((poi) => {
          const categoryPois = poisByCategory.get(poi.category);
          if (categoryPois) {
            categoryPois.push(poi);
          }
        });

        this.poiState.setPOIsForCategories(poisByCategory);
        this.poiState.setLoading(false);
      });
  }

  /**
   * Force refresh POIs (called from layers panel)
   */
  refreshPOIs(): void {
    this.poiState.setLastBoundsHash(''); // Clear hash to force re-query
    this.queryPOIs();
  }

  dismissError(): void {
    this.poiState.setError(null);
  }

  private getBoundsHash(map: L.Map): string {
    const bounds = map.getBounds();
    const precision = 3;
    return `${bounds.getSouth().toFixed(precision)},${bounds.getWest().toFixed(precision)},${bounds.getNorth().toFixed(precision)},${bounds.getEast().toFixed(precision)}`;
  }

  private updateMarkers(pois: POIResult[]): void {
    const currentIds = new Set(pois.map((poi) => `${poi.osmType}:${poi.id}`));

    // Remove markers that no longer exist
    this.markerMap.forEach((marker, key) => {
      if (!currentIds.has(key)) {
        this.poiLayer.removeLayer(marker);
        this.markerMap.delete(key);
      }
    });

    // Add or update markers
    pois.forEach((poi) => {
      const key = `${poi.osmType}:${poi.id}`;
      if (!this.markerMap.has(key)) {
        const marker = this.createPOIMarker(poi);
        this.poiLayer.addLayer(marker);
        this.markerMap.set(key, marker);
      }
    });
  }

  private createPOIMarker(poi: POIResult): L.Marker {
    const category = this.poiState.getCategory(poi.category);
    const icon = this.createPOIIcon(poi, category);

    const marker = L.marker([poi.lat, poi.lng], { icon });

    // Bind popup with POI details
    const popupContent = this.createPopupContent(poi, category);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'poi-popup',
    });

    return marker;
  }

  private createPOIIcon(poi: POIResult, category?: POICategory): L.DivIcon {
    const emoji = category?.icon ?? '📍';
    const color = category?.color ?? '#6B7280';

    return L.divIcon({
      className: 'custom-poi-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: white;
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        ">${emoji}</div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }

  private createPopupContent(poi: POIResult, category?: POICategory): string {
    const tags = poi.tags;
    let details = '';

    // Opening hours
    if (tags['opening_hours']) {
      details += `<div class="text-xs text-gray-600 mt-1"><strong>Hours:</strong> ${this.escapeHtml(tags['opening_hours'])}</div>`;
    }

    // Website
    if (tags['website']) {
      const url = this.escapeHtml(tags['website']);
      details += `<div class="text-xs text-gray-600 mt-1"><a href="${url}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">Website</a></div>`;
    }

    // Phone
    if (tags['phone']) {
      details += `<div class="text-xs text-gray-600 mt-1"><strong>Phone:</strong> ${this.escapeHtml(tags['phone'])}</div>`;
    }

    // Address
    const address = this.formatAddress(tags);
    if (address) {
      details += `<div class="text-xs text-gray-600 mt-1">${this.escapeHtml(address)}</div>`;
    }

    // Fee info for toilets/camping
    if (tags['fee']) {
      const feeText = tags['fee'] === 'yes' ? 'Fee required' : tags['fee'] === 'no' ? 'Free' : tags['fee'];
      details += `<div class="text-xs text-gray-600 mt-1"><strong>Fee:</strong> ${this.escapeHtml(feeText)}</div>`;
    }

    // Wheelchair accessibility
    if (tags['wheelchair']) {
      const wheelchairIcon = tags['wheelchair'] === 'yes' ? 'Yes' : tags['wheelchair'] === 'limited' ? 'Limited' : 'No';
      details += `<div class="text-xs text-gray-600 mt-1"><strong>Wheelchair:</strong> ${wheelchairIcon}</div>`;
    }

    return `
      <div class="p-2 min-w-[200px]">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-lg">${category?.icon ?? '📍'}</span>
          <span class="font-semibold text-gray-800">${this.escapeHtml(poi.name)}</span>
        </div>
        <div class="text-xs text-gray-500">${this.escapeHtml(category?.name ?? poi.type)}</div>
        ${details}
        <div class="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200">
          ${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}
        </div>
      </div>
    `;
  }

  private formatAddress(tags: Record<string, string>): string {
    const parts: string[] = [];

    if (tags['addr:street']) {
      let streetAddr = tags['addr:street'];
      if (tags['addr:housenumber']) {
        streetAddr += ' ' + tags['addr:housenumber'];
      }
      parts.push(streetAddr);
    }

    if (tags['addr:city']) {
      let cityAddr = '';
      if (tags['addr:postcode']) {
        cityAddr = tags['addr:postcode'] + ' ';
      }
      cityAddr += tags['addr:city'];
      parts.push(cityAddr);
    }

    return parts.join(', ');
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private clearAllMarkers(): void {
    this.poiLayer.clearLayers();
    this.markerMap.clear();
  }
}
