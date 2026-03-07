import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportService, ExportFormat } from '../../../../core/services/export/export.service';
import { RouteState } from '../../../../state/route.state';

@Component({
  selector: 'app-export-dialog',
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
            <h2 class="text-lg font-semibold text-gray-900">Export Route</h2>
          </div>

          <!-- Content -->
          <div class="px-6 py-4 space-y-4">
            <!-- Filename -->
            <div>
              <label for="filename" class="block text-sm font-medium text-gray-700 mb-1">
                Filename
              </label>
              <input
                id="filename"
                type="text"
                [(ngModel)]="filename"
                class="input"
                placeholder="my-route">
            </div>

            <!-- Format Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <div class="grid grid-cols-3 gap-2">
                @for (format of formats; track format.id) {
                  <button
                    type="button"
                    (click)="selectedFormat.set(format.id)"
                    class="relative px-4 py-3 rounded-lg border-2 transition-all text-center"
                    [class.border-primary-500]="selectedFormat() === format.id"
                    [class.bg-primary-50]="selectedFormat() === format.id"
                    [class.border-gray-200]="selectedFormat() !== format.id"
                    [class.hover:border-gray-300]="selectedFormat() !== format.id">
                    <div class="font-semibold" [class.text-primary-700]="selectedFormat() === format.id">
                      {{ format.label }}
                    </div>
                    <div class="text-xs text-gray-500 mt-0.5">{{ format.description }}</div>
                  </button>
                }
              </div>
            </div>

            <!-- Route Stats -->
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="text-sm text-gray-600 space-y-1">
                <div class="flex justify-between">
                  <span>Distance:</span>
                  <span class="font-medium">{{ routeState.formattedDistance() }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Ascent:</span>
                  <span class="font-medium">{{ routeState.formattedAscent() }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Est. Time:</span>
                  <span class="font-medium">{{ routeState.formattedTime() }}</span>
                </div>
              </div>
            </div>
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
              (click)="exportRoute()"
              [disabled]="!filename.trim()"
              class="btn-primary"
              [class.opacity-50]="!filename.trim()"
              [class.cursor-not-allowed]="!filename.trim()">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              Export {{ selectedFormat().toUpperCase() }}
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
export class ExportDialogComponent {
  private readonly exportService = inject(ExportService);
  readonly routeState = inject(RouteState);

  readonly isOpen = input.required<boolean>();
  readonly close = output<void>();

  filename = 'velo-route';
  readonly selectedFormat = signal<ExportFormat>('gpx');

  readonly formats: { id: ExportFormat; label: string; description: string }[] = [
    { id: 'gpx', label: 'GPX', description: 'GPS Exchange' },
    { id: 'kml', label: 'KML', description: 'Google Earth' },
    { id: 'geojson', label: 'GeoJSON', description: 'Web mapping' },
  ];

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  exportRoute(): void {
    const segments = this.routeState.segments();
    this.exportService.export(segments, this.filename.trim(), this.selectedFormat());
    this.close.emit();
  }
}
