import { Component, inject, signal, HostListener, ViewChild, ElementRef, effect, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapContainerComponent } from './features/map/components/map-container/map-container.component';
import { LayersPanelComponent } from './features/map/components/layers-panel';
import { RegionSearchComponent } from './features/map/components/region-search';
import { ExportDialogComponent } from './features/sidebar/components/export-dialog/export-dialog.component';
import { ImportDialogComponent } from './features/sidebar/components/import-dialog/import-dialog.component';
import { ElevationChartComponent, RouteHoverPoint } from './features/elevation/components/elevation-chart/elevation-chart.component';
import { SidebarComponent } from './features/sidebar/components/sidebar/sidebar.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { UnsavedChangesDialogComponent } from './shared/components/unsaved-changes-dialog';
import { RouteState } from './state/route.state';
import { MapState } from './state/map.state';
import { FileState } from './state/file.state';
import { FileService, VeloFile, createEmptyVeloFile, VELO_FORMAT_VERSION, APP_VERSION, AutoSaveService } from './core/services/file';
import { BoundaryService } from './core/services/boundary';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapContainerComponent,
    LayersPanelComponent,
    RegionSearchComponent,
    ExportDialogComponent,
    ImportDialogComponent,
    ElevationChartComponent,
    SidebarComponent,
    ToastContainerComponent,
    UnsavedChangesDialogComponent,
  ],
  template: `
    <div class="h-screen w-screen flex flex-col">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10 shrink-0">
        <!-- Left side: Title, File Menu, and Profile Selector -->
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-bold text-primary-600">VeloRouter</h1>

          <!-- File Menu Dropdown -->
          <div class="relative" #fileMenuContainer>
            <button
              (click)="toggleFileMenu()"
              class="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 rounded transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Datei</span>
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            @if (showFileMenu()) {
              <div class="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  (click)="newFile()"
                  class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <span>Neue Route</span>
                  <kbd class="text-xs text-gray-400">Ctrl+N</kbd>
                </button>
                <button
                  (click)="openFile()"
                  class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <span>Öffnen...</span>
                  <kbd class="text-xs text-gray-400">Ctrl+O</kbd>
                </button>
                <div class="border-t border-gray-100 my-1"></div>
                <button
                  (click)="saveFile()"
                  [disabled]="!fileState.hasFileHandle()"
                  class="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-100"
                  [class.text-gray-700]="fileState.hasFileHandle()"
                  [class.text-gray-400]="!fileState.hasFileHandle()"
                  [class.cursor-not-allowed]="!fileState.hasFileHandle()">
                  <span>Speichern</span>
                  <kbd class="text-xs text-gray-400">Ctrl+S</kbd>
                </button>
                <button
                  (click)="saveFileAs()"
                  class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <span>Speichern unter...</span>
                  <kbd class="text-xs text-gray-400">Ctrl+Shift+S</kbd>
                </button>
                <div class="border-t border-gray-100 my-1"></div>
                <!-- Auto-Save Toggle -->
                <button
                  (click)="toggleAutoSave(); $event.stopPropagation()"
                  class="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <span class="flex items-center gap-2">
                    <span
                      class="w-8 h-4 rounded-full transition-colors relative"
                      [class.bg-primary-600]="fileState.autoSaveEnabled()"
                      [class.bg-gray-300]="!fileState.autoSaveEnabled()">
                      <span
                        class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform"
                        [class.left-0.5]="!fileState.autoSaveEnabled()"
                        [class.left-4]="fileState.autoSaveEnabled()">
                      </span>
                    </span>
                    Auto-Speichern
                  </span>
                  @if (fileState.autoSaveEnabled()) {
                    <span class="text-xs text-green-600">An</span>
                  } @else {
                    <span class="text-xs text-gray-400">Aus</span>
                  }
                </button>
              </div>
            }
          </div>

          <!-- Profile Selector -->
          <select
            [ngModel]="routeState.selectedProfile()"
            (ngModelChange)="routeState.setProfile($event)"
            class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            @for (profile of routeState.availableProfiles(); track profile.id) {
              <option [value]="profile.id">{{ profile.name }}</option>
            }
          </select>
        </div>

        <!-- Center: File Status (only show when file is open or dirty) -->
        @if (fileState.showFileStatus()) {
          <div class="flex items-center gap-3 text-sm">
            <!-- File icon and name -->
            <div class="flex items-center gap-2 text-gray-600">
              <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              @if (isEditingFileName()) {
                <input
                  #fileNameInput
                  type="text"
                  [value]="editingFileName()"
                  (input)="onFileNameInput($event)"
                  (keydown.enter)="saveFileName()"
                  (keydown.escape)="cancelFileNameEdit()"
                  (blur)="saveFileName()"
                  class="px-1 py-0.5 text-sm border border-primary-400 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 max-w-[200px]"
                  maxlength="100" />
              } @else {
                <button
                  (click)="startFileNameEdit()"
                  class="truncate max-w-[200px] hover:bg-gray-100 px-1 py-0.5 rounded cursor-pointer transition-colors"
                  title="Klicken zum Umbenennen">
                  {{ fileState.fileName() }}
                </button>
              }
            </div>

            <!-- Save button -->
            @if (fileState.hasFileHandle()) {
              <button
                (click)="saveFile()"
                [disabled]="fileState.isSaving() || !fileState.isDirty()"
                class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors"
                [class.bg-primary-600]="fileState.isDirty() && !fileState.isSaving()"
                [class.text-white]="fileState.isDirty() && !fileState.isSaving()"
                [class.hover:bg-primary-700]="fileState.isDirty() && !fileState.isSaving()"
                [class.bg-gray-100]="!fileState.isDirty() || fileState.isSaving()"
                [class.text-gray-400]="!fileState.isDirty() || fileState.isSaving()"
                [class.cursor-not-allowed]="!fileState.isDirty() || fileState.isSaving()"
                title="Speichern (Ctrl+S)">
                @if (fileState.isSaving()) {
                  <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                } @else {
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                }
                <span>Speichern</span>
              </button>
            }

            <!-- Status indicators -->
            @if (fileState.isSaving()) {
              <div class="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Speichern...</span>
              </div>
            } @else {
              <!-- Unsaved changes indicator -->
              @if (fileState.isDirty()) {
                <div class="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="5" />
                  </svg>
                  <span>Ungespeichert</span>
                </div>
              }
              <!-- Last saved time (always show if available) -->
              @if (fileState.lastSaved()) {
                <div class="flex items-center gap-1.5 text-xs text-gray-400">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ formatLastSaved() }}</span>
                </div>
              }
            }
          </div>
        }

        <!-- Right side: Loading indicator and shortcuts hint -->
        <div class="flex items-center gap-4">
          @if (routeState.isCalculating()) {
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span>Calculating...</span>
            </div>
          }
          <div class="text-xs text-gray-400">
            Press <kbd class="px-1 py-0.5 bg-gray-100 rounded">?</kbd> for shortcuts
          </div>
        </div>
      </header>

      <!-- Main Layout -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Sidebar -->
        <app-sidebar
          (openExport)="showExportDialog.set(true)"
          (openImport)="showImportDialog.set(true)" />

        <!-- Map & Elevation -->
        <div class="flex-1 flex flex-col">
          <!-- Map -->
          <main class="flex-1 relative">
            <app-map-container #mapContainer />
            <!-- Layers Panel (right side) -->
            <app-layers-panel (openRegionSearch)="regionSearch.openSearch()" />
            <!-- Region Search (fullscreen overlay) -->
            <app-region-search #regionSearch />
          </main>

          <!-- Elevation Profile -->
          @if (routeState.hasRoute()) {
            <div class="shrink-0 border-t border-gray-200 bg-white">
              <app-elevation-chart (hoverPoint)="onElevationHoverPoint($event)" />
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Export Dialog -->
    <app-export-dialog
      [isOpen]="showExportDialog()"
      (close)="showExportDialog.set(false)" />

    <!-- Import Dialog -->
    <app-import-dialog
      [isOpen]="showImportDialog()"
      (close)="showImportDialog.set(false)" />

    <!-- Toast Notifications -->
    <app-toast-container />

    <!-- Unsaved Changes Dialog -->
    <app-unsaved-changes-dialog
      [isOpen]="showUnsavedChangesDialog()"
      (cancel)="onUnsavedChangesCancel()"
      (save)="onUnsavedChangesSave()"
      (discard)="onUnsavedChangesDiscard()" />

    <!-- Keyboard Shortcuts Help -->
    @if (showShortcutsHelp()) {
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        (click)="showShortcutsHelp.set(false)">
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
          <div class="space-y-3 text-sm">
            <!-- File section -->
            <div>
              <div class="text-xs text-gray-400 uppercase mb-1">Datei</div>
              <div class="grid grid-cols-2 gap-1">
                <div class="flex justify-between"><span>Neu</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+N</kbd></div>
                <div class="flex justify-between"><span>Öffnen</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+O</kbd></div>
                <div class="flex justify-between"><span>Speichern</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">Ctrl+S</kbd></div>
              </div>
            </div>
            <!-- Route section -->
            <div>
              <div class="text-xs text-gray-400 uppercase mb-1">Route</div>
              <div class="grid grid-cols-2 gap-1">
                <div class="flex justify-between"><span>Zeichnen</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">D</kbd></div>
                <div class="flex justify-between"><span>Rückgängig</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">Z</kbd></div>
                <div class="flex justify-between"><span>Umkehren</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">R</kbd></div>
                <div class="flex justify-between"><span>Löschen</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">Del</kbd></div>
              </div>
            </div>
            <!-- Map section -->
            <div>
              <div class="text-xs text-gray-400 uppercase mb-1">Karte</div>
              <div class="grid grid-cols-2 gap-1">
                <div class="flex justify-between"><span>Mein Standort</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">L</kbd></div>
                <div class="flex justify-between"><span>Route zeigen</span><kbd class="px-2 py-0.5 bg-gray-100 rounded text-xs">B</kbd></div>
              </div>
            </div>
          </div>
          <button
            (click)="showShortcutsHelp.set(false)"
            class="mt-4 w-full btn-secondary">
            Close
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly routeState = inject(RouteState);
  readonly mapState = inject(MapState);
  readonly fileState = inject(FileState);
  readonly fileService = inject(FileService);
  readonly boundaryService = inject(BoundaryService);
  readonly autoSaveService = inject(AutoSaveService);

  readonly showExportDialog = signal(false);
  readonly showImportDialog = signal(false);
  readonly showShortcutsHelp = signal(false);
  readonly showFileMenu = signal(false);
  readonly showUnsavedChangesDialog = signal(false);

  // Filename editing state
  readonly isEditingFileName = signal(false);
  readonly editingFileName = signal('');

  // Pending action after unsaved changes dialog
  private pendingAction: 'new' | 'open' | null = null;

  @ViewChild('regionSearch') regionSearch!: RegionSearchComponent;
  @ViewChild('mapContainer') mapContainer!: MapContainerComponent;
  @ViewChild('fileNameInput') fileNameInput?: ElementRef<HTMLInputElement>;

  private beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    // Only warn if dirty and auto-save is off
    if (this.fileState.isDirty() && !this.fileState.autoSaveEnabled()) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
    return undefined;
  };

  constructor() {
    // Track route changes for dirty state
    effect(() => {
      // These dependencies trigger the effect
      const waypoints = this.routeState.waypoints();
      const profile = this.routeState.selectedProfile();
      const altIndex = this.routeState.alternativeIndex();
      const baseLayer = this.mapState.activeBaseLayer();
      const overlays = this.mapState.activeOverlays();

      // Only mark dirty if we have waypoints and state has changed
      if (waypoints.length > 0) {
        const currentHash = this.computeFullStateHash();
        if (this.fileState.hasChangedSince(currentHash)) {
          this.fileState.markDirty();
        }
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Compute a hash of the full state (route + map layers)
   */
  private computeFullStateHash(): string {
    const routeHash = this.routeState.computeStateHash();
    const baseLayer = this.mapState.activeBaseLayer()?.id ?? '';
    const overlays = this.mapState.activeOverlays().map(o => o.id).sort().join(',');
    return `${routeHash}|${baseLayer}|${overlays}`;
  }

  ngOnInit(): void {
    // Register beforeunload handler
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    // Close file menu when clicking outside
    document.addEventListener('click', this.closeFileMenuOnOutsideClick.bind(this));

    // Start auto-save service
    this.autoSaveService.start();
  }

  ngAfterViewInit(): void {
    // Focus the filename input when editing starts
    // This is handled reactively via effect in the constructor
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    document.removeEventListener('click', this.closeFileMenuOnOutsideClick.bind(this));

    // Stop auto-save service
    this.autoSaveService.stop();
  }

  // ============================================
  // Filename Editing
  // ============================================

  /**
   * Start editing the filename
   */
  startFileNameEdit(): void {
    this.editingFileName.set(this.fileState.fileName());
    this.isEditingFileName.set(true);
    // Focus input after Angular updates the view
    setTimeout(() => {
      this.fileNameInput?.nativeElement?.focus();
      this.fileNameInput?.nativeElement?.select();
    }, 0);
  }

  /**
   * Handle input changes
   */
  onFileNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editingFileName.set(input.value);
  }

  /**
   * Save the new filename
   */
  saveFileName(): void {
    if (!this.isEditingFileName()) {
      return;
    }

    const newName = this.editingFileName().trim();
    if (newName && newName !== this.fileState.fileName()) {
      this.fileState.setFileName(newName);
    }

    this.isEditingFileName.set(false);
    this.editingFileName.set('');
  }

  /**
   * Cancel filename editing
   */
  cancelFileNameEdit(): void {
    this.isEditingFileName.set(false);
    this.editingFileName.set('');
  }

  private closeFileMenuOnOutsideClick(event: MouseEvent): void {
    if (this.showFileMenu()) {
      const target = event.target as HTMLElement;
      if (!target.closest('[#fileMenuContainer]')) {
        this.showFileMenu.set(false);
      }
    }
  }

  toggleFileMenu(): void {
    this.showFileMenu.update(v => !v);
  }

  toggleAutoSave(): void {
    this.fileState.toggleAutoSave();
  }

  /**
   * Format the last saved time as absolute time (HH:MM)
   */
  formatLastSaved(): string {
    const lastSaved = this.fileState.lastSaved();
    if (!lastSaved) {
      return '';
    }

    const hours = lastSaved.getHours().toString().padStart(2, '0');
    const minutes = lastSaved.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    // Ignore if in input field
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    // File shortcuts (with Ctrl/Cmd)
    if (modifier) {
      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault();
          if (event.shiftKey) {
            this.saveFileAs();
          } else {
            this.saveFile();
          }
          return;
        case 'o':
          event.preventDefault();
          this.openFile();
          return;
        case 'n':
          event.preventDefault();
          this.newFile();
          return;
      }
    }

    switch (event.key.toLowerCase()) {
      case 'd':
        this.mapState.toggleDrawMode('route');
        event.preventDefault();
        break;
      case 'z':
        if (!modifier) {
          this.routeState.removeLastWaypoint();
          event.preventDefault();
        }
        break;
      case 'r':
        if (this.routeState.waypointCount() >= 2) {
          this.routeState.reverseRoute();
        }
        event.preventDefault();
        break;
      case 'l':
        this.centerOnLocation();
        event.preventDefault();
        break;
      case 'b':
        this.fitRoute();
        event.preventDefault();
        break;
      case 'delete':
      case 'backspace':
        if (!event.ctrlKey && !event.metaKey) {
          this.routeState.clearRoute();
          event.preventDefault();
        }
        break;
      case 'escape':
        this.showExportDialog.set(false);
        this.showImportDialog.set(false);
        this.showShortcutsHelp.set(false);
        this.showFileMenu.set(false);
        this.showUnsavedChangesDialog.set(false);
        break;
      case '?':
        this.showShortcutsHelp.set(true);
        event.preventDefault();
        break;
      case '0':
      case '1':
      case '2':
      case '3':
        if (event.shiftKey) {
          this.routeState.setAlternative(parseInt(event.key, 10));
          event.preventDefault();
        }
        break;
    }
  }

  private centerOnLocation(): void {
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
        }
      );
    }
  }

  private fitRoute(): void {
    const map = this.mapState.map();
    const waypoints = this.routeState.waypoints();

    if (map && waypoints.length > 0) {
      const bounds = waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /**
   * Handle elevation chart hover point for map cursor synchronization
   */
  onElevationHoverPoint(point: RouteHoverPoint | null): void {
    if (this.mapContainer) {
      this.mapContainer.setElevationHoverPoint(point);
    }
  }

  // ============================================
  // File Operations
  // ============================================

  /**
   * Create a new route (clears current route)
   */
  newFile(): void {
    this.showFileMenu.set(false);

    // Check for unsaved changes
    if (this.fileState.isDirty() && this.routeState.waypointCount() > 0) {
      this.pendingAction = 'new';
      this.showUnsavedChangesDialog.set(true);
      return;
    }

    this.performNewFile();
  }

  private performNewFile(): void {
    this.routeState.clearRoute();
    this.fileState.reset();
  }

  /**
   * Open a .velo file
   */
  async openFile(): Promise<void> {
    this.showFileMenu.set(false);

    // Check for unsaved changes
    if (this.fileState.isDirty() && this.routeState.waypointCount() > 0) {
      this.pendingAction = 'open';
      this.showUnsavedChangesDialog.set(true);
      return;
    }

    await this.performOpenFile();
  }

  private async performOpenFile(): Promise<void> {
    const veloFile = await this.fileService.open();
    if (veloFile) {
      this.loadVeloFile(veloFile);
    }
  }

  /**
   * Save to current file (or save as if no file)
   */
  async saveFile(): Promise<void> {
    this.showFileMenu.set(false);

    const veloFile = this.createVeloFile();
    const saved = await this.fileService.save(veloFile);
    if (saved) {
      this.fileState.updateHash(this.computeFullStateHash());
    }
  }

  /**
   * Save to a new file
   */
  async saveFileAs(): Promise<void> {
    this.showFileMenu.set(false);

    const veloFile = this.createVeloFile();
    const saved = await this.fileService.saveAs(veloFile);
    if (saved) {
      this.fileState.updateHash(this.computeFullStateHash());
    }
  }

  /**
   * Create a VeloFile from current state
   */
  private createVeloFile(): VeloFile {
    const routeSnapshot = this.routeState.getSnapshot();
    const map = this.mapState.map();
    const center = map?.getCenter();
    const zoom = map?.getZoom();

    const veloFile: VeloFile = {
      format: 'velo-route',
      version: VELO_FORMAT_VERSION,
      metadata: {
        name: this.fileState.fileName(),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        appVersion: APP_VERSION,
      },
      route: {
        profile: routeSnapshot.profile,
        alternativeIndex: routeSnapshot.alternativeIndex,
        waypoints: routeSnapshot.waypoints.map(wp => ({
          id: wp.id,
          lat: wp.lat,
          lng: wp.lng,
          name: wp.name,
          type: wp.type,
        })),
      },
      mapView: center ? {
        center: [center.lat, center.lng],
        zoom: zoom ?? 10,
        baseLayer: this.mapState.activeBaseLayer()?.id ?? 'osm',
        overlays: this.mapState.activeOverlays().map(o => o.id),
      } : undefined,
      ui: {
        elevationChartExpanded: true,
        sidebarCollapsed: false,
      },
    };

    return veloFile;
  }

  /**
   * Load a VeloFile into the app state
   */
  private loadVeloFile(veloFile: VeloFile): void {
    // Load route
    this.routeState.loadSnapshot({
      waypoints: veloFile.route.waypoints,
      profile: veloFile.route.profile,
      alternativeIndex: veloFile.route.alternativeIndex,
    });

    // Load map view
    if (veloFile.mapView) {
      const [lat, lng] = veloFile.mapView.center;
      this.mapState.setView({ lat, lng }, veloFile.mapView.zoom);

      // Set base layer
      if (veloFile.mapView.baseLayer) {
        this.mapState.switchBaseLayer(veloFile.mapView.baseLayer);
      }

      // Set overlays
      if (veloFile.mapView.overlays) {
        // First turn off all overlays
        for (const overlay of this.mapState.activeOverlays()) {
          this.mapState.toggleOverlayLayer(overlay.id);
        }
        // Then turn on the ones from the file
        for (const overlayId of veloFile.mapView.overlays) {
          const overlay = this.mapState.overlayLayers().find(o => o.id === overlayId);
          if (overlay && !overlay.visible) {
            this.mapState.toggleOverlayLayer(overlayId);
          }
        }
      }
    }

    // Update file state
    this.fileState.setFileName(veloFile.metadata.name);
    this.fileState.updateHash(this.computeFullStateHash());
    this.fileState.markSaved();
  }

  // ============================================
  // Unsaved Changes Dialog Handlers
  // ============================================

  onUnsavedChangesCancel(): void {
    this.showUnsavedChangesDialog.set(false);
    this.pendingAction = null;
  }

  async onUnsavedChangesSave(): Promise<void> {
    this.showUnsavedChangesDialog.set(false);

    // Save first
    const veloFile = this.createVeloFile();
    const saved = await this.fileService.save(veloFile);

    if (saved) {
      // Then execute pending action
      this.executePendingAction();
    }
  }

  onUnsavedChangesDiscard(): void {
    this.showUnsavedChangesDialog.set(false);
    this.executePendingAction();
  }

  private executePendingAction(): void {
    const action = this.pendingAction;
    this.pendingAction = null;

    switch (action) {
      case 'new':
        this.performNewFile();
        break;
      case 'open':
        this.performOpenFile();
        break;
    }
  }
}
