import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteState } from '../../../../state/route.state';
import { MapState } from '../../../../state/map.state';
import { DEFAULT_PROFILES } from '../../../../core/services/brouter/brouter.types';
import { LocationSearchComponent } from '../location-search/location-search.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, LocationSearchComponent],
  template: `
    <aside
      class="h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300"
      [class.w-72]="!isCollapsed()"
      [class.w-12]="isCollapsed()">

      <!-- Toggle Button -->
      <button
        (click)="isCollapsed.set(!isCollapsed())"
        class="absolute top-20 -right-3 z-20 bg-white border border-gray-300 rounded-full p-1 shadow-sm hover:bg-gray-50"
        [title]="isCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
        <svg
          class="h-4 w-4 text-gray-600 transition-transform"
          [class.rotate-180]="isCollapsed()"
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      @if (!isCollapsed()) {
        <!-- Location Search -->
        <div class="p-3 border-b border-gray-100">
          <app-location-search />
        </div>

        <!-- Profile Section -->
        <div class="p-3 border-b border-gray-100">
          <label class="block text-xs font-medium text-gray-500 mb-1">Routing Profile</label>
          <select
            [value]="routeState.selectedProfile()"
            (change)="onProfileChange($event)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
            @for (profile of profiles; track profile.id) {
              <option [value]="profile.id">{{ profile.name }}</option>
            }
          </select>
        </div>

        <!-- Route Alternatives -->
        <div class="p-3 border-b border-gray-100">
          <label class="block text-xs font-medium text-gray-500 mb-2">Route Alternative</label>
          <div class="flex gap-1">
            @for (alt of [0, 1, 2, 3]; track alt) {
              <button
                (click)="routeState.setAlternative(alt)"
                class="flex-1 px-2 py-1 text-xs rounded transition-colors"
                [class.bg-primary-600]="routeState.alternativeIndex() === alt"
                [class.text-white]="routeState.alternativeIndex() === alt"
                [class.bg-gray-100]="routeState.alternativeIndex() !== alt"
                [class.hover:bg-gray-200]="routeState.alternativeIndex() !== alt">
                {{ alt === 0 ? 'Main' : alt }}
              </button>
            }
          </div>
        </div>

        <!-- Route Actions -->
        <div class="p-3 border-b border-gray-100 space-y-2">
          <label class="block text-xs font-medium text-gray-500 mb-2">Route Actions</label>

          <!-- Draw Mode -->
          <button
            (click)="mapState.toggleDrawMode('route')"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
            [class.bg-primary-600]="mapState.drawMode() === 'route'"
            [class.text-white]="mapState.drawMode() === 'route'"
            [class.bg-gray-100]="mapState.drawMode() !== 'route'"
            [class.hover:bg-gray-200]="mapState.drawMode() !== 'route'">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Draw Route</span>
            <kbd class="ml-auto text-xs opacity-60">D</kbd>
          </button>

          <!-- Undo -->
          <button
            (click)="routeState.removeLastWaypoint()"
            [disabled]="!routeState.canUndo()"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>Undo</span>
            <kbd class="ml-auto text-xs opacity-60">Z</kbd>
          </button>

          <!-- Reverse -->
          <button
            (click)="routeState.reverseRoute()"
            [disabled]="routeState.waypointCount() < 2"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span>Reverse</span>
            <kbd class="ml-auto text-xs opacity-60">R</kbd>
          </button>

          <!-- Clear -->
          <button
            (click)="routeState.clearRoute()"
            [disabled]="routeState.waypointCount() === 0"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear Route</span>
          </button>
        </div>

        <!-- Map Actions -->
        <div class="p-3 border-b border-gray-100 space-y-2">
          <label class="block text-xs font-medium text-gray-500 mb-2">Map</label>

          <!-- My Location -->
          <button
            (click)="centerOnLocation()"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>My Location</span>
            <kbd class="ml-auto text-xs opacity-60">L</kbd>
          </button>

          <!-- Fit Route -->
          <button
            (click)="fitRoute()"
            [disabled]="!routeState.hasRoute()"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>Fit Route</span>
            <kbd class="ml-auto text-xs opacity-60">B</kbd>
          </button>
        </div>

        <!-- Import/Export -->
        <div class="p-3 border-b border-gray-100 space-y-2">
          <label class="block text-xs font-medium text-gray-500 mb-2">Import / Export</label>

          <!-- Import -->
          <button
            (click)="openImport.emit()"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import GPX/KML</span>
            <kbd class="ml-auto text-xs opacity-60">O</kbd>
          </button>

          <!-- Export -->
          <button
            (click)="openExport.emit()"
            [disabled]="!routeState.hasRoute()"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Route</span>
          </button>
        </div>

        <!-- Route Stats -->
        @if (routeState.hasRoute()) {
          <div class="p-3 mt-auto bg-gray-50">
            <label class="block text-xs font-medium text-gray-500 mb-2">Route Statistics</label>
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Distance</span>
                <span class="font-medium">{{ routeState.formattedDistance() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Ascent</span>
                <span class="font-medium">{{ routeState.formattedAscent() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Est. Time</span>
                <span class="font-medium">{{ routeState.formattedTime() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Waypoints</span>
                <span class="font-medium">{{ routeState.waypointCount() }}</span>
              </div>
            </div>
          </div>
        }
      } @else {
        <!-- Collapsed icons -->
        <div class="flex flex-col items-center py-3 gap-2">
          <button
            (click)="mapState.toggleDrawMode('route')"
            class="p-2 rounded-lg transition-colors"
            [class.bg-primary-600]="mapState.drawMode() === 'route'"
            [class.text-white]="mapState.drawMode() === 'route'"
            [class.hover:bg-gray-100]="mapState.drawMode() !== 'route'"
            title="Draw Route (D)">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            (click)="routeState.removeLastWaypoint()"
            [disabled]="!routeState.canUndo()"
            class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="Undo (Z)">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            (click)="centerOnLocation()"
            class="p-2 rounded-lg hover:bg-gray-100"
            title="My Location (L)">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </button>
          <button
            (click)="openExport.emit()"
            [disabled]="!routeState.hasRoute()"
            class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="Export">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      }
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
    }
  `],
})
export class SidebarComponent {
  readonly routeState = inject(RouteState);
  readonly mapState = inject(MapState);
  readonly profiles = DEFAULT_PROFILES;

  readonly isCollapsed = signal(false);
  readonly openExport = output<void>();
  readonly openImport = output<void>();

  onProfileChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.routeState.setProfile(select.value);
  }

  centerOnLocation(): void {
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
          alert('Could not get your location. Please enable location services.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }

  fitRoute(): void {
    const map = this.mapState.map();
    const waypoints = this.routeState.waypoints();

    if (map && waypoints.length > 0) {
      const bounds = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}
