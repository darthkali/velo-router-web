import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, interval, filter, takeUntil, switchMap, tap } from 'rxjs';
import { FileState } from '../../../state/file.state';
import { RouteState } from '../../../state/route.state';
import { FileService } from './file.service';
import { VeloFile, VELO_FORMAT_VERSION, APP_VERSION } from './velo-format';
import { MapState } from '../../../state/map.state';

/**
 * AutoSaveService provides automatic saving of route data
 *
 * Features:
 * - Configurable interval (default 30 seconds)
 * - Only saves when: autoSaveEnabled AND isDirty AND hasFileHandle
 * - Integrates with FileState signals
 * - Graceful cleanup on destroy
 */
@Injectable({ providedIn: 'root' })
export class AutoSaveService implements OnDestroy {
  private readonly fileState = inject(FileState);
  private readonly fileService = inject(FileService);
  private readonly routeState = inject(RouteState);
  private readonly mapState = inject(MapState);

  private readonly destroy$ = new Subject<void>();
  private isRunning = false;

  /**
   * Start the auto-save timer
   * Call this once from the app component on init
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    // Use the interval from FileState
    interval(this.fileState.autoSaveInterval())
      .pipe(
        takeUntil(this.destroy$),
        // Only proceed if conditions are met
        filter(() => this.shouldAutoSave()),
        // Perform the save
        switchMap(() => this.performAutoSave()),
        tap({
          error: (err) => console.error('Auto-save error:', err),
        })
      )
      .subscribe();
  }

  /**
   * Stop the auto-save timer
   */
  stop(): void {
    this.destroy$.next();
    this.isRunning = false;
  }

  /**
   * Check if auto-save should run
   */
  private shouldAutoSave(): boolean {
    return (
      this.fileState.autoSaveEnabled() &&
      this.fileState.isDirty() &&
      this.fileState.hasFileHandle() &&
      !this.fileState.isSaving()
    );
  }

  /**
   * Perform the auto-save operation
   */
  private async performAutoSave(): Promise<boolean> {
    try {
      const veloFile = this.createVeloFile();
      const success = await this.fileService.save(veloFile);

      if (success) {
        console.log('Auto-save completed:', new Date().toISOString());
      }

      return success;
    } catch (err) {
      console.error('Auto-save failed:', err);
      return false;
    }
  }

  /**
   * Create a VeloFile from current state
   */
  private createVeloFile(): VeloFile {
    const routeSnapshot = this.routeState.getSnapshot();
    const map = this.mapState.map();
    const center = map?.getCenter();
    const zoom = map?.getZoom();

    const veloFile: VeloFile = {
      format: 'velo-route',
      version: VELO_FORMAT_VERSION,
      metadata: {
        name: this.fileState.fileName(),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        appVersion: APP_VERSION,
      },
      route: {
        profile: routeSnapshot.profile,
        alternativeIndex: routeSnapshot.alternativeIndex,
        waypoints: routeSnapshot.waypoints.map((wp) => ({
          id: wp.id,
          lat: wp.lat,
          lng: wp.lng,
          name: wp.name,
          type: wp.type,
        })),
      },
      mapView: center
        ? {
            center: [center.lat, center.lng],
            zoom: zoom ?? 10,
            baseLayer: this.mapState.activeBaseLayer()?.id ?? 'osm',
            overlays: this.mapState.activeOverlays().map((o) => o.id),
          }
        : undefined,
      ui: {
        elevationChartExpanded: true,
        sidebarCollapsed: false,
      },
    };

    return veloFile;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
