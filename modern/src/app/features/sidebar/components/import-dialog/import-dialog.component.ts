import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImportService, ImportResult, ImportError } from '../../../../core/services/import';
import { RouteState } from '../../../../state/route.state';
import { MapState } from '../../../../state/map.state';
import { LatLng } from '../../../../core/services/brouter/brouter.types';

type ImportMode = 'add' | 'replace';

@Component({
  selector: 'app-import-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        (click)="onBackdropClick($event)">
        <!-- Dialog -->
        <div
          class="bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all"
          (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Import Route</h2>
          </div>

          <!-- Content -->
          <div class="px-6 py-4 space-y-4">
            <!-- Drop Zone -->
            <div
              class="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer"
              [class.border-gray-300]="!isDragging() && !importResult()"
              [class.border-primary-500]="isDragging()"
              [class.bg-primary-50]="isDragging()"
              [class.border-green-500]="importResult() && !error()"
              [class.bg-green-50]="importResult() && !error()"
              [class.border-red-500]="error()"
              [class.bg-red-50]="error()"
              (click)="fileInput.click()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)">

              <input
                #fileInput
                type="file"
                class="hidden"
                accept=".gpx,.kml,.geojson,.json"
                (change)="onFileSelected($event)">

              @if (isLoading()) {
                <div class="flex flex-col items-center">
                  <svg class="animate-spin h-10 w-10 text-primary-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p class="text-sm text-gray-600">Processing file...</p>
                </div>
              } @else if (error()) {
                <div class="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p class="text-sm text-red-600 font-medium mb-1">{{ error() }}</p>
                  <button
                    type="button"
                    class="text-sm text-primary-600 hover:text-primary-700 underline"
                    (click)="reset(); $event.stopPropagation()">
                    Try another file
                  </button>
                </div>
              } @else if (importResult()) {
                <div class="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p class="text-sm text-green-700 font-medium">{{ selectedFileName() }}</p>
                  <p class="text-sm text-gray-600 mt-1">
                    {{ importResult()!.waypoints.length }} points found
                    @if (importResult()!.name) {
                      <span class="text-gray-400"> | </span>
                      <span class="italic">{{ importResult()!.name }}</span>
                    }
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    Format: {{ importResult()!.format.toUpperCase() }}
                  </p>
                  <button
                    type="button"
                    class="text-sm text-primary-600 hover:text-primary-700 underline mt-2"
                    (click)="reset(); $event.stopPropagation()">
                    Choose different file
                  </button>
                </div>
              } @else {
                <div class="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p class="text-sm text-gray-600 mb-1">
                    <span class="font-medium text-primary-600">Click to upload</span> or drag and drop
                  </p>
                  <p class="text-xs text-gray-500">GPX, KML, or GeoJSON files</p>
                </div>
              }
            </div>

            <!-- Import Mode Selection -->
            @if (importResult() && !error()) {
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Import Mode
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="importMode.set('add')"
                    class="relative px-4 py-3 rounded-lg border-2 transition-all text-center"
                    [class.border-primary-500]="importMode() === 'add'"
                    [class.bg-primary-50]="importMode() === 'add'"
                    [class.border-gray-200]="importMode() !== 'add'"
                    [class.hover:border-gray-300]="importMode() !== 'add'">
                    <div class="font-semibold" [class.text-primary-700]="importMode() === 'add'">
                      Add to Route
                    </div>
                    <div class="text-xs text-gray-500 mt-0.5">Append points to current route</div>
                  </button>
                  <button
                    type="button"
                    (click)="importMode.set('replace')"
                    class="relative px-4 py-3 rounded-lg border-2 transition-all text-center"
                    [class.border-primary-500]="importMode() === 'replace'"
                    [class.bg-primary-50]="importMode() === 'replace'"
                    [class.border-gray-200]="importMode() !== 'replace'"
                    [class.hover:border-gray-300]="importMode() !== 'replace'">
                    <div class="font-semibold" [class.text-primary-700]="importMode() === 'replace'">
                      Replace Route
                    </div>
                    <div class="text-xs text-gray-500 mt-0.5">Clear and start fresh</div>
                  </button>
                </div>
              </div>

              <!-- Preview Summary -->
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-sm text-gray-600 space-y-1">
                  <div class="flex justify-between">
                    <span>Points to import:</span>
                    <span class="font-medium">{{ importResult()!.waypoints.length }}</span>
                  </div>
                  @if (importMode() === 'add' && routeState.waypointCount() > 0) {
                    <div class="flex justify-between">
                      <span>Current waypoints:</span>
                      <span class="font-medium">{{ routeState.waypointCount() }}</span>
                    </div>
                    <div class="flex justify-between border-t border-gray-200 pt-1 mt-1">
                      <span>Total after import:</span>
                      <span class="font-medium">{{ routeState.waypointCount() + importResult()!.waypoints.length }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              (click)="close.emit()"
              class="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              (click)="performImport()"
              [disabled]="!importResult() || !!error()"
              class="btn-primary"
              [class.opacity-50]="!importResult() || !!error()"
              [class.cursor-not-allowed]="!importResult() || !!error()">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
              Import {{ importResult()?.waypoints?.length || 0 }} Points
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `],
})
export class ImportDialogComponent {
  private readonly importService = inject(ImportService);
  readonly routeState = inject(RouteState);
  private readonly mapState = inject(MapState);

  readonly isOpen = input.required<boolean>();
  readonly close = output<void>();
  readonly imported = output<void>();

  // State
  readonly isDragging = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly importResult = signal<ImportResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly selectedFileName = signal<string>('');
  readonly importMode = signal<ImportMode>('replace');

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
    // Reset input to allow selecting the same file again
    input.value = '';
  }

  private processFile(file: File): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.importResult.set(null);
    this.selectedFileName.set(file.name);

    this.importService.importFile(file).subscribe({
      next: (result) => {
        this.importResult.set(result);
        this.isLoading.set(false);
      },
      error: (err: ImportError | Error) => {
        const message = 'message' in err ? err.message : 'Failed to import file';
        this.error.set(message);
        this.isLoading.set(false);
      },
    });
  }

  reset(): void {
    this.importResult.set(null);
    this.error.set(null);
    this.selectedFileName.set('');
    this.isDragging.set(false);
    this.isLoading.set(false);
  }

  performImport(): void {
    const result = this.importResult();
    if (!result || result.waypoints.length === 0) {
      return;
    }

    // Clear existing route if replacing
    if (this.importMode() === 'replace') {
      this.routeState.clearRoute();
    }

    // Add all waypoints
    for (const point of result.waypoints) {
      this.routeState.addWaypoint(point);
    }

    // Fit map to bounds of imported points
    this.fitMapToBounds(result.waypoints);

    this.imported.emit();
    this.close.emit();
    this.reset();
  }

  private fitMapToBounds(points: LatLng[]): void {
    if (points.length === 0) return;

    const map = this.mapState.getMap();
    if (!map) return;

    // Calculate bounds
    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;

    for (const point of points) {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    }

    // Fit map to bounds with padding
    this.mapState.fitBounds(
      [[minLat, minLng], [maxLat, maxLng]],
      { padding: [50, 50] }
    );
  }
}
