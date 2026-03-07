import { Component, inject, signal, output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteState } from '../../../../state/route.state';
import { MapState } from '../../../../state/map.state';
import { LocationSearchComponent } from '../location-search/location-search.component';
import { ToastService } from '../../../../core/services/toast';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, LocationSearchComponent],
  template: `
    @if (isMobile()) {
      <!-- Mobile Bottom Sheet -->
      <div
        class="fixed bottom-0 left-0 right-0 z-[1000] transition-transform duration-300 ease-out"
        [style.transform]="isCollapsed() ? 'translateY(calc(100% - 3.5rem))' : 'translateY(0)'">
        <!-- Handle -->
        <button
          (click)="toggleSidebar()"
          class="w-full h-14 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] flex items-center justify-center border-t border-gray-200 cursor-grab active:cursor-grabbing"
          [attr.aria-expanded]="!isCollapsed()"
          aria-label="Bottom Sheet öffnen/schließen">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </button>
        <!-- Content -->
        <div class="bg-white max-h-[70vh] overflow-y-auto pb-8">
          <!-- Location Search -->
          <div class="p-3 border-b border-gray-100">
            <app-location-search />
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

        </div>
      </div>
    } @else {
      <!-- Desktop Sidebar -->
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

        } @else {
          <!-- Collapsed icons - comprehensive toolbar -->
          <div class="flex flex-col items-center py-2 gap-1">
            <!-- Search toggle -->
            <button
              (click)="isCollapsed.set(false)"
              class="p-2 rounded-lg hover:bg-gray-100"
              title="Search Location">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>

            <div class="w-6 border-t border-gray-200 my-1"></div>

            <!-- Draw Mode -->
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

            <!-- Undo -->
            <button
              (click)="routeState.removeLastWaypoint()"
              [disabled]="!routeState.canUndo()"
              class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              title="Undo (Z)">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            <!-- Reverse -->
            <button
              (click)="routeState.reverseRoute()"
              [disabled]="routeState.waypointCount() < 2"
              class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              title="Reverse Route (R)">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>

            <!-- Clear -->
            <button
              (click)="routeState.clearRoute()"
              [disabled]="routeState.waypointCount() === 0"
              class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-red-500"
              title="Clear Route">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <div class="w-6 border-t border-gray-200 my-1"></div>

            <!-- My Location -->
            <button
              (click)="centerOnLocation()"
              class="p-2 rounded-lg hover:bg-gray-100"
              title="My Location (L)">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <!-- Fit Route -->
            <button
              (click)="fitRoute()"
              [disabled]="!routeState.hasRoute()"
              class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              title="Fit Route (B)">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            <div class="w-6 border-t border-gray-200 my-1"></div>

            <!-- Import -->
            <button
              (click)="openImport.emit()"
              class="p-2 rounded-lg hover:bg-gray-100"
              title="Import GPX/KML (O)">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>

            <!-- Export -->
            <button
              (click)="openExport.emit()"
              [disabled]="!routeState.hasRoute()"
              class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-primary-600"
              title="Export Route">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            <div class="w-6 border-t border-gray-200 my-1"></div>

            <!-- Route Alternatives (mini) -->
            @for (alt of [0, 1, 2, 3]; track alt) {
              <button
                (click)="routeState.setAlternative(alt)"
                class="w-7 h-7 text-xs rounded transition-colors flex items-center justify-center"
                [class.bg-primary-600]="routeState.alternativeIndex() === alt"
                [class.text-white]="routeState.alternativeIndex() === alt"
                [class.bg-gray-100]="routeState.alternativeIndex() !== alt"
                [class.hover:bg-gray-200]="routeState.alternativeIndex() !== alt"
                [title]="'Alternative ' + alt">
                {{ alt }}
              </button>
            }

          </div>
        }
      </aside>
    }
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
    }
  `],
})
export class SidebarComponent implements OnDestroy {
  readonly routeState = inject(RouteState);
  readonly mapState = inject(MapState);
  private readonly toastService = inject(ToastService);

  readonly isCollapsed = signal(true); // Collapsed by default
  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 768);
  readonly openExport = output<void>();
  readonly openImport = output<void>();

  private resizeHandler = () => {
    this.isMobile.set(window.innerWidth < 768);
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeHandler);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  toggleSidebar(): void {
    this.isCollapsed.set(!this.isCollapsed());
  }

  centerOnLocation(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const map = this.mapState.map();
          if (map) {
            map.setView([position.coords.latitude, position.coords.longitude], 19);
            // Show location marker with accuracy circle
            this.mapState.showLocationMarker(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy
            );
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          this.toastService.error('Could not get your location. Please enable location services.');
        }
      );
    } else {
      this.toastService.error('Geolocation is not supported by your browser.');
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
