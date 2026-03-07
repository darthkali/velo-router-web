import {
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
  OnInit,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  catchError,
} from 'rxjs/operators';
import * as L from 'leaflet';
import { MapState } from '../../../../state/map.state';
import {
  BoundaryService,
  BoundarySearchResult,
} from '../../../../core/services/boundary';

/**
 * Fullscreen region search component
 *
 * Features:
 * - Fullscreen overlay for focused search experience
 * - Split layout: results list + preview map
 * - Fast text search (<1 sec results)
 * - Hover shows both thumbnail AND main map preview
 * - Click selects and closes search
 */
@Component({
  selector: 'app-region-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Fullscreen search overlay (trigger is in layers-panel) -->
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-[2000] bg-white flex flex-col"
        (keydown.escape)="closeSearch()">

        <!-- Header with search input -->
        <header class="flex-shrink-0 border-b border-gray-200 bg-white">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center gap-4 py-4">
              <!-- Back button -->
              <button
                (click)="closeSearch()"
                class="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close search">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>

              <!-- Search input -->
              <div class="flex-1 relative">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  @if (isLoading()) {
                    <svg class="animate-spin h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  } @else {
                    <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  }
                </div>
                <input
                  #searchInput
                  type="text"
                  [ngModel]="searchQuery()"
                  (ngModelChange)="onSearchInput($event)"
                  (keydown)="onKeyDown($event)"
                  placeholder="Rennsteig, Schwarzwald, Nationalpark Harz..."
                  class="block w-full pl-12 pr-12 py-3 text-lg bg-gray-50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white placeholder:text-gray-400 transition-all"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false" />
                @if (searchQuery()) {
                  <button
                    (click)="clearSearch()"
                    class="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                    aria-label="Clear search">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                }
              </div>
            </div>
          </div>
        </header>

        <!-- Main content: split layout -->
        <main class="flex-1 flex overflow-hidden">
          <!-- Results list (left side) -->
          <div class="w-full lg:w-1/2 xl:w-2/5 overflow-y-auto border-r border-gray-200 bg-white">
            @if (hasError()) {
              <div class="p-6 text-center">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                  <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p class="text-red-600 font-medium">{{ error() }}</p>
                <p class="text-gray-500 text-sm mt-1">Try a different search term</p>
              </div>
            }

            @if (showEmptyState()) {
              <div class="p-8 text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900">No results found</h3>
                <p class="text-gray-500 mt-1">No regions found for "{{ searchQuery() }}"</p>
                <p class="text-gray-400 text-sm mt-2">Try searching for hiking trails, national parks, or cities</p>
              </div>
            }

            @if (showInitialState()) {
              <div class="p-8 text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-4">
                  <svg class="h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900">Search regions</h3>
                <p class="text-gray-500 mt-1">Find trails, parks, and boundaries to explore</p>
                <div class="mt-6 flex flex-wrap justify-center gap-2">
                  @for (suggestion of suggestions; track suggestion) {
                    <button
                      (click)="searchFor(suggestion)"
                      class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors">
                      {{ suggestion }}
                    </button>
                  }
                </div>
              </div>
            }

            @if (hasResults()) {
              <div class="divide-y divide-gray-100">
                @for (result of results(); track result.placeId; let i = $index) {
                  <div
                    (click)="selectResult(result)"
                    (mouseenter)="onResultHover(result, i)"
                    class="p-4 cursor-pointer transition-colors"
                    [class.bg-primary-50]="activeIndex() === i"
                    [class.hover:bg-gray-50]="activeIndex() !== i"
                    role="option"
                    [attr.aria-selected]="activeIndex() === i">

                    <div class="flex items-start gap-4">
                      <!-- Mini map preview -->
                      <div
                        class="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200 relative">
                        <div
                          #miniMapContainer
                          class="w-full h-full"
                          [attr.data-index]="i">
                        </div>
                        @if (previewLoadingIndex() === i) {
                          <div class="absolute inset-0 bg-white/70 flex items-center justify-center">
                            <svg class="animate-spin h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          </div>
                        }
                      </div>

                      <!-- Result info -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <h4 class="font-semibold text-gray-900 truncate">{{ result.name }}</h4>
                        </div>

                        <div class="flex items-center gap-2 mb-2">
                          <span
                            class="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                            [ngClass]="getCategoryClass(result)">
                            {{ getCategoryLabel(result) }}
                          </span>
                          <span class="text-xs text-gray-400 uppercase">{{ result.osmType }}</span>
                        </div>

                        <p class="text-sm text-gray-500 line-clamp-2">
                          {{ getDisplayContext(result) }}
                        </p>
                      </div>

                      <!-- Select button -->
                      <button
                        (click)="selectResult(result); $event.stopPropagation()"
                        class="flex-shrink-0 p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                        title="Add to map">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- Results count -->
              <div class="p-4 bg-gray-50 border-t border-gray-100 text-center">
                <span class="text-sm text-gray-500">
                  {{ results().length }} result{{ results().length !== 1 ? 's' : '' }} found
                </span>
              </div>
            }
          </div>

          <!-- Preview map (right side, hidden on mobile) -->
          <div class="hidden lg:block lg:w-1/2 xl:w-3/5 bg-gray-100 relative">
            <div #previewMapContainer class="absolute inset-0"></div>

            @if (!hoveredResult()) {
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="text-center">
                  <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                  <p class="mt-2 text-gray-400">Hover over a result to preview</p>
                </div>
              </div>
            }

            @if (hoveredResult()) {
              <div class="absolute top-4 left-4 right-4 z-10">
                <div class="bg-white rounded-lg shadow-lg p-3 flex items-center gap-3">
                  <div
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    [style.backgroundColor]="'#f97316'">
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-gray-900 truncate">{{ hoveredResult()?.name }}</h4>
                    <p class="text-xs text-gray-500 truncate">{{ hoveredResult()?.displayName }}</p>
                  </div>
                </div>
              </div>
            }
          </div>
        </main>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
})
export class RegionSearchComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly mapState = inject(MapState);
  private readonly boundaryService = inject(BoundaryService);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewMapContainer') previewMapContainer!: ElementRef<HTMLDivElement>;

  // Preview map instance
  private previewMap: L.Map | null = null;
  private previewLayer: L.GeoJSON | null = null;
  private boundsLayer: L.Rectangle | null = null;

  // Mini map instances for result cards
  private miniMaps = new Map<number, L.Map>();

  // State
  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly results = signal<BoundarySearchResult[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeIndex = signal(-1);
  readonly hoveredResult = signal<BoundarySearchResult | null>(null);
  readonly previewLoadingIndex = signal<number | null>(null);

  // Suggestions for initial state
  readonly suggestions = ['Rennsteig', 'Schwarzwald', 'Nationalpark Harz', 'Rheinsteig', 'Eifel'];

  // Computed
  readonly hasResults = computed(() => this.results().length > 0);
  readonly hasError = computed(() => this.error() !== null);
  readonly showEmptyState = computed(() =>
    !this.isLoading() &&
    !this.hasError() &&
    !this.hasResults() &&
    this.searchQuery().length >= 2
  );
  readonly showInitialState = computed(() =>
    !this.isLoading() &&
    !this.hasError() &&
    !this.hasResults() &&
    this.searchQuery().length < 2
  );

  ngOnInit(): void {
    this.setupSearchSubscription();
  }

  ngAfterViewInit(): void {
    // Preview map will be initialized when search opens
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupPreviewMap();
    this.cleanupMiniMaps();
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeyDown(event: KeyboardEvent): void {
    // Global '/' shortcut to open search
    if (event.key === '/' && !this.isOpen() && !this.isInputFocused()) {
      event.preventDefault();
      this.openSearch();
    }
  }

  private isInputFocused(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLInputElement ||
           active instanceof HTMLTextAreaElement;
  }

  private setupSearchSubscription(): void {
    this.searchSubject$
      .pipe(
        debounceTime(150), // Fast debounce for quick results
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.length < 2) {
            this.results.set([]);
            this.isLoading.set(false);
            return of([]);
          }

          this.isLoading.set(true);
          this.error.set(null);

          return this.boundaryService.searchBoundaries(query).pipe(
            catchError((err) => {
              this.error.set(err.message || 'Search failed');
              return of([]);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.results.set(results);
        this.isLoading.set(false);
        this.activeIndex.set(results.length > 0 ? 0 : -1);

        // Update mini maps after render
        setTimeout(() => this.renderMiniMaps(), 50);
      });
  }

  openSearch(): void {
    this.isOpen.set(true);
    // Focus input after animation
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
      this.initPreviewMap();
    }, 100);
  }

  closeSearch(): void {
    this.isOpen.set(false);
    this.boundaryService.clearPreview();
    this.hoveredResult.set(null);
    this.cleanupPreviewMap();
    this.cleanupMiniMaps();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject$.next(value);
  }

  searchFor(term: string): void {
    this.searchQuery.set(term);
    this.searchSubject$.next(term);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.results.set([]);
    this.error.set(null);
    this.searchInput?.nativeElement?.focus();
  }

  onKeyDown(event: KeyboardEvent): void {
    const resultsLength = this.results().length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((i) => (i < resultsLength - 1 ? i + 1 : 0));
        this.previewActiveResult();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((i) => (i > 0 ? i - 1 : resultsLength - 1));
        this.previewActiveResult();
        break;

      case 'Enter':
        event.preventDefault();
        const index = this.activeIndex();
        if (index >= 0 && index < resultsLength) {
          this.selectResult(this.results()[index]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.closeSearch();
        break;
    }
  }

  private previewActiveResult(): void {
    const index = this.activeIndex();
    const results = this.results();
    if (index >= 0 && index < results.length) {
      this.onResultHover(results[index], index);
    }
  }

  onResultHover(result: BoundarySearchResult, index: number): void {
    this.activeIndex.set(index);
    this.hoveredResult.set(result);
    this.showPreviewOnMap(result, index);
  }

  private showPreviewOnMap(result: BoundarySearchResult, index: number): void {
    if (!this.previewMap) return;

    // Clear existing layers
    if (this.previewLayer) {
      this.previewMap.removeLayer(this.previewLayer);
      this.previewLayer = null;
    }
    if (this.boundsLayer) {
      this.previewMap.removeLayer(this.boundsLayer);
      this.boundsLayer = null;
    }

    // Show bounding box immediately
    if (result.boundingBox && result.boundingBox.some(v => v !== 0)) {
      const [south, north, west, east] = result.boundingBox;
      const bounds = L.latLngBounds([[south, west], [north, east]]);

      this.boundsLayer = L.rectangle(bounds, {
        color: '#f97316',
        weight: 2,
        fillOpacity: 0.1,
        dashArray: '6, 4',
      }).addTo(this.previewMap);

      this.previewMap.fitBounds(bounds, { padding: [20, 20], animate: true });
    }

    // Also show on main map
    this.boundaryService.showBoundsPreview(result);

    // If geometry available from Nominatim, show it
    if (result.geojson) {
      this.renderGeometry(result.geojson, result.name);
      this.boundaryService.showPreview(result);
    } else {
      // Load geometry in background
      this.previewLoadingIndex.set(index);
      this.boundaryService.getBoundaryGeometry(result.osmId, result.osmType)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (feature) => {
            // Only render if still on same result
            if (this.activeIndex() === index) {
              this.renderGeometry(feature.geometry, result.name);
              this.boundaryService.showPreview(result);
            }
            this.previewLoadingIndex.set(null);
          },
          error: () => {
            this.previewLoadingIndex.set(null);
          }
        });
    }
  }

  private renderGeometry(geometry: GeoJSON.Geometry, name: string): void {
    if (!this.previewMap) return;

    // Remove bounding box since we have real geometry now
    if (this.boundsLayer) {
      this.previewMap.removeLayer(this.boundsLayer);
      this.boundsLayer = null;
    }

    if (this.previewLayer) {
      this.previewMap.removeLayer(this.previewLayer);
    }

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { name },
      geometry,
    };

    const geometryType = geometry.type;
    const style: L.PathOptions = (geometryType === 'LineString' || geometryType === 'MultiLineString')
      ? { color: '#f97316', weight: 4, opacity: 0.9 }
      : { color: '#f97316', weight: 2, opacity: 0.9, fillColor: '#f97316', fillOpacity: 0.2 };

    this.previewLayer = L.geoJSON(feature, { style: () => style }).addTo(this.previewMap);

    // Fit to geometry bounds
    const bounds = this.previewLayer.getBounds();
    if (bounds.isValid()) {
      this.previewMap.fitBounds(bounds, { padding: [20, 20], animate: true });
    }
  }

  selectResult(result: BoundarySearchResult): void {
    this.closeSearch();

    // Add boundary to main map
    this.boundaryService.addBoundary(result).subscribe({
      next: (boundary) => {
        // Zoom main map to boundary if bounds are available
        if (boundary.bounds) {
          const [[south, west], [north, east]] = boundary.bounds;
          this.mapState.fitBounds(
            [[south, west], [north, east]],
            { padding: [50, 50] }
          );
        }
      },
      error: (err) => {
        console.error('Failed to add boundary:', err);
      },
    });
  }

  // Mini maps for result cards
  private renderMiniMaps(): void {
    this.cleanupMiniMaps();

    const results = this.results();
    const containers = document.querySelectorAll('[data-index]');

    containers.forEach((container) => {
      const index = parseInt(container.getAttribute('data-index') || '0', 10);
      const result = results[index];

      if (result && result.boundingBox && result.boundingBox.some(v => v !== 0)) {
        const [south, north, west, east] = result.boundingBox;
        const center = L.latLng((south + north) / 2, (west + east) / 2);

        // Calculate zoom from bounds
        const latDiff = north - south;
        const lonDiff = east - west;
        const maxDiff = Math.max(latDiff, lonDiff);
        const zoom = Math.min(10, Math.max(3, Math.floor(8 - Math.log2(maxDiff))));

        try {
          const miniMap = L.map(container as HTMLElement, {
            center,
            zoom,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            keyboard: false,
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(miniMap);

          // Draw bounding box
          const bounds = L.latLngBounds([[south, west], [north, east]]);
          L.rectangle(bounds, {
            color: this.getCategoryColor(result),
            weight: 2,
            fillOpacity: 0.2,
          }).addTo(miniMap);

          this.miniMaps.set(index, miniMap);
        } catch {
          // Container might not be ready
        }
      }
    });
  }

  private cleanupMiniMaps(): void {
    this.miniMaps.forEach((map) => {
      try {
        map.remove();
      } catch {
        // Ignore cleanup errors
      }
    });
    this.miniMaps.clear();
  }

  // Preview map initialization
  private initPreviewMap(): void {
    if (this.previewMap || !this.previewMapContainer?.nativeElement) return;

    // Wait for container to be ready
    setTimeout(() => {
      if (!this.previewMapContainer?.nativeElement) return;

      this.previewMap = L.map(this.previewMapContainer.nativeElement, {
        center: [51.0, 10.0], // Germany center
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(this.previewMap);
    }, 50);
  }

  private cleanupPreviewMap(): void {
    if (this.previewMap) {
      try {
        this.previewMap.remove();
      } catch {
        // Ignore cleanup errors
      }
      this.previewMap = null;
      this.previewLayer = null;
      this.boundsLayer = null;
    }
  }

  // Helper methods
  getCategoryLabel(result: BoundarySearchResult): string {
    const labels: Record<string, string> = {
      administrative: 'Region',
      protected_area: 'Park',
      route: 'Trail',
      natural: 'Nature',
      other: result.type || 'Place',
    };
    return labels[result.category] || result.type || 'Place';
  }

  getCategoryClass(result: BoundarySearchResult): string {
    const classes: Record<string, string> = {
      administrative: 'bg-blue-100 text-blue-700',
      protected_area: 'bg-green-100 text-green-700',
      route: 'bg-orange-100 text-orange-700',
      natural: 'bg-emerald-100 text-emerald-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return classes[result.category] || 'bg-gray-100 text-gray-700';
  }

  getCategoryColor(result: BoundarySearchResult): string {
    const colors: Record<string, string> = {
      administrative: '#3b82f6',
      protected_area: '#22c55e',
      route: '#f97316',
      natural: '#10b981',
      other: '#6b7280',
    };
    return colors[result.category] || '#6b7280';
  }

  getDisplayContext(result: BoundarySearchResult): string {
    const parts = result.displayName.split(',').slice(1, 4);
    return parts.map((p) => p.trim()).join(', ') || result.displayName;
  }
}
