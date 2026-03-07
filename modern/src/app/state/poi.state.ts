import { Injectable, signal, computed } from '@angular/core';
import { POIResult, POICategory, POI_CATEGORIES } from '../core/services/overpass';

/**
 * State service for managing POI (Points of Interest) display
 *
 * Tracks which POI categories are enabled, stores current POI results,
 * and manages loading state for POI queries.
 */
@Injectable({ providedIn: 'root' })
export class POIState {
  // Set of enabled category IDs
  private readonly _enabledCategories = signal<Set<string>>(new Set());

  // Current POI results keyed by category ID
  private readonly _pois = signal<Map<string, POIResult[]>>(new Map());

  // Loading state
  private readonly _isLoading = signal<boolean>(false);

  // Error state
  private readonly _error = signal<string | null>(null);

  // Last query bounds hash (to detect if we need to re-query)
  private readonly _lastBoundsHash = signal<string>('');

  // Public signals
  readonly enabledCategories = computed(() => this._enabledCategories());
  readonly isLoading = computed(() => this._isLoading());
  readonly error = computed(() => this._error());
  readonly lastBoundsHash = computed(() => this._lastBoundsHash());

  // All POIs as a flat array
  readonly pois = computed(() => {
    const poisMap = this._pois();
    const enabled = this._enabledCategories();
    const result: POIResult[] = [];

    poisMap.forEach((categoryPois, categoryId) => {
      if (enabled.has(categoryId)) {
        result.push(...categoryPois);
      }
    });

    return result;
  });

  // POIs grouped by category
  readonly poisByCategory = computed(() => {
    const poisMap = this._pois();
    const enabled = this._enabledCategories();
    const result = new Map<string, POIResult[]>();

    poisMap.forEach((categoryPois, categoryId) => {
      if (enabled.has(categoryId)) {
        result.set(categoryId, categoryPois);
      }
    });

    return result;
  });

  // Count of total POIs currently displayed
  readonly poiCount = computed(() => this.pois().length);

  // Check if any categories are enabled
  readonly hasEnabledCategories = computed(() => this._enabledCategories().size > 0);

  // Get enabled category IDs as array
  readonly enabledCategoryIds = computed(() => Array.from(this._enabledCategories()));

  // Get all available categories with their enabled state
  readonly categoriesWithState = computed(() => {
    const enabled = this._enabledCategories();
    return POI_CATEGORIES.map((category) => ({
      ...category,
      enabled: enabled.has(category.id),
      poiCount: this._pois().get(category.id)?.length ?? 0,
    }));
  });

  /**
   * Toggle a POI category on/off
   */
  toggleCategory(categoryId: string): void {
    this._enabledCategories.update((current) => {
      const newSet = new Set(current);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }

  /**
   * Enable a POI category
   */
  enableCategory(categoryId: string): void {
    this._enabledCategories.update((current) => {
      const newSet = new Set(current);
      newSet.add(categoryId);
      return newSet;
    });
  }

  /**
   * Disable a POI category
   */
  disableCategory(categoryId: string): void {
    this._enabledCategories.update((current) => {
      const newSet = new Set(current);
      newSet.delete(categoryId);
      return newSet;
    });
  }

  /**
   * Enable multiple categories at once
   */
  enableCategories(categoryIds: string[]): void {
    this._enabledCategories.update((current) => {
      const newSet = new Set(current);
      categoryIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  }

  /**
   * Disable all categories
   */
  disableAllCategories(): void {
    this._enabledCategories.set(new Set());
  }

  /**
   * Check if a category is enabled
   */
  isCategoryEnabled(categoryId: string): boolean {
    return this._enabledCategories().has(categoryId);
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  /**
   * Set error state
   */
  setError(error: string | null): void {
    this._error.set(error);
  }

  /**
   * Update POIs for a specific category
   */
  setPOIsForCategory(categoryId: string, pois: POIResult[]): void {
    this._pois.update((current) => {
      const newMap = new Map(current);
      newMap.set(categoryId, pois);
      return newMap;
    });
  }

  /**
   * Update POIs for multiple categories at once
   */
  setPOIsForCategories(poisByCategory: Map<string, POIResult[]>): void {
    this._pois.update((current) => {
      const newMap = new Map(current);
      poisByCategory.forEach((pois, categoryId) => {
        newMap.set(categoryId, pois);
      });
      return newMap;
    });
  }

  /**
   * Clear POIs for a specific category
   */
  clearCategoryPOIs(categoryId: string): void {
    this._pois.update((current) => {
      const newMap = new Map(current);
      newMap.delete(categoryId);
      return newMap;
    });
  }

  /**
   * Clear all POIs
   */
  clearPOIs(): void {
    this._pois.set(new Map());
    this._error.set(null);
  }

  /**
   * Update the last bounds hash
   */
  setLastBoundsHash(hash: string): void {
    this._lastBoundsHash.set(hash);
  }

  /**
   * Get POI category definition by ID
   */
  getCategory(categoryId: string): POICategory | undefined {
    return POI_CATEGORIES.find((c) => c.id === categoryId);
  }

  /**
   * Get all available categories
   */
  getAllCategories(): POICategory[] {
    return [...POI_CATEGORIES];
  }

  /**
   * Reset all state
   */
  reset(): void {
    this._enabledCategories.set(new Set());
    this._pois.set(new Map());
    this._isLoading.set(false);
    this._error.set(null);
    this._lastBoundsHash.set('');
  }
}
