import {
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { NominatimService, ParsedNominatimResult, getLocationCategory, LocationCategory } from '../../../../core/services/nominatim';
import { MapState } from '../../../../state/map.state';
import { RouteState } from '../../../../state/route.state';

@Component({
  selector: 'app-location-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative" #containerRef>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Location Search
      </label>

      <!-- Search Input -->
      <div class="relative">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <!-- Search Icon -->
          <svg
            class="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>

        <input
          #inputRef
          type="text"
          [ngModel]="searchQuery()"
          (ngModelChange)="onSearchInput($event)"
          (focus)="onFocus()"
          (keydown)="onKeyDown($event)"
          placeholder="Search for a location..."
          class="block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm sm:leading-6 transition-all"
          [class.ring-primary-500]="isOpen()"
          [class.ring-2]="isOpen()"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-expanded]="isOpen() && hasResults()"
          [attr.aria-activedescendant]="activeDescendant()" />

        <!-- Loading Spinner -->
        @if (isLoading()) {
          <div class="absolute inset-y-0 right-8 flex items-center pr-2">
            <svg
              class="animate-spin h-4 w-4 text-primary-500"
              fill="none"
              viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        }

        <!-- Clear Button -->
        @if (searchQuery()) {
          <button
            type="button"
            (click)="clearSearch()"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search">
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        }
      </div>

      <!-- Results Dropdown -->
      @if (isOpen() && (hasResults() || hasError())) {
        <ul
          class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
          role="listbox"
          #dropdownRef>

          <!-- Error State -->
          @if (hasError()) {
            <li class="relative cursor-default select-none py-2 px-3 text-red-600">
              <div class="flex items-center gap-2">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{{ error() }}</span>
              </div>
            </li>
          }

          <!-- Results -->
          @for (result of results(); track result.placeId; let i = $index) {
            <li
              [id]="'search-option-' + i"
              (mousedown)="selectResult(result)"
              (mouseenter)="setActiveIndex(i)"
              class="relative cursor-pointer select-none py-2 pl-3 pr-9 transition-colors"
              [class.bg-primary-50]="activeIndex() === i"
              [class.text-primary-900]="activeIndex() === i"
              [class.hover:bg-gray-50]="activeIndex() !== i"
              role="option"
              [attr.aria-selected]="activeIndex() === i">
              <div class="flex items-start gap-3">
                <!-- Location Type Icon -->
                <span
                  class="flex-shrink-0 mt-0.5 h-5 w-5 flex items-center justify-center rounded-full"
                  [ngClass]="getIconClass(result)">
                  <!-- Location Icon -->
                  <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                  </svg>
                </span>

                <div class="flex-1 min-w-0">
                  <span class="block truncate font-medium">
                    {{ result.name }}
                  </span>
                  <span class="block truncate text-xs text-gray-500">
                    {{ getShortAddress(result) }}
                  </span>
                </div>
              </div>

              <!-- Add as Waypoint Button -->
              @if (activeIndex() === i) {
                <button
                  type="button"
                  (mousedown)="addAsWaypoint(result, $event)"
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-primary-600 hover:text-primary-800"
                  title="Add as waypoint">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              }
            </li>
          }

          <!-- No Results -->
          @if (!hasError() && results().length === 0 && searchQuery().length >= 2) {
            <li class="relative cursor-default select-none py-2 px-3 text-gray-500">
              No locations found
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class LocationSearchComponent implements OnDestroy {
  private readonly nominatimService = inject(NominatimService);
  private readonly mapState = inject(MapState);
  private readonly routeState = inject(RouteState);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  // State signals
  readonly searchQuery = signal('');
  readonly results = signal<ParsedNominatimResult[]>([]);
  readonly isLoading = signal(false);
  readonly isOpen = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeIndex = signal(-1);

  // Computed signals
  readonly hasResults = computed(() => this.results().length > 0);
  readonly hasError = computed(() => this.error() !== null);
  readonly activeDescendant = computed(() =>
    this.activeIndex() >= 0 ? `search-option-${this.activeIndex()}` : null
  );

  constructor() {
    this.setupSearchSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setup debounced search subscription
   */
  private setupSearchSubscription(): void {
    this.searchSubject$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.length < 2) {
            this.results.set([]);
            this.isLoading.set(false);
            return of([]);
          }

          this.isLoading.set(true);
          this.error.set(null);

          return this.nominatimService.search(query).pipe(
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
      });
  }

  /**
   * Handle search input changes
   */
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject$.next(value);
    this.isOpen.set(true);
  }

  /**
   * Handle input focus
   */
  onFocus(): void {
    if (this.results().length > 0 || this.searchQuery().length >= 2) {
      this.isOpen.set(true);
    }
  }

  /**
   * Handle keyboard navigation
   */
  onKeyDown(event: KeyboardEvent): void {
    const resultsLength = this.results().length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen()) {
          this.isOpen.set(true);
        }
        this.activeIndex.update((i) =>
          i < resultsLength - 1 ? i + 1 : 0
        );
        this.scrollActiveIntoView();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((i) =>
          i > 0 ? i - 1 : resultsLength - 1
        );
        this.scrollActiveIntoView();
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
        this.closeDropdown();
        this.inputRef?.nativeElement?.blur();
        break;

      case 'Tab':
        this.closeDropdown();
        break;
    }
  }

  /**
   * Handle clicks outside the component
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.containerRef?.nativeElement?.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  /**
   * Select a search result - center map on location
   */
  selectResult(result: ParsedNominatimResult): void {
    this.searchQuery.set(result.name);
    this.closeDropdown();

    // Center map on the selected location
    const zoom = this.getZoomForCategory(getLocationCategory(result));
    this.mapState.setView([result.lat, result.lon], zoom);
  }

  /**
   * Add result as a waypoint
   */
  addAsWaypoint(result: ParsedNominatimResult, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    this.routeState.addWaypoint(
      { lat: result.lat, lng: result.lon },
      result.name
    );

    // Also center the map
    const zoom = Math.max(this.mapState.zoom(), 14);
    this.mapState.setView([result.lat, result.lon], zoom);

    this.searchQuery.set('');
    this.closeDropdown();
  }

  /**
   * Clear the search input
   */
  clearSearch(): void {
    this.searchQuery.set('');
    this.results.set([]);
    this.error.set(null);
    this.activeIndex.set(-1);
    this.inputRef?.nativeElement?.focus();
  }

  /**
   * Set active index on mouse enter
   */
  setActiveIndex(index: number): void {
    this.activeIndex.set(index);
  }

  /**
   * Get the location category for a result
   */
  getCategory(result: ParsedNominatimResult): LocationCategory {
    return getLocationCategory(result);
  }

  /**
   * Get icon background class based on category
   */
  getIconClass(result: ParsedNominatimResult): string {
    const category = getLocationCategory(result);
    const baseClass = 'text-white';

    switch (category) {
      case 'city':
        return `${baseClass} bg-blue-600`;
      case 'town':
        return `${baseClass} bg-blue-500`;
      case 'village':
        return `${baseClass} bg-blue-400`;
      case 'street':
        return `${baseClass} bg-gray-500`;
      case 'building':
        return `${baseClass} bg-amber-500`;
      case 'poi':
        return `${baseClass} bg-purple-500`;
      case 'natural':
        return `${baseClass} bg-green-500`;
      default:
        return `${baseClass} bg-gray-400`;
    }
  }

  /**
   * Get shortened address (remove the first part which is the name)
   */
  getShortAddress(result: ParsedNominatimResult): string {
    const parts = result.displayName.split(',').slice(1, 4);
    return parts.map((p) => p.trim()).join(', ');
  }

  /**
   * Get appropriate zoom level for location category
   */
  private getZoomForCategory(category: LocationCategory): number {
    switch (category) {
      case 'city':
        return 12;
      case 'town':
        return 13;
      case 'village':
        return 14;
      case 'street':
        return 16;
      case 'building':
      case 'poi':
        return 17;
      case 'natural':
        return 14;
      default:
        return 14;
    }
  }

  /**
   * Close the dropdown
   */
  private closeDropdown(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  /**
   * Scroll the active item into view
   */
  private scrollActiveIntoView(): void {
    const activeId = `search-option-${this.activeIndex()}`;
    const element = document.getElementById(activeId);
    element?.scrollIntoView({ block: 'nearest' });
  }
}
