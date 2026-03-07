import { Injectable, inject, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, catchError, of, forkJoin, map } from 'rxjs';
import { BRouterService } from '../../../core/services/brouter/brouter.service';
import { RouteState } from '../../../state/route.state';

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private readonly brouterService = inject(BRouterService);
  private readonly routeState = inject(RouteState);
  private readonly destroyRef = inject(DestroyRef);

  private readonly calculateTrigger$ = new Subject<void>();
  private isCalculating = false;

  constructor() {
    this.setupAutoCalculation();
    this.setupSegmentWatcher();
  }

  /**
   * Manually trigger route calculation for all segments
   */
  calculateRoute(): void {
    this.calculateTrigger$.next();
  }

  /**
   * Calculate only segments that need calculation (loading=true, no geojson)
   * Includes version tracking to prevent stale updates
   */
  calculatePendingSegments(): void {
    const segments = this.routeState.segments();
    const pendingSegments = segments
      .map((s, index) => ({ segment: s, index }))
      .filter(({ segment }) => segment.loading && !segment.geojson && !segment.error);

    if (pendingSegments.length === 0) {
      this.routeState.isCalculating.set(false);
      return;
    }

    this.routeState.isCalculating.set(true);

    // Capture versions at calculation start to detect stale responses
    const requests = pendingSegments.map(({ segment, index }) => {
      const version = this.routeState.getSegmentVersion(index);

      return this.brouterService
        .getRoute({
          waypoints: [segment.from, segment.to],
          profile: this.routeState.selectedProfile(),
          alternativeIdx: this.routeState.alternativeIndex(),
        })
        .pipe(
          map((result) => {
            const feature = result.geojson.features[0] as GeoJSON.Feature<GeoJSON.LineString>;
            return { index, result: feature, version };
          }),
          catchError((error) => {
            console.error(`Error calculating segment ${index}:`, error);
            return of({ index, result: null, error: error.message, version });
          })
        );
    });

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          results.forEach((res) => {
            const { index, result, version } = res;
            const error = 'error' in res ? res.error : undefined;

            // Pass version to allow RouteState to reject stale updates
            if (result) {
              this.routeState.updateSegmentResult(
                index,
                result as GeoJSON.Feature<GeoJSON.LineString>,
                undefined,
                version
              );
            } else {
              this.routeState.updateSegmentResult(index, null, error || 'Unknown error', version);
            }
          });
          this.routeState.isCalculating.set(false);
        },
        error: (err) => {
          console.error('Error calculating routes:', err);
          this.routeState.isCalculating.set(false);
        },
      });
  }

  private setupAutoCalculation(): void {
    // Debounce rapid changes and trigger calculation
    this.calculateTrigger$
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.calculatePendingSegments();
      });
  }

  private setupSegmentWatcher(): void {
    // Watch for segment changes that need calculation
    effect(() => {
      const segments = this.routeState.segments();
      const needsCalculation = segments.some(
        (s) => s.loading && !s.geojson && !s.error
      );

      if (needsCalculation && !this.isCalculating) {
        this.isCalculating = true;
        // Use setTimeout to avoid effect recursion
        setTimeout(() => {
          this.calculatePendingSegments();
          this.isCalculating = false;
        }, 0);
      }
    });
  }
}
