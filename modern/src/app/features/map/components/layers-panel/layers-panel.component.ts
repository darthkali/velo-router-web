import {
  Component,
  inject,
  signal,
  output,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { MapState } from '../../../../state/map.state';
import { POIState } from '../../../../state/poi.state';
import {
  BoundaryService,
  BOUNDARY_COLORS,
} from '../../../../core/services/boundary';

@Component({
  selector: 'app-layers-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Toggle button (always visible) -->
    <button
      (click)="togglePanel()"
      class="absolute top-4 right-4 z-[1001] bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
      [class.hidden]="isOpen()"
      [attr.aria-label]="'Open layers panel'"
      [attr.aria-expanded]="isOpen()">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v.879a2.5 2.5 0 01-.732 1.767l-4.768 4.768v4.586a1.5 1.5 0 01-2.354 1.235l-2-1.333A1.5 1.5 0 017.5 15.277V11.5L2.732 7.146A2.5 2.5 0 012 5.379V4.5z" />
      </svg>
    </button>

    <!-- Panel -->
    <div
      class="absolute top-4 right-4 z-[1001] transition-all duration-300 ease-in-out"
      [class.translate-x-full]="!isOpen()"
      [class.opacity-0]="!isOpen()"
      [class.pointer-events-none]="!isOpen()">
      <div class="bg-white rounded-lg shadow-xl w-80 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <h3 class="font-semibold text-gray-800">Map Layers</h3>
          <button
            (click)="togglePanel()"
            class="p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label="Close layers panel">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Content (scrollable) -->
        <div class="overflow-y-auto flex-1 p-4 space-y-5">
          <!-- Base Layers Section -->
          <section>
            <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clip-rule="evenodd" />
              </svg>
              Base Layers
            </h4>
            <div class="space-y-1">
              @for (layer of mapState.baseLayers(); track layer.id) {
                <label
                  class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm"
                  [class.bg-primary-50]="layer.visible"
                  [class.ring-1]="layer.visible"
                  [class.ring-primary-200]="layer.visible">
                  <input
                    type="radio"
                    name="baseLayer"
                    [value]="layer.id"
                    [checked]="layer.visible"
                    (change)="selectBaseLayer(layer.id)"
                    class="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                  <span class="text-gray-700">{{ layer.name }}</span>
                </label>
              }
            </div>
          </section>

          <!-- Overlay Layers Section -->
          <section>
            <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
              </svg>
              Overlays
            </h4>
            <div class="space-y-2">
              @for (layer of mapState.overlayLayers(); track layer.id) {
                <div>
                  <label
                    class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm"
                    [class.bg-primary-50]="layer.visible"
                    [class.ring-1]="layer.visible"
                    [class.ring-primary-200]="layer.visible">
                    <input
                      type="checkbox"
                      [checked]="layer.visible"
                      (change)="toggleOverlay(layer.id)"
                      class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <span class="text-gray-700">{{ layer.name }}</span>
                  </label>
                  @if (layer.visible) {
                    <div class="flex items-center gap-2 px-2 ml-6 mt-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        [value]="layer.opacity * 100"
                        (input)="onOpacityChange(layer.id, $event)"
                        class="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                      <span class="text-xs text-gray-400 w-8">{{ (layer.opacity * 100) | number:'1.0-0' }}%</span>
                    </div>
                  }
                </div>
              }
            </div>
          </section>

          <!-- Points of Interest Section -->
          <section>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-sm font-medium text-gray-700 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
                Points of Interest
              </h4>
              <button
                (click)="refreshPOIs()"
                [disabled]="poiState.isLoading() || !poiState.hasEnabledCategories()"
                class="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
                title="Refresh POIs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  [class.animate-spin]="poiState.isLoading()"
                  viewBox="0 0 20 20"
                  fill="currentColor">
                  <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>

            <!-- Loading indicator - prominent -->
            @if (poiState.isLoading()) {
              <div class="mb-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <svg class="animate-spin h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-primary-700">Loading POIs...</div>
                    <div class="text-xs text-primary-600">Querying OpenStreetMap</div>
                  </div>
                </div>
              </div>
            }

            <!-- POI count -->
            @if (poiState.poiCount() > 0 && !poiState.isLoading()) {
              <div class="mb-2 text-xs text-gray-500">
                {{ poiState.poiCount() }} POIs found
              </div>
            }

            <!-- POI Categories Grid -->
            <div class="grid grid-cols-2 gap-1.5">
              @for (category of poiState.categoriesWithState(); track category.id) {
                <label
                  class="flex items-center gap-1.5 p-1.5 rounded cursor-pointer hover:bg-gray-50 transition-colors text-xs"
                  [class.bg-primary-50]="category.enabled"
                  [class.ring-1]="category.enabled"
                  [class.ring-primary-200]="category.enabled">
                  <input
                    type="checkbox"
                    [checked]="category.enabled"
                    (change)="togglePOICategory(category.id)"
                    class="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                  <span class="text-sm" [style.color]="category.color">{{ category.icon }}</span>
                  <span class="text-gray-700 truncate flex-1" [title]="category.name">
                    {{ getPOICategoryShortName(category.name) }}
                  </span>
                  @if (category.enabled && category.poiCount > 0) {
                    <span class="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{{ category.poiCount }}</span>
                  }
                </label>
              }
            </div>

            @if (poiState.hasEnabledCategories()) {
              <button
                (click)="clearAllPOIs()"
                class="w-full mt-2 px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                Clear all POIs
              </button>
            }
          </section>

          <!-- Regions Section (search trigger) -->
          <section>
            <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
              </svg>
              Regions
            </h4>

            <button
              (click)="openRegionSearch.emit()"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-lg cursor-pointer text-sm transition-colors group"
              aria-label="Search for regions and boundaries">
              <svg class="h-4 w-4 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span class="flex-1 text-left text-gray-500 group-hover:text-gray-700">
                Search trails, parks...
              </span>
              <kbd class="hidden sm:inline-flex px-1.5 py-0.5 bg-gray-200/70 rounded text-[10px] text-gray-400 font-mono" aria-hidden="true">
                /
              </kbd>
            </button>

            @if (!boundaryService.hasBoundaries()) {
              <p class="mt-2 text-xs text-gray-400 text-center">
                Search once, save as overlay
              </p>
            }
          </section>

          <!-- Active Boundaries Section -->
          @if (boundaryService.hasBoundaries()) {
            <section>
              <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
                Active Boundaries
              </h4>
              <div class="space-y-1.5">
                @for (boundary of boundaryService.activeBoundaries(); track boundary.id) {
                  <div
                    class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 group text-sm"
                    [class.opacity-50]="!boundary.visible && !boundary.loading">
                    <button
                      (click)="cycleBoundaryColor(boundary.id)"
                      class="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-gray-300 hover:ring-gray-400"
                      [style.backgroundColor]="boundary.color"
                      title="Change color">
                    </button>
                    <span class="flex-1 text-gray-700 truncate" [title]="boundary.displayName">
                      {{ boundary.name }}
                    </span>
                    @if (boundary.loading) {
                      <svg class="animate-spin h-3.5 w-3.5 text-primary-500" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    } @else {
                      <button
                        (click)="toggleBoundaryVisibility(boundary.id)"
                        class="p-0.5 text-gray-400 hover:text-gray-600"
                        [title]="boundary.visible ? 'Hide' : 'Show'">
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          @if (boundary.visible) {
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          } @else {
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          }
                        </svg>
                      </button>
                    }
                    <button
                      (click)="fitToBoundary(boundary.id)"
                      class="p-0.5 text-gray-400 hover:text-primary-600"
                      [class.opacity-50]="!boundary.feature"
                      [disabled]="!boundary.feature"
                      title="Zoom to">
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      </svg>
                    </button>
                    <button
                      (click)="removeBoundary(boundary.id)"
                      class="p-0.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                      title="Remove">
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                }
                @if (boundaryService.activeBoundaries().length > 1) {
                  <button
                    (click)="clearAllBoundaries()"
                    class="w-full px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    Clear all boundaries
                  </button>
                }
              </div>
            </section>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #2563eb;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }

      input[type='range']::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #2563eb;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }
    `,
  ],
})
export class LayersPanelComponent implements OnDestroy {
  readonly mapState = inject(MapState);
  readonly poiState = inject(POIState);
  readonly boundaryService = inject(BoundaryService);

  private readonly destroy$ = new Subject<void>();

  readonly isOpen = signal(false);

  // Output event to open the fullscreen region search
  readonly openRegionSearch = output<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePanel(): void {
    this.isOpen.update((open) => !open);
  }

  selectBaseLayer(layerId: string): void {
    this.mapState.switchBaseLayer(layerId);
  }

  toggleOverlay(layerId: string): void {
    this.mapState.toggleOverlayLayer(layerId);
  }

  onOpacityChange(layerId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const opacity = parseInt(input.value, 10) / 100;
    this.mapState.setLayerOpacity(layerId, opacity);
  }

  // Boundary management
  toggleBoundaryVisibility(id: string): void {
    this.boundaryService.toggleBoundaryVisibility(id);
  }

  removeBoundary(id: string): void {
    this.boundaryService.removeBoundary(id);
  }

  clearAllBoundaries(): void {
    this.boundaryService.clearAllBoundaries();
  }

  fitToBoundary(id: string): void {
    const boundary = this.boundaryService.getBoundaryById(id);
    if (boundary?.bounds) {
      const [[south, west], [north, east]] = boundary.bounds;
      this.mapState.fitBounds(
        [[south, west], [north, east]],
        { padding: [50, 50] }
      );
    }
  }

  cycleBoundaryColor(id: string): void {
    const boundary = this.boundaryService.getBoundaryById(id);
    if (boundary) {
      const currentIndex = BOUNDARY_COLORS.indexOf(boundary.color as typeof BOUNDARY_COLORS[number]);
      const nextIndex = (currentIndex + 1) % BOUNDARY_COLORS.length;
      this.boundaryService.setBoundaryColor(id, BOUNDARY_COLORS[nextIndex]);
    }
  }

  // POI methods
  togglePOICategory(categoryId: string): void {
    this.poiState.toggleCategory(categoryId);
  }

  clearAllPOIs(): void {
    this.poiState.disableAllCategories();
    this.poiState.clearPOIs();
  }

  refreshPOIs(): void {
    this.poiState.setLastBoundsHash('');
    window.dispatchEvent(new CustomEvent('refreshPOIs'));
  }

  getPOICategoryShortName(name: string): string {
    const shortNames: Record<string, string> = {
      'Hotels & Accommodation': 'Hotels',
      'Drinking Water': 'Water',
      'Natural Springs': 'Springs',
      'Water Sources': 'Water',
      'Shelters & Huts': 'Shelters',
      'Camping': 'Camping',
      'Restaurants & Cafes': 'Food',
      'Bike Shops & Repair': 'Bikes',
      'Toilets': 'WC',
      'Viewpoints': 'Views',
    };
    return shortNames[name] ?? name;
  }
}
