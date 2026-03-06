# VeloRouter-Web Modernisierungsplan

## Ziel-Tech-Stack

| Kategorie | Technologie | Version |
|-----------|-------------|---------|
| **Framework** | Angular | 17+ (Standalone Components) |
| **Language** | TypeScript | 5.x (strict) |
| **Build** | Angular CLI + esbuild | 17+ |
| **Styling** | Tailwind CSS | 3.x |
| **State** | NgRx Signals / Angular Signals | Built-in |
| **Maps** | Leaflet + ngx-leaflet | 1.9 / 18+ |
| **i18n** | @ngx-translate/core | 15+ |
| **HTTP** | Angular HttpClient | Built-in |
| **Testing** | Jest + Testing Library + Playwright | Latest |
| **Backend** | BRouter | Bestehend |

---

## Projekt-Architektur

```
velo-router-web/
├── src/
│   ├── app/
│   │   ├── core/                    # Singleton Services
│   │   │   ├── services/
│   │   │   │   ├── brouter/
│   │   │   │   │   ├── brouter.service.ts
│   │   │   │   │   ├── brouter.types.ts
│   │   │   │   │   └── url-builder.ts
│   │   │   │   ├── formats/
│   │   │   │   │   ├── gpx-formatter.service.ts
│   │   │   │   │   ├── kml-formatter.service.ts
│   │   │   │   │   ├── fit-formatter.service.ts
│   │   │   │   │   └── formatter.interface.ts
│   │   │   │   ├── layers/
│   │   │   │   │   └── layers.service.ts
│   │   │   │   └── storage/
│   │   │   │       └── local-storage.service.ts
│   │   │   ├── interceptors/
│   │   │   │   └── error.interceptor.ts
│   │   │   └── guards/
│   │   │
│   │   ├── shared/                  # Shared Components & Utilities
│   │   │   ├── components/
│   │   │   │   ├── button/
│   │   │   │   ├── modal/
│   │   │   │   ├── toast/
│   │   │   │   └── loading-spinner/
│   │   │   ├── directives/
│   │   │   ├── pipes/
│   │   │   └── utils/
│   │   │       ├── geo/
│   │   │       │   ├── cheap-ruler.ts
│   │   │       │   └── track-edges.ts
│   │   │       ├── xml.ts
│   │   │       └── waypoint-label.ts
│   │   │
│   │   ├── features/                # Feature Modules (Lazy Loaded)
│   │   │   ├── map/
│   │   │   │   ├── components/
│   │   │   │   │   ├── map-container/
│   │   │   │   │   │   ├── map-container.component.ts
│   │   │   │   │   │   ├── map-container.component.html
│   │   │   │   │   │   └── map-container.component.scss
│   │   │   │   │   ├── route-layer/
│   │   │   │   │   ├── waypoint-marker/
│   │   │   │   │   ├── nogo-areas/
│   │   │   │   │   ├── poi-markers/
│   │   │   │   │   └── elevation-profile/
│   │   │   │   ├── services/
│   │   │   │   │   └── routing.service.ts
│   │   │   │   └── map.routes.ts
│   │   │   │
│   │   │   ├── sidebar/
│   │   │   │   ├── components/
│   │   │   │   │   ├── sidebar-container/
│   │   │   │   │   ├── route-tab/
│   │   │   │   │   ├── profile-tab/
│   │   │   │   │   ├── layers-tab/
│   │   │   │   │   └── analysis-tab/
│   │   │   │   └── sidebar.routes.ts
│   │   │   │
│   │   │   ├── export/
│   │   │   │   ├── components/
│   │   │   │   │   ├── export-dialog/
│   │   │   │   │   └── format-selector/
│   │   │   │   └── export.routes.ts
│   │   │   │
│   │   │   ├── profile/
│   │   │   │   ├── components/
│   │   │   │   │   ├── profile-selector/
│   │   │   │   │   └── profile-editor/
│   │   │   │   └── profile.routes.ts
│   │   │   │
│   │   │   └── track-analysis/
│   │   │       ├── components/
│   │   │       │   ├── track-stats/
│   │   │       │   ├── track-messages/
│   │   │       │   └── itinerary/
│   │   │       └── track-analysis.routes.ts
│   │   │
│   │   ├── state/                   # Global State (Signals)
│   │   │   ├── route.state.ts
│   │   │   ├── map.state.ts
│   │   │   └── settings.state.ts
│   │   │
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   │
│   ├── assets/
│   │   ├── icons/
│   │   ├── images/
│   │   └── profiles/                # BRouter Profile-Dateien
│   │
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   │
│   ├── styles/
│   │   ├── tailwind.css
│   │   ├── leaflet-overrides.scss
│   │   └── variables.scss
│   │
│   └── locales/                     # i18n (migriert)
│       ├── de.json
│       ├── en.json
│       └── ... (20+ Sprachen)
│
├── angular.json
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── docker-compose.yml
```

---

## State Management mit Angular Signals

```typescript
// state/route.state.ts
import { Injectable, signal, computed } from '@angular/core';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
}

export interface RouteSegment {
  from: Waypoint;
  to: Waypoint;
  geojson: GeoJSON.Feature | null;
  loading: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class RouteState {
  // Signals
  readonly waypoints = signal<Waypoint[]>([]);
  readonly segments = signal<RouteSegment[]>([]);
  readonly selectedProfile = signal<string>('trekking');
  readonly alternativeIndex = signal<number>(0);

  // Computed
  readonly hasRoute = computed(() => this.segments().some(s => s.geojson !== null));
  readonly totalDistance = computed(() =>
    this.segments()
      .filter(s => s.geojson)
      .reduce((sum, s) => sum + this.getSegmentDistance(s), 0)
  );
  readonly totalAscent = computed(() => /* ... */);

  // Actions
  addWaypoint(wp: Waypoint) {
    this.waypoints.update(wps => [...wps, wp]);
  }

  removeWaypoint(id: string) {
    this.waypoints.update(wps => wps.filter(w => w.id !== id));
  }

  updateSegment(index: number, geojson: GeoJSON.Feature) {
    this.segments.update(segs =>
      segs.map((s, i) => i === index ? { ...s, geojson, loading: false } : s)
    );
  }

  clearRoute() {
    this.waypoints.set([]);
    this.segments.set([]);
  }

  private getSegmentDistance(segment: RouteSegment): number {
    // Extract from geojson properties
    return segment.geojson?.properties?.['track-length'] ?? 0;
  }
}
```

---

## BRouter Service

```typescript
// core/services/brouter/brouter.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { BRouterRequest, BRouterResponse, LatLng } from './brouter.types';

@Injectable({ providedIn: 'root' })
export class BRouterService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.brouterUrl;

  getRoute(request: BRouterRequest): Observable<GeoJSON.FeatureCollection> {
    const url = this.buildUrl(request);

    return this.http.get<GeoJSON.FeatureCollection>(url).pipe(
      catchError(this.handleError)
    );
  }

  uploadProfile(profileContent: string): Observable<string> {
    return this.http.post<{ profileId: string }>(
      `${this.baseUrl}/profile`,
      profileContent,
      { headers: { 'Content-Type': 'text/plain' } }
    ).pipe(
      map(res => res.profileId)
    );
  }

  private buildUrl(request: BRouterRequest): string {
    const { waypoints, profile, alternativeIdx, format = 'geojson' } = request;

    const lonlats = waypoints
      .map(wp => `${wp.lng.toFixed(6)},${wp.lat.toFixed(6)}`)
      .join('|');

    const params = new URLSearchParams({
      lonlats,
      profile,
      alternativeidx: String(alternativeIdx ?? 0),
      format
    });

    if (request.nogos?.length) {
      params.set('nogos', this.formatNogos(request.nogos));
    }

    if (request.straightIndices?.length) {
      params.set('straight', request.straightIndices.join(','));
    }

    return `${this.baseUrl}/brouter?${params}`;
  }

  private formatNogos(nogos: NogoArea[]): string {
    return nogos
      .map(n => `${n.lng},${n.lat},${n.radius}`)
      .join('|');
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message || error.message || 'Unknown error';
    return throwError(() => new Error(`BRouter Error: ${message}`));
  }
}
```

---

## Map Component mit ngx-leaflet

```typescript
// features/map/components/map-container/map-container.component.ts
import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import * as L from 'leaflet';
import { RouteState } from '@app/state/route.state';
import { MapState } from '@app/state/map.state';
import { RoutingService } from '../../services/routing.service';
import { RouteLayerComponent } from '../route-layer/route-layer.component';
import { WaypointMarkerComponent } from '../waypoint-marker/waypoint-marker.component';

@Component({
  selector: 'app-map-container',
  standalone: true,
  imports: [CommonModule, LeafletModule, RouteLayerComponent, WaypointMarkerComponent],
  template: `
    <div class="h-full w-full relative">
      <div
        leaflet
        [leafletOptions]="mapOptions"
        [leafletLayers]="layers()"
        (leafletMapReady)="onMapReady($event)"
        (leafletClick)="onMapClick($event)"
        class="h-full w-full">
      </div>

      @if (routeState.hasRoute()) {
        <app-route-layer [segments]="routeState.segments()" />
      }

      @for (wp of routeState.waypoints(); track wp.id) {
        <app-waypoint-marker
          [waypoint]="wp"
          (dragEnd)="onWaypointDrag($event)"
          (remove)="onWaypointRemove($event)" />
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `]
})
export class MapContainerComponent implements OnInit {
  readonly routeState = inject(RouteState);
  readonly mapState = inject(MapState);
  private readonly routingService = inject(RoutingService);

  private map: L.Map | null = null;

  readonly mapOptions: L.MapOptions = {
    center: [50.0, 10.0],
    zoom: 6,
    zoomControl: true
  };

  readonly layers = signal<L.Layer[]>([
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    })
  ]);

  constructor() {
    // React to waypoint changes
    effect(() => {
      const waypoints = this.routeState.waypoints();
      if (waypoints.length >= 2) {
        this.routingService.calculateRoute();
      }
    });
  }

  ngOnInit() {}

  onMapReady(map: L.Map) {
    this.map = map;
    this.mapState.setMap(map);
  }

  onMapClick(event: L.LeafletMouseEvent) {
    if (this.mapState.isDrawMode()) {
      this.routeState.addWaypoint({
        id: crypto.randomUUID(),
        lat: event.latlng.lat,
        lng: event.latlng.lng
      });
    }
  }

  onWaypointDrag(event: { id: string; latlng: L.LatLng }) {
    this.routeState.updateWaypointPosition(event.id, event.latlng);
  }

  onWaypointRemove(id: string) {
    this.routeState.removeWaypoint(id);
  }
}
```

---

## Migrations-Phasen

### Phase 0: Projekt-Setup (1-2 Wochen)

```bash
# Angular Projekt erstellen
ng new velo-router-modern --standalone --style=scss --routing

# Abhängigkeiten installieren
npm install @asymmetrik/ngx-leaflet leaflet @types/leaflet
npm install @ngx-translate/core @ngx-translate/http-loader
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init

# Bestehende Dateien kopieren
cp -r locales/ src/assets/locales/
cp -r profiles/ src/assets/profiles/
```

**Deliverables:**
- [ ] Angular 17+ Projekt mit Standalone Components
- [ ] Tailwind CSS konfiguriert
- [ ] ngx-leaflet integriert
- [ ] i18n Setup mit bestehenden Übersetzungen
- [ ] CI/CD Pipeline (GitHub Actions)

---

### Phase 1: Core Services (3-4 Wochen)

**Zu migrieren:**

| Legacy | Angular Service |
|--------|----------------|
| `js/router/BRouter.js` | `BRouterService` |
| `js/format/Gpx.js` | `GpxFormatterService` |
| `js/format/Kml.js` | `KmlFormatterService` |
| `js/format/Fit.js` | `FitFormatterService` |
| `js/util/CheapRuler.js` | `utils/geo/cheap-ruler.ts` |
| `js/LayersConfig.js` | `LayersService` |

**Deliverables:**
- [ ] BRouterService mit vollständiger API-Abdeckung
- [ ] Alle Format-Services mit TypeScript-Typen
- [ ] Unit Tests für alle Services (>80% Coverage)
- [ ] Geo-Utilities migriert

---

### Phase 2: State & Shared Components (2-3 Wochen)

**State Management:**
- [ ] `RouteState` (Waypoints, Segments, Profile)
- [ ] `MapState` (Zoom, Center, Layers, DrawMode)
- [ ] `SettingsState` (Preferences, Language)

**Shared Components:**
- [ ] Button, Modal, Toast, LoadingSpinner
- [ ] Tailwind-basiertes Design System
- [ ] Accessibility (a11y) konform

---

### Phase 3: Feature Components (6-8 Wochen)

**Reihenfolge nach Komplexität:**

1. **Track Stats** (1 Woche)
   - Einfachste Komponente
   - Keine Map-Interaktion

2. **Export Dialog** (1 Woche)
   - Format-Services verwenden
   - Download-Logik

3. **Profile Selector** (1 Woche)
   - Dropdown mit Profile-Liste
   - Custom Profile Upload

4. **Sidebar** (2 Wochen)
   - Tab-basiertes Layout
   - Route/Profile/Layers/Analysis Tabs

5. **Elevation Profile** (1 Woche)
   - Chart-Komponente (ngx-charts oder Chart.js)
   - Interaktive Hover-Markierung

6. **Map Container** (2 Wochen)
   - ngx-leaflet Integration
   - Layer-Management
   - Click/Drag-Handling

7. **Routing** (2 Wochen)
   - Waypoint-Management
   - Segment-Berechnung
   - Route-Visualisierung

---

### Phase 4: Integration & Testing (3-4 Wochen)

- [ ] E2E Tests mit Playwright
- [ ] Performance-Optimierung
- [ ] Bundle-Analyse
- [ ] Accessibility-Audit

---

### Phase 5: Legacy-Entfernung (2 Wochen)

- [ ] jQuery entfernen
- [ ] Bootstrap entfernen
- [ ] Gulp-Build entfernen
- [ ] Alte JS-Dateien archivieren

---

## Datei-Migrations-Mapping

| Legacy-Datei | Angular-Ziel | Priorität |
|--------------|--------------|-----------|
| `js/index.js` | `app.component.ts` | Hoch |
| `js/router/BRouter.js` | `core/services/brouter/` | Hoch |
| `js/plugin/Routing.js` | `features/map/services/routing.service.ts` | Hoch |
| `js/control/Export.js` | `features/export/` | Mittel |
| `js/control/Profile.js` | `features/profile/` | Mittel |
| `js/control/TrackStats.js` | `features/track-analysis/` | Niedrig |
| `js/format/*.js` | `core/services/formats/` | Hoch |
| `js/util/CheapRuler.js` | `shared/utils/geo/` | Hoch |
| `js/plugin/Sidebar.js` | `features/sidebar/` | Mittel |
| `js/plugin/Heightgraph.js` | `features/map/components/elevation-profile/` | Mittel |

---

## Testing-Strategie

```
         /\
        /  \
       / E2E \     5-10 Tests (Playwright)
      /--------\
     /Integration\  20-30 Tests (Testing Library)
    /--------------\
   /     Unit       \ 100+ Tests (Jest)
  /------------------\
```

**Test-Beispiel:**

```typescript
// brouter.service.spec.ts
describe('BRouterService', () => {
  let service: BRouterService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BRouterService]
    });
    service = TestBed.inject(BRouterService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should build correct URL for route request', () => {
    const request: BRouterRequest = {
      waypoints: [
        { lat: 49.488, lng: 8.467 },
        { lat: 49.489, lng: 8.468 }
      ],
      profile: 'trekking',
      alternativeIdx: 0
    };

    service.getRoute(request).subscribe();

    const req = httpMock.expectOne(r => r.url.includes('/brouter'));
    expect(req.request.url).toContain('lonlats=8.467000,49.488000|8.468000,49.489000');
  });
});
```

---

## Zeitplan

| Phase | Dauer | Kumulativ |
|-------|-------|-----------|
| Phase 0: Setup | 2 Wochen | 2 Wochen |
| Phase 1: Core Services | 4 Wochen | 6 Wochen |
| Phase 2: State & Shared | 3 Wochen | 9 Wochen |
| Phase 3: Features | 8 Wochen | 17 Wochen |
| Phase 4: Integration | 4 Wochen | 21 Wochen |
| Phase 5: Legacy-Entfernung | 2 Wochen | 23 Wochen |

**Geschätzte Gesamtdauer: ~6 Monate** (1-2 Entwickler)

---

## Nächste Schritte

1. **Heute:** Angular-Projekt initialisieren
2. **Diese Woche:** Tailwind + ngx-leaflet Setup
3. **Nächste 2 Wochen:** BRouterService implementieren
4. **Erster Monat:** Basis-Map mit Waypoints anzeigen

---

## Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| Geforkete Leaflet-Plugins | Custom Angular-Direktiven erstellen |
| Performance-Regression | Lighthouse-Benchmarks in CI |
| Feature-Parität | Detaillierte Feature-Checkliste |
| ngx-leaflet Einschränkungen | Direkter Leaflet-Zugriff wenn nötig |

---

## Referenzen

- [Angular Standalone Components](https://angular.io/guide/standalone-components)
- [Angular Signals](https://angular.io/guide/signals)
- [ngx-leaflet](https://github.com/Asymmetrik/ngx-leaflet)
- [BRouter API](https://github.com/abrensch/brouter)