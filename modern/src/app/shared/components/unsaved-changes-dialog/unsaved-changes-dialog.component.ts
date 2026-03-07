import {
  Component,
  input,
  output,
  effect,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Dialog for warning about unsaved changes
 *
 * Shows when user tries to:
 * - Create a new route
 * - Open another file
 * - Close the tab (via beforeunload)
 */
@Component({
  selector: 'app-unsaved-changes-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        (click)="onBackdropClick($event)"
        (keydown.escape)="onCancel()">
        <div
          #dialogPanel
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="unsaved-title"
          aria-describedby="unsaved-desc"
          class="bg-white rounded-xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in-95 duration-200"
          (click)="$event.stopPropagation()">

          <div class="p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 id="unsaved-title" class="text-lg font-semibold text-gray-900">
                Ungespeicherte Änderungen
              </h2>
            </div>

            <p id="unsaved-desc" class="text-sm text-gray-600">
              Deine Route hat Änderungen, die noch nicht gespeichert wurden.
              Möchtest du die Änderungen speichern?
            </p>
          </div>

          <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
            <button
              (click)="onDiscard()"
              class="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
              Nicht speichern
            </button>
            <button
              (click)="onCancel()"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Abbrechen
            </button>
            <button
              #saveButton
              (click)="onSave()"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
              Speichern
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes zoom-in-95 {
      from { transform: scale(0.95); }
      to { transform: scale(1); }
    }

    .animate-in {
      animation: fade-in 0.2s ease-out, zoom-in-95 0.2s ease-out;
    }
  `],
})
export class UnsavedChangesDialogComponent {
  /** Whether the dialog is open */
  readonly isOpen = input.required<boolean>();

  /** Emitted when user clicks "Abbrechen" or presses Escape */
  readonly cancel = output<void>();

  /** Emitted when user clicks "Speichern" */
  readonly save = output<void>();

  /** Emitted when user clicks "Nicht speichern" */
  readonly discard = output<void>();

  private readonly saveButton = viewChild<ElementRef<HTMLButtonElement>>('saveButton');

  constructor() {
    // Focus save button when dialog opens
    effect(() => {
      if (this.isOpen()) {
        setTimeout(() => {
          this.saveButton()?.nativeElement.focus();
        }, 100);
      }
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onSave(): void {
    this.save.emit();
  }

  onDiscard(): void {
    this.discard.emit();
  }
}
