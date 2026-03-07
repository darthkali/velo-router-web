import { Injectable, signal, computed } from '@angular/core';
import { Waypoint, RouteSegment, LatLng, DEFAULT_PROFILES, ProfileInfo } from '../core/services/brouter/brouter.types';

/**
 * Serializable snapshot of route state for saving/loading
 */
export interface RouteSnapshot {
  waypoints: Array<{
    id: string;
    lat: number;
    lng: number;
    name?: string;
    type: 'start' | 'via' | 'end';
  }>;
  profile: string;
  alternativeIndex: number;
}

/**
 * Smart segment key generation for tracking segment identity
 */
function segmentKey(from: Waypoint, to: Waypoint): string {
  return `${from.id}->${to.id}`;
}

@Injectable({ providedIn: 'root' })
export class RouteState {
  // Core signals
  readonly waypoints = signal<Waypoint[]>([]);
  readonly segments = signal<RouteSegment[]>([]);
  private readonly _selectedProfile = signal<string>('trekking');
  readonly selectedProfile = this._selectedProfile.asReadonly();
  readonly alternativeIndex = signal<number>(0);
  readonly isCalculating = signal<boolean>(false);

  // Available profiles
  readonly availableProfiles = signal<ProfileInfo[]>(DEFAULT_PROFILES);

  constructor() {
    // Restore last profile from localStorage
    if (typeof localStorage !== 'undefined') {
      const savedProfile = localStorage.getItem('velo-router-profile');
      if (savedProfile && this.availableProfiles().some(p => p.id === savedProfile)) {
        this._selectedProfile.set(savedProfile);
      }
    }
  }

  // Track segment versions to prevent stale updates
  private segmentVersions = new Map<string, number>();
  private currentVersion = 0;

  // Computed values
  readonly hasRoute = computed(() =>
    this.segments().some((s) => s.geojson !== null)
  );

  readonly waypointCount = computed(() => this.waypoints().length);

  readonly totalDistance = computed(() => {
    return this.segments()
      .filter((s) => s.geojson && !s.loading && !s.error)
      .reduce((sum, s) => {
        const trackLength = s.geojson?.properties?.['track-length'];
        const value = typeof trackLength === 'string' ? parseFloat(trackLength) : (trackLength ?? 0);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);
  });

  readonly totalAscent = computed(() => {
    return this.segments()
      .filter((s) => s.geojson && !s.loading && !s.error)
      .reduce((sum, s) => {
        const ascent = s.geojson?.properties?.['filtered ascend'];
        const value = typeof ascent === 'string' ? parseFloat(ascent) : (ascent ?? 0);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);
  });

  readonly totalTime = computed(() => {
    return this.segments()
      .filter((s) => s.geojson && !s.loading && !s.error)
      .reduce((sum, s) => {
        const time = s.geojson?.properties?.['total-time'];
        const value = typeof time === 'string' ? parseFloat(time) : (time ?? 0);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);
  });

  readonly formattedDistance = computed(() => {
    const meters = this.totalDistance();
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  });

  readonly formattedTime = computed(() => {
    const seconds = this.totalTime();
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  });

  readonly formattedAscent = computed(() => {
    return `${Math.round(this.totalAscent())} m`;
  });

  // Actions
  addWaypoint(latlng: LatLng, name?: string): void {
    const newWaypoint: Waypoint = {
      id: crypto.randomUUID(),
      lat: latlng.lat,
      lng: latlng.lng,
      name,
      type: this.waypointCount() === 0 ? 'start' : 'via',
    };

    this.waypoints.update((wps) => {
      const updated = [...wps, newWaypoint];
      // Update types
      if (updated.length >= 2) {
        updated[updated.length - 1].type = 'end';
        if (updated.length > 2) {
          updated[updated.length - 2].type = 'via';
        }
      }
      return updated;
    });

    // Only add the new segment (from previous last waypoint to new waypoint)
    this.addLastSegment();
  }

  removeWaypoint(id: string): void {
    const wps = this.waypoints();
    const removeIndex = wps.findIndex((w) => w.id === id);
    if (removeIndex === -1) return;

    this.waypoints.update((wps) => {
      const filtered = wps.filter((w) => w.id !== id);
      // Update types
      if (filtered.length >= 1) {
        filtered[0].type = 'start';
      }
      if (filtered.length >= 2) {
        filtered[filtered.length - 1].type = 'end';
      }
      return filtered;
    });

    // Smart segment update: merge adjacent segments
    this.removeWaypointSegments(removeIndex);
  }

  updateWaypointPosition(id: string, latlng: LatLng): void {
    const wps = this.waypoints();
    const waypointIndex = wps.findIndex((w) => w.id === id);
    if (waypointIndex === -1) return;

    this.waypoints.update((wps) =>
      wps.map((w) =>
        w.id === id ? { ...w, lat: latlng.lat, lng: latlng.lng } : w
      )
    );

    // Only invalidate segments adjacent to the moved waypoint
    this.invalidateAdjacentSegments(waypointIndex);
  }

  moveWaypoint(fromIndex: number, toIndex: number): void {
    this.waypoints.update((wps) => {
      const updated = [...wps];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      // Update types
      updated.forEach((wp, i) => {
        if (i === 0) wp.type = 'start';
        else if (i === updated.length - 1) wp.type = 'end';
        else wp.type = 'via';
      });

      return updated;
    });

    // Full rebuild needed for reorder
    this.rebuildAllSegments();
  }

  /**
   * Insert a waypoint at a specific index (for inserting via-points on route click)
   */
  insertWaypointAt(index: number, latlng: LatLng, name?: string): void {
    const wps = this.waypoints();

    // Clamp index to valid range
    const insertIndex = Math.max(0, Math.min(index, wps.length));

    const newWaypoint: Waypoint = {
      id: crypto.randomUUID(),
      lat: latlng.lat,
      lng: latlng.lng,
      name,
      type: 'via',
    };

    this.waypoints.update((wps) => {
      const updated = [...wps];
      updated.splice(insertIndex, 0, newWaypoint);

      // Update types
      updated.forEach((wp, i) => {
        if (i === 0) wp.type = 'start';
        else if (i === updated.length - 1) wp.type = 'end';
        else wp.type = 'via';
      });

      return updated;
    });

    // Rebuild segments around the inserted waypoint
    this.rebuildSegmentsAroundIndex(insertIndex);
  }

  /**
   * Rebuild segments around an inserted waypoint
   * Keeps existing segments that are not affected
   */
  private rebuildSegmentsAroundIndex(insertedIndex: number): void {
    const wps = this.waypoints();
    if (wps.length < 2) {
      this.segments.set([]);
      return;
    }

    this.segments.update((segs) => {
      const newSegments: RouteSegment[] = [];

      for (let i = 0; i < wps.length - 1; i++) {
        const from = wps[i];
        const to = wps[i + 1];
        const key = segmentKey(from, to);

        // The segment before the insertion point (index === insertedIndex - 1)
        // and the segment after (index === insertedIndex) need recalculation
        const needsRecalc = i === insertedIndex - 1 || i === insertedIndex;

        if (needsRecalc) {
          this.currentVersion++;
          this.segmentVersions.set(key, this.currentVersion);
          newSegments.push({
            from,
            to,
            geojson: null,
            loading: true,
          });
        } else {
          // Try to reuse existing segment
          // Segments before insertedIndex-1 keep their original index
          // Segments after insertedIndex use index-1 (shifted by one)
          const oldIndex = i < insertedIndex - 1 ? i : i - 1;
          const existingSegment = segs[oldIndex];

          if (existingSegment &&
              existingSegment.from.id === from.id &&
              existingSegment.to.id === to.id &&
              existingSegment.geojson) {
            newSegments.push(existingSegment);
          } else {
            this.currentVersion++;
            this.segmentVersions.set(key, this.currentVersion);
            newSegments.push({
              from,
              to,
              geojson: null,
              loading: true,
            });
          }
        }
      }

      return newSegments;
    });
  }

  setProfile(profileId: string): void {
    this._selectedProfile.set(profileId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('velo-router-profile', profileId);
    }
    this.recalculateAllSegments();
  }

  setAlternative(index: number): void {
    this.alternativeIndex.set(index);
    this.recalculateAllSegments();
  }

  /**
   * Remove the last waypoint (Undo functionality)
   */
  removeLastWaypoint(): void {
    const wps = this.waypoints();
    if (wps.length === 0) return;

    const lastWaypoint = wps[wps.length - 1];
    this.removeWaypoint(lastWaypoint.id);
  }

  /**
   * Add multiple waypoints at once (for import)
   */
  addWaypoints(points: LatLng[]): void {
    if (points.length === 0) return;

    // Clear existing route first
    this.clearRoute();

    // Add all waypoints
    points.forEach((point, index) => {
      const type: 'start' | 'via' | 'end' =
        index === 0 ? 'start' :
        index === points.length - 1 ? 'end' : 'via';

      const waypoint: Waypoint = {
        id: crypto.randomUUID(),
        lat: point.lat,
        lng: point.lng,
        type,
      };

      this.waypoints.update((wps) => [...wps, waypoint]);
    });

    // Build all segments
    this.rebuildAllSegments();
  }

  /**
   * Check if undo is possible
   */
  readonly canUndo = computed(() => this.waypointCount() > 0);

  /**
   * Update segment result with version check to prevent stale updates
   */
  updateSegmentResult(
    index: number,
    geojson: GeoJSON.Feature<GeoJSON.LineString> | null,
    error?: string,
    version?: number
  ): void {
    this.segments.update((segs) => {
      if (index < 0 || index >= segs.length) return segs;

      const segment = segs[index];
      const key = segmentKey(segment.from, segment.to);
      const currentVersion = this.segmentVersions.get(key) || 0;

      // Reject stale updates (version mismatch means segment was invalidated)
      if (version !== undefined && version < currentVersion) {
        console.log(`Rejecting stale segment update for index ${index} (version ${version} < ${currentVersion})`);
        return segs;
      }

      return segs.map((s, i) =>
        i === index
          ? { ...s, geojson, loading: false, error }
          : s
      );
    });
  }

  setSegmentLoading(index: number, loading: boolean): void {
    this.segments.update((segs) =>
      segs.map((s, i) => (i === index ? { ...s, loading } : s))
    );
  }

  /**
   * Get current version for a segment (used by routing service)
   */
  getSegmentVersion(index: number): number {
    const segs = this.segments();
    if (index < 0 || index >= segs.length) return 0;
    const segment = segs[index];
    const key = segmentKey(segment.from, segment.to);
    return this.segmentVersions.get(key) || 0;
  }

  clearRoute(): void {
    this.waypoints.set([]);
    this.segments.set([]);
    this.segmentVersions.clear();
  }

  reverseRoute(): void {
    this.waypoints.update((wps) => {
      const reversed = [...wps].reverse();
      reversed.forEach((wp, i) => {
        if (i === 0) wp.type = 'start';
        else if (i === reversed.length - 1) wp.type = 'end';
        else wp.type = 'via';
      });
      return reversed;
    });

    // Full rebuild needed for reverse
    this.rebuildAllSegments();
  }

  /**
   * Get a serializable snapshot of the current route state
   * Used for saving to .velo files
   */
  getSnapshot(): RouteSnapshot {
    return {
      waypoints: this.waypoints().map((wp) => ({
        id: wp.id,
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        type: wp.type ?? 'via',
      })),
      profile: this.selectedProfile(),
      alternativeIndex: this.alternativeIndex(),
    };
  }

  /**
   * Load route state from a snapshot
   * Used when opening .velo files
   */
  loadSnapshot(snapshot: RouteSnapshot): void {
    // Clear existing route
    this.clearRoute();

    // Set profile first (before adding waypoints, which triggers routing)
    if (snapshot.profile) {
      this._selectedProfile.set(snapshot.profile);
    }

    // Set alternative index
    if (snapshot.alternativeIndex !== undefined) {
      this.alternativeIndex.set(snapshot.alternativeIndex);
    }

    // Add waypoints
    if (snapshot.waypoints && snapshot.waypoints.length > 0) {
      const waypoints: Waypoint[] = snapshot.waypoints.map((wp, index) => ({
        id: wp.id || crypto.randomUUID(),
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        type: wp.type || (
          index === 0 ? 'start' :
          index === snapshot.waypoints.length - 1 ? 'end' : 'via'
        ),
      }));

      this.waypoints.set(waypoints);
      this.rebuildAllSegments();
    }
  }

  /**
   * Compute a hash of the current state for dirty detection
   */
  computeStateHash(): string {
    const snapshot = this.getSnapshot();
    const data = JSON.stringify({
      waypoints: snapshot.waypoints.map((w) => ({
        lat: w.lat.toFixed(6),
        lng: w.lng.toFixed(6),
        name: w.name,
      })),
      profile: snapshot.profile,
      alternativeIndex: snapshot.alternativeIndex,
    });

    // Simple djb2 hash
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash) + data.charCodeAt(i);
    }
    return hash.toString(36);
  }

  /**
   * Only add segment from second-to-last waypoint to new last waypoint
   * Preserves all existing calculated segments
   */
  private addLastSegment(): void {
    const wps = this.waypoints();
    if (wps.length < 2) {
      this.segments.set([]);
      return;
    }

    const fromWp = wps[wps.length - 2];
    const toWp = wps[wps.length - 1];
    const key = segmentKey(fromWp, toWp);

    this.currentVersion++;
    this.segmentVersions.set(key, this.currentVersion);

    const newSegment: RouteSegment = {
      from: fromWp,
      to: toWp,
      geojson: null,
      loading: true,
    };

    this.segments.update((segs) => [...segs, newSegment]);
  }

  /**
   * Remove segments when a waypoint is deleted
   * Creates a new segment to bridge the gap if needed
   */
  private removeWaypointSegments(removedIndex: number): void {
    const wps = this.waypoints();

    if (wps.length < 2) {
      this.segments.set([]);
      return;
    }

    this.segments.update((segs) => {
      const newSegments: RouteSegment[] = [];

      // Rebuild segments based on new waypoint list
      for (let i = 0; i < wps.length - 1; i++) {
        const from = wps[i];
        const to = wps[i + 1];
        const key = segmentKey(from, to);

        // Check if this segment existed before
        const existingSegment = segs.find(
          (s) => s.from.id === from.id && s.to.id === to.id
        );

        if (existingSegment && existingSegment.geojson) {
          // Reuse existing calculated segment
          newSegments.push(existingSegment);
        } else {
          // New segment needed (the bridge segment)
          this.currentVersion++;
          this.segmentVersions.set(key, this.currentVersion);
          newSegments.push({
            from,
            to,
            geojson: null,
            loading: true,
          });
        }
      }

      return newSegments;
    });
  }

  /**
   * Invalidate only segments adjacent to a moved waypoint
   * Much more efficient than rebuilding all segments
   */
  private invalidateAdjacentSegments(waypointIndex: number): void {
    const wps = this.waypoints();

    this.segments.update((segs) => {
      return segs.map((segment, segIndex) => {
        // Segment before the waypoint (segIndex === waypointIndex - 1)
        // Segment after the waypoint (segIndex === waypointIndex)
        const isAdjacent =
          segIndex === waypointIndex - 1 ||
          segIndex === waypointIndex;

        if (isAdjacent) {
          // Update with current waypoint positions
          const from = wps[segIndex];
          const to = wps[segIndex + 1];

          if (!from || !to) return segment;

          const key = segmentKey(from, to);
          this.currentVersion++;
          this.segmentVersions.set(key, this.currentVersion);

          return {
            from,
            to,
            geojson: null,
            loading: true,
            error: undefined,
          };
        }

        return segment;
      });
    });
  }

  /**
   * Complete rebuild of all segments (used for reorder/reverse)
   */
  private rebuildAllSegments(): void {
    const wps = this.waypoints();
    if (wps.length < 2) {
      this.segments.set([]);
      return;
    }

    const newSegments: RouteSegment[] = [];
    for (let i = 0; i < wps.length - 1; i++) {
      const key = segmentKey(wps[i], wps[i + 1]);
      this.currentVersion++;
      this.segmentVersions.set(key, this.currentVersion);

      newSegments.push({
        from: wps[i],
        to: wps[i + 1],
        geojson: null,
        loading: true,
      });
    }

    this.segments.set(newSegments);
  }

  /**
   * Mark all segments for recalculation (keeps waypoint refs)
   */
  private recalculateAllSegments(): void {
    this.segments.update((segs) =>
      segs.map((s) => {
        const key = segmentKey(s.from, s.to);
        this.currentVersion++;
        this.segmentVersions.set(key, this.currentVersion);
        return { ...s, geojson: null, loading: true, error: undefined };
      })
    );
  }
}
