import { Injectable, inject } from '@angular/core';
import { FileState, FileSystemFileHandle } from '../../../state/file.state';
import { ToastService } from '../toast';
import {
  VeloFile,
  serializeVeloFile,
  parseVeloFile,
  generateFilename,
} from './velo-format';

/**
 * File picker options for .velo files
 */
const VELO_FILE_OPTIONS = {
  types: [
    {
      description: 'VeloRouter Route',
      accept: { 'application/json': ['.velo'] },
    },
  ],
};

/**
 * FileService handles saving and loading .velo files
 *
 * Uses File System Access API when available (Chrome, Edge)
 * Falls back to download/upload for Safari and Firefox
 */
@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly fileState = inject(FileState);
  private readonly toast = inject(ToastService);

  /**
   * Check if File System Access API is supported
   */
  get isSupported(): boolean {
    return (
      typeof window !== 'undefined' && 'showSaveFilePicker' in window
    );
  }

  /**
   * Save the current route to a file
   * Uses existing file handle if available, otherwise prompts for location
   */
  async save(data: VeloFile): Promise<boolean> {
    const handle = this.fileState.fileHandle();

    if (handle) {
      return this.saveToHandle(handle, data);
    } else {
      return this.saveAs(data);
    }
  }

  /**
   * Save the route to a new file (always prompts for location)
   */
  async saveAs(data: VeloFile): Promise<boolean> {
    if (!this.isSupported) {
      this.downloadFallback(data);
      return true;
    }

    try {
      this.fileState.isSaving.set(true);

      const suggestedName = generateFilename(data.metadata.name);

      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        ...VELO_FILE_OPTIONS,
      });

      const success = await this.saveToHandle(handle, data);

      if (success) {
        this.fileState.setFileHandle(handle);
        this.toast.success(`Route gespeichert: ${handle.name}`);
      }

      return success;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User cancelled - not an error
        return false;
      }
      console.error('Save failed:', err);
      this.toast.error('Speichern fehlgeschlagen');
      this.fileState.lastError.set((err as Error).message);
      return false;
    } finally {
      this.fileState.isSaving.set(false);
    }
  }

  /**
   * Open a .velo file
   */
  async open(): Promise<VeloFile | null> {
    if (!this.isSupported) {
      return this.openFallback();
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        ...VELO_FILE_OPTIONS,
        multiple: false,
      });

      const file = await handle.getFile();
      const content = await file.text();
      const veloFile = parseVeloFile(content);

      if (!veloFile) {
        this.toast.error('Ungültiges Dateiformat');
        return null;
      }

      this.fileState.setFileHandle(handle);
      this.toast.success(`Route geladen: ${handle.name}`);

      return veloFile;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User cancelled
        return null;
      }
      console.error('Open failed:', err);
      this.toast.error('Laden fehlgeschlagen');
      return null;
    }
  }

  /**
   * Save to an existing file handle
   */
  private async saveToHandle(
    handle: FileSystemFileHandle,
    data: VeloFile
  ): Promise<boolean> {
    try {
      // Check/request permission
      const hasPermission = await this.verifyPermission(handle);
      if (!hasPermission) {
        this.toast.error('Keine Schreibberechtigung');
        return false;
      }

      this.fileState.isSaving.set(true);

      const writable = await handle.createWritable();
      try {
        await writable.write(serializeVeloFile(data));
      } finally {
        await writable.close();
      }

      this.fileState.markSaved();
      return true;
    } catch (err) {
      console.error('Save to handle failed:', err);
      this.fileState.lastError.set((err as Error).message);
      return false;
    } finally {
      this.fileState.isSaving.set(false);
    }
  }

  /**
   * Verify and request permission for file handle
   */
  private async verifyPermission(
    handle: FileSystemFileHandle
  ): Promise<boolean> {
    try {
      // Check current permission
      let state = await handle.queryPermission({ mode: 'readwrite' });

      if (state === 'granted') {
        return true;
      }

      // Request permission (requires user gesture)
      if (state === 'prompt') {
        state = await handle.requestPermission({ mode: 'readwrite' });
        return state === 'granted';
      }

      return false;
    } catch (err) {
      console.error('Permission check failed:', err);
      return false;
    }
  }

  /**
   * Fallback: Download file as blob
   */
  private downloadFallback(data: VeloFile): void {
    const content = serializeVeloFile(data);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = generateFilename(data.metadata.name);
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    this.fileState.markSaved();
    this.toast.success('Route heruntergeladen');
  }

  /**
   * Fallback: Open file via input element
   */
  private openFallback(): Promise<VeloFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.velo,application/json';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const content = await file.text();
          const veloFile = parseVeloFile(content);

          if (!veloFile) {
            this.toast.error('Ungültiges Dateiformat');
            resolve(null);
            return;
          }

          // No file handle in fallback mode
          this.fileState.setFileHandle(null, file.name.replace(/\.velo$/i, ''));
          this.toast.success(`Route geladen: ${file.name}`);

          resolve(veloFile);
        } catch (err) {
          console.error('Open fallback failed:', err);
          this.toast.error('Laden fehlgeschlagen');
          resolve(null);
        }
      };

      input.click();
    });
  }
}
