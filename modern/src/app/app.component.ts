import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapContainerComponent } from './features/map/components/map-container/map-container.component';
import { ExportDialogComponent } from './features/sidebar/components/export-dialog/export-dialog.component';
import { ElevationChartComponent } from './features/elevation/components/elevation-chart/elevation-chart.component';
import { RouteState } from './state/route.state';
import { MapState } from './state/map.state';
import { DEFAULT_PROFILES } from './core/services/brouter/brouter.types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MapContainerComponent, ExportDialogComponent, ElevationChartComponent],
  template: `
    <div class="h-screen w-screen flex flex-col">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-bold text-primary-600">VeloRouter</h1>

          <!-- Profile Selector -->
          <div class="relative">
            <select
              [value]="routeState.selectedProfile()"
              (change)="onProfileChange($event)"
              class="input w-56 pr-8 appearance-none cursor-pointer">
              @for (profile of profiles; track profile.id) {
                <option [value]="profile.id">{{ profile.name }}</option>
              }
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Draw Mode Toggle -->
          <button
            (click)="mapState.toggleDrawMode('route')"
            [class.bg-primary-600]="mapState.drawMode() === 'route'"
            [class.text-white]="mapState.drawMode() === 'route'"
            class="btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
            </svg>
            Draw Route
          </button>

          <!-- Clear Route -->
          @if (routeState.waypointCount() > 0) {
            <button (click)="routeState.clearRoute()" class="btn-secondary text-red-600">
              Clear
            </button>
          }

          <!-- Reverse Route -->
          @if (routeState.waypointCount() >= 2) {
            <button (click)="routeState.reverseRoute()" class="btn-secondary">
              Reverse
            </button>
          }

          <!-- Export -->
          @if (routeState.hasRoute()) {
            <button (click)="showExportDialog.set(true)" class="btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              Export
            </button>
          }
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 relative">
        <app-map-container />
      </main>

      <!-- Elevation Profile -->
      @if (routeState.hasRoute()) {
        <div class="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <app-elevation-chart />
        </div>
      }

      <!-- Footer Stats -->
      @if (routeState.hasRoute()) {
        <footer class="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-6 text-sm">
          <div>
            <span class="text-gray-500">Distance:</span>
            <span class="font-semibold ml-1">{{ routeState.formattedDistance() }}</span>
          </div>
          <div>
            <span class="text-gray-500">Ascent:</span>
            <span class="font-semibold ml-1">{{ routeState.formattedAscent() }}</span>
          </div>
          <div>
            <span class="text-gray-500">Time:</span>
            <span class="font-semibold ml-1">{{ routeState.formattedTime() }}</span>
          </div>
          <div>
            <span class="text-gray-500">Waypoints:</span>
            <span class="font-semibold ml-1">{{ routeState.waypointCount() }}</span>
          </div>
        </footer>
      }
    </div>

    <!-- Export Dialog -->
    <app-export-dialog
      [isOpen]="showExportDialog()"
      (close)="showExportDialog.set(false)" />
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
  readonly profiles = DEFAULT_PROFILES;
  readonly showExportDialog = signal(false);

  onProfileChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.routeState.setProfile(select.value);
  }
}
