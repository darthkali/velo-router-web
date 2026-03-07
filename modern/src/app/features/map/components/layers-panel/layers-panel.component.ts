import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapState, MapLayer } from '../../../../state/map.state';

@Component({
  selector: 'app-layers-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Toggle button (always visible) -->
    <button
      (click)="togglePanel()"
      class="absolute top-4 right-4 z-[1001] bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
      [class.hidden]="isOpen()"
      [attr.aria-label]="'Open layers panel'"
      [attr.aria-expanded]="isOpen()">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 4.5A1.5 1.5 0 013.5 3h13A1.5 1.5 0 0118 4.5v.879a2.5 2.5 0 01-.732 1.767l-4.768 4.768v4.586a1.5 1.5 0 01-2.354 1.235l-2-1.333A1.5 1.5 0 017.5 15.277V11.5L2.732 7.146A2.5 2.5 0 012 5.379V4.5z" />
      </svg>
    </button>

    <!-- Panel -->
    <div
      class="absolute top-4 right-4 z-[1001] transition-all duration-300 ease-in-out"
      [class.translate-x-full]="!isOpen()"
      [class.opacity-0]="!isOpen()"
      [class.pointer-events-none]="!isOpen()">
      <div class="bg-white rounded-lg shadow-xl w-72 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 class="font-semibold text-gray-800">Map Layers</h3>
          <button
            (click)="togglePanel()"
            class="p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label="Close layers panel">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Content (scrollable) -->
        <div class="overflow-y-auto flex-1 p-4 space-y-6">
          <!-- Base Layers Section -->
          <section>
            <h4 class="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clip-rule="evenodd" />
              </svg>
              Base Layers
            </h4>
            <div class="space-y-2">
              @for (layer of mapState.baseLayers(); track layer.id) {
                <label
                  class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  [class.bg-primary-50]="layer.visible"
                  [class.ring-1]="layer.visible"
                  [class.ring-primary-200]="layer.visible">
                  <input
                    type="radio"
                    name="baseLayer"
                    [value]="layer.id"
                    [checked]="layer.visible"
                    (change)="selectBaseLayer(layer.id)"
                    class="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                  <span class="text-sm text-gray-700">{{ layer.name }}</span>
                </label>
              }
            </div>
          </section>

          <!-- Divider -->
          <hr class="border-gray-200" />

          <!-- Overlay Layers Section -->
          <section>
            <h4 class="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
              </svg>
              Overlays
            </h4>
            <div class="space-y-4">
              @for (layer of mapState.overlayLayers(); track layer.id) {
                <div class="space-y-2">
                  <!-- Checkbox row -->
                  <label
                    class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    [class.bg-primary-50]="layer.visible"
                    [class.ring-1]="layer.visible"
                    [class.ring-primary-200]="layer.visible">
                    <input
                      type="checkbox"
                      [checked]="layer.visible"
                      (change)="toggleOverlay(layer.id)"
                      class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <span class="text-sm text-gray-700">{{ layer.name }}</span>
                  </label>

                  <!-- Opacity slider (only when visible) -->
                  @if (layer.visible) {
                    <div class="flex items-center gap-3 px-2 ml-7">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a1 1 0 011.414 0 9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 010-1.414zM7.879 6.464a1 1 0 010 1.414 3 3 0 000 4.243 1 1 0 11-1.415 1.414 5 5 0 010-7.07 1 1 0 011.415 0zm4.242 0a1 1 0 011.415 0 5 5 0 010 7.072 1 1 0 01-1.415-1.415 3 3 0 000-4.242 1 1 0 010-1.415z" clip-rule="evenodd" />
                      </svg>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        [value]="layer.opacity * 100"
                        (input)="onOpacityChange(layer.id, $event)"
                        class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                      <span class="text-xs text-gray-500 w-10 text-right">{{ (layer.opacity * 100) | number:'1.0-0' }}%</span>
                    </div>
                  }
                </div>
              }
            </div>
          </section>
        </div>

        <!-- Footer hint -->
        <div class="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <p class="text-xs text-gray-500 text-center">
            Select a base layer and add overlays
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    /* Custom range slider styling */
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #2563eb;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    input[type="range"]::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #2563eb;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  `],
})
export class LayersPanelComponent {
  readonly mapState = inject(MapState);

  // Panel open/close state - starts collapsed
  readonly isOpen = signal(false);

  togglePanel(): void {
    this.isOpen.update((open) => !open);
  }

  selectBaseLayer(layerId: string): void {
    this.mapState.switchBaseLayer(layerId);
  }

  toggleOverlay(layerId: string): void {
    this.mapState.toggleOverlayLayer(layerId);
  }

  onOpacityChange(layerId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const opacity = parseInt(input.value, 10) / 100;
    this.mapState.setLayerOpacity(layerId, opacity);
  }
}
