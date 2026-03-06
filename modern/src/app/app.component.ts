import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapContainerComponent } from './features/map/components/map-container/map-container.component';
import { RouteState } from './state/route.state';
import { MapState } from './state/map.state';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MapContainerComponent],
  template: `
    <div class="h-screen w-screen flex flex-col">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-bold text-primary-600">VeloRouter</h1>

          <!-- Profile Selector -->
          <select
            [value]="routeState.selectedProfile()"
            (change)="onProfileChange($event)"
            class="input w-48">
            <option value="trekking">Trekking</option>
            <option value="fastbike">Fast Bike</option>
            <option value="safety">Safety</option>
            <option value="shortest">Shortest</option>
          </select>
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

          <!-- Export (placeholder) -->
          @if (routeState.hasRoute()) {
            <button class="btn-primary">
              Export
            </button>
          }
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 relative">
        <app-map-container />
      </main>

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

  onProfileChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.routeState.setProfile(select.value);
  }
}
