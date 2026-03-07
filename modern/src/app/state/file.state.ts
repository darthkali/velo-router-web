import { Injectable, signal, computed } from '@angular/core';

/**
 * File System Access API types
 * These are not fully typed in TypeScript yet
 */
export interface FileSystemFileHandle {
  name: string;
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

/**
 * FileState manages the current file/project state
 *
 * This is a signal-based state service that tracks:
 * - Current file handle (for File System Access API)
 * - File name and dirty state
 * - Auto-save configuration
 */
@Injectable({ providedIn: 'root' })
export class FileState {
  /**
   * Current file handle from File System Access API
   * null if no file has been saved yet
   */
  readonly fileHandle = signal<FileSystemFileHandle | null>(null);

  /**
   * Display name for the current file/project
   */
  readonly fileName = signal<string>('Neue Route');

  /**
   * Whether there are unsaved changes
   */
  readonly isDirty = signal<boolean>(false);

  /**
   * Timestamp of last successful save
   */
  readonly lastSaved = signal<Date | null>(null);

  /**
   * Whether auto-save is enabled
   */
  readonly autoSaveEnabled = signal<boolean>(this.loadAutoSaveSetting());

  /**
   * Auto-save interval in milliseconds
   */
  readonly autoSaveInterval = signal<number>(30000); // 30 seconds

  /**
   * Whether a save operation is in progress
   */
  readonly isSaving = signal<boolean>(false);

  /**
   * Last error message (null if no error)
   */
  readonly lastError = signal<string | null>(null);

  /**
   * Hash of the last saved state (for dirty detection)
   */
  private lastSavedHash = '';

  // Computed properties

  /**
   * Whether we have a file handle (can use "Save" vs "Save As")
   */
  readonly hasFileHandle = computed(() => this.fileHandle() !== null);

  /**
   * Whether we can perform a save operation
   */
  readonly canSave = computed(() => this.hasFileHandle() && this.isDirty());

  /**
   * Display title including dirty indicator
   */
  readonly displayTitle = computed(() => {
    const name = this.fileName();
    const dirty = this.isDirty() ? ' *' : '';
    return `${name}${dirty}`;
  });

  /**
   * Whether to show the file status in header
   * Only show after first save or when dirty with waypoints
   */
  readonly showFileStatus = computed(() => {
    return this.hasFileHandle() || this.isDirty();
  });

  /**
   * Check if File System Access API is supported
   */
  readonly isFileSystemAccessSupported = computed(() => {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  });

  /**
   * Set the current file handle and name
   */
  setFileHandle(handle: FileSystemFileHandle | null, name?: string): void {
    this.fileHandle.set(handle);
    if (name) {
      this.fileName.set(name);
    } else if (handle) {
      // Extract name from handle, removing extension
      const fullName = handle.name;
      const nameWithoutExt = fullName.replace(/\.velo$/i, '');
      this.fileName.set(nameWithoutExt);
    }
  }

  /**
   * Mark the current state as dirty (has unsaved changes)
   */
  markDirty(): void {
    this.isDirty.set(true);
  }

  /**
   * Mark the current state as saved
   */
  markSaved(hash?: string): void {
    this.isDirty.set(false);
    this.lastSaved.set(new Date());
    this.lastError.set(null);
    if (hash) {
      this.lastSavedHash = hash;
    }
  }

  /**
   * Check if state has changed since last save
   */
  hasChangedSince(hash: string): boolean {
    return hash !== this.lastSavedHash;
  }

  /**
   * Update the last saved hash without marking as saved
   */
  updateHash(hash: string): void {
    this.lastSavedHash = hash;
  }

  /**
   * Get the current saved hash
   */
  getSavedHash(): string {
    return this.lastSavedHash;
  }

  /**
   * Reset to new file state
   */
  reset(): void {
    this.fileHandle.set(null);
    this.fileName.set('Neue Route');
    this.isDirty.set(false);
    this.lastSaved.set(null);
    this.lastError.set(null);
    this.lastSavedHash = '';
  }

  /**
   * Set auto-save enabled state
   */
  setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled.set(enabled);
    this.saveAutoSaveSetting(enabled);
  }

  /**
   * Toggle auto-save
   */
  toggleAutoSave(): void {
    this.setAutoSaveEnabled(!this.autoSaveEnabled());
  }

  /**
   * Set the file name (without extension)
   */
  setFileName(name: string): void {
    const oldName = this.fileName();
    if (name !== oldName) {
      this.fileName.set(name);
      this.markDirty();
    }
  }

  /**
   * Load auto-save setting from localStorage
   */
  private loadAutoSaveSetting(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('velo-router-autosave') === 'true';
  }

  /**
   * Save auto-save setting to localStorage
   */
  private saveAutoSaveSetting(enabled: boolean): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('velo-router-autosave', enabled ? 'true' : 'false');
  }
}
