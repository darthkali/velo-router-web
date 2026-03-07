import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapContainerComponent } from './features/map/components/map-container/map-container.component';
import { ExportDialogComponent } from './features/sidebar/components/export-dialog/export-dialog.component';
import { ImportDialogComponent } from './features/sidebar/components/import-dialog/import-dialog.component';
import { ElevationChartComponent } from './features/elevation/components/elevation-chart/elevation-chart.component';
import { SidebarComponent } from './features/sidebar/components/sidebar/sidebar.component';
import { RouteState } from './state/route.state';
import { MapState } from './state/map.state';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MapContainerComponent,
    ExportDialogComponent,
    ImportDialogComponent,
    ElevationChartComponent,
    SidebarComponent,
  ],
  template: `
    <div class="h-screen w-screen flex flex-col">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10 shrink-0">
        <h1 class="text-xl font-bold text-primary-600">VeloRouter</h1>

        <!-- Loading indicator -->
        @if (routeState.isCalculating()) {
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span>Calculating...</span>
          </div>
        }

        <!-- Keyboard shortcuts hint -->
        <div class="text-xs text-gray-400">
          Press <kbd class="px-1 py-0.5 bg-gray-100 rounded">?</kbd> for shortcuts
        </div>
      </header>

      <!-- Main Layout -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Sidebar -->
        <app-sidebar
          (openExport)="showExportDialog.set(true)"
          (openImport)="showImportDialog.set(true)" />

        <!-- Map & Elevation -->
        <div class="flex-1 flex flex-col">
          <!-- Map -->
          <main class="flex-1 relative">
            <app-map-container />
          </main>

          <!-- Elevation Profile -->
          @if (routeState.hasRoute()) {
            <div class="shrink-0 border-t border-gray-200 bg-white">
              <app-elevation-chart />
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Export Dialog -->
    <app-export-dialog
      [isOpen]="showExportDialog()"
      (close)="showExportDialog.set(false)" />

    <!-- Import Dialog -->
    <app-import-dialog
      [isOpen]="showImportDialog()"
      (close)="showImportDialog.set(false)" />

    <!-- Keyboard Shortcuts Help -->
    @if (showShortcutsHelp()) {
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        (click)="showShortcutsHelp.set(false)">
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex justify-between"><span>Draw Mode</span><kbd class="px-2 py-1 bg-gray-100 rounded">D</kbd></div>
            <div class="flex justify-between"><span>Undo</span><kbd class="px-2 py-1 bg-gray-100 rounded">Z</kbd></div>
            <div class="flex justify-between"><span>Reverse</span><kbd class="px-2 py-1 bg-gray-100 rounded">R</kbd></div>
            <div class="flex justify-between"><span>My Location</span><kbd class="px-2 py-1 bg-gray-100 rounded">L</kbd></div>
            <div class="flex justify-between"><span>Fit Route</span><kbd class="px-2 py-1 bg-gray-100 rounded">B</kbd></div>
            <div class="flex justify-between"><span>Import</span><kbd class="px-2 py-1 bg-gray-100 rounded">O</kbd></div>
            <div class="flex justify-between"><span>Clear</span><kbd class="px-2 py-1 bg-gray-100 rounded">Del</kbd></div>
            <div class="flex justify-between"><span>Close Dialog</span><kbd class="px-2 py-1 bg-gray-100 rounded">Esc</kbd></div>
          </div>
          <button
            (click)="showShortcutsHelp.set(false)"
            class="mt-4 w-full btn-secondary">
            Close
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
    }
  `],
})
export class AppComponent {
  readonly routeState = inject(RouteState);
  readonly mapState = inject(MapState);
  readonly showExportDialog = signal(false);
  readonly showImportDialog = signal(false);
  readonly showShortcutsHelp = signal(false);

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    // Ignore if in input field
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'd':
        this.mapState.toggleDrawMode('route');
        event.preventDefault();
        break;
      case 'z':
        this.routeState.removeLastWaypoint();
        event.preventDefault();
        break;
      case 'r':
        if (this.routeState.waypointCount() >= 2) {
          this.routeState.reverseRoute();
        }
        event.preventDefault();
        break;
      case 'l':
        this.centerOnLocation();
        event.preventDefault();
        break;
      case 'b':
        this.fitRoute();
        event.preventDefault();
        break;
      case 'o':
        this.showImportDialog.set(true);
        event.preventDefault();
        break;
      case 'delete':
      case 'backspace':
        if (!event.ctrlKey && !event.metaKey) {
          this.routeState.clearRoute();
          event.preventDefault();
        }
        break;
      case 'escape':
        this.showExportDialog.set(false);
        this.showImportDialog.set(false);
        this.showShortcutsHelp.set(false);
        break;
      case '?':
        this.showShortcutsHelp.set(true);
        event.preventDefault();
        break;
      case '0':
      case '1':
      case '2':
      case '3':
        if (event.shiftKey) {
          this.routeState.setAlternative(parseInt(event.key, 10));
          event.preventDefault();
        }
        break;
    }
  }

  private centerOnLocation(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const map = this.mapState.map();
          if (map) {
            map.setView([position.coords.latitude, position.coords.longitude], 14);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }

  private fitRoute(): void {
    const map = this.mapState.map();
    const waypoints = this.routeState.waypoints();

    if (map && waypoints.length > 0) {
      const bounds = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}
