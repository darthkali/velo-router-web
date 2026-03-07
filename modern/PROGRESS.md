# VeloRouter Modernisierung - Fortschrittsbericht

**Datum:** 2026-03-07
**Status:** In Arbeit

## Abgeschlossene Phasen

### Phase 0: Projekt-Setup ✅

- Angular 17+ mit Standalone Components
- Tailwind CSS konfiguriert
- ngx-leaflet integriert
- TypeScript 5 (strict mode)
- 22 Lokalisierungsdateien migriert

### Phase 1: Core Services ✅

**BRouterService** (`src/app/core/services/brouter/`)
- TypeScript-Typen für alle BRouter-Entitäten
- HTTP-Client für Route-Berechnung
- Profil-Upload Funktion
- URL-Builder für alle API-Parameter

**State Management** (`src/app/state/`)
- `RouteState`: Waypoints, Segments, Profile, computed stats
- `MapState`: Center, Zoom, DrawMode, Layers

### Phase 2: Map & Routing ✅

**MapContainerComponent**
- Leaflet-Map mit OpenStreetMap Tiles
- Click-Handler für Waypoint-Hinzufügen
- Automatische Route-Visualisierung
- Loading-Indicator während Berechnung
- Draw-Mode-Indikator

**RoutingService**
- Automatische Routenberechnung bei Waypoint-Änderungen
- Parallele Segment-Berechnung
- Debounced Requests (300ms)
- Fehlerbehandlung

## Aktuelle Dateien

```
modern/src/app/
├── core/
│   └── services/
│       ├── brouter/
│       │   ├── brouter.service.ts      # BRouter API Client
│       │   └── brouter.types.ts        # TypeScript Interfaces + Profile
│       └── export/
│           └── export.service.ts       # GPX/KML/GeoJSON Export
├── features/
│   ├── map/
│   │   ├── components/
│   │   │   └── map-container/
│   │   │       └── map-container.component.ts  # Draggable Markers
│   │   └── services/
│   │       └── routing.service.ts      # Version-aware Routing
│   └── sidebar/
│       └── components/
│           ├── export-dialog/
│           │   └── export-dialog.component.ts
│           └── profile-selector/
│               └── profile-selector.component.ts
├── state/
│   ├── route.state.ts                  # Smart Segment Management
│   └── map.state.ts                    # Map State (Signals)
├── app.component.ts                    # Root mit Export-Dialog
└── app.config.ts                       # App Configuration
```

## Konfiguration

**Backend:**
- Development: `https://brouter.de` (öffentlicher Server)
- Production: Eigener Docker-Container

**Docker-Dateien:**
- `docker-compose.dev.yml` - Nur BRouter
- `docker-compose.yml` - BRouter + Angular
- `Dockerfile` - Angular Production Build
- `nginx.conf` - Reverse Proxy Konfiguration

**Routing-Daten:**
- 8 Segment-Dateien für Deutschland heruntergeladen (~1.1 GB)
- Verzeichnis: `data/segments4/`

## Kürzlich implementiert

### Smart Segment Management ✅
- Versionierung für Segmente zur Verhinderung veralteter Updates
- Nur betroffene Segmente werden bei Waypoint-Änderungen neu berechnet
- Keine Route-Fragmente mehr durch saubere Segment-Verwaltung
- Kein Flackern mehr durch Version-Tracking

### Drag & Drop Waypoints ✅
- Ziehbare Marker mit Custom Icons (S/E/Nummern)
- Position-Updates lösen nur benachbarte Segmente aus
- Popup mit Koordinaten und Remove-Button

### Visuelle Indikatoren ✅
- Orange animierte gestrichelte Linie während Berechnung
- Rote gestrichelte Linie bei Fehler
- Solide blaue Linie für berechnete Route

### Export-Funktionalität ✅
- **ExportService** (`src/app/core/services/export/export.service.ts`)
  - GPX-Export mit Metadaten und Stats-Kommentar
  - KML-Export für Google Earth
  - GeoJSON-Export für Web-Mapping
- **Export-Dialog** (`src/app/features/sidebar/components/export-dialog/`)
  - Modaler Dialog mit Format-Auswahl
  - Dateiname-Eingabe
  - Route-Statistiken Vorschau

### Profile ✅
- 8 Profile verfügbar:
  - Trekking, Quaelnix Gravel, Gravel, Fast Bike
  - Trekking Steep, MTB, Safety, Shortest
- Profile-Selector mit Beschreibungen
- Profile-Dateien in `data/profiles2/`

### Bug-Fixes ✅
- Berechnung von Distance/Ascent/Time korrigiert (große Zahlen-Bug)
- Proper Number-Parsing für String/Number Properties

## Offene Aufgaben

### Elevation Profile ⏳
- [ ] SVG-basiertes Höhenprofil
- [ ] Interaktive Hover-Informationen

### Weitere Features ⏳
- [ ] Sidebar mit Waypoint-Liste
- [ ] POI-Suche
- [ ] Track-Import (GPX)
- [ ] Rundtour-Planer

### Task 7: Tests ⏳
- [ ] Unit Tests für BRouterService
- [ ] Unit Tests für RoutingService
- [ ] Unit Tests für State Management
- [ ] E2E Tests für kritische Flows

## So startest du das Projekt

```bash
cd modern

# Dependencies installieren
npm install

# Dev Server starten
npm start

# Browser öffnen
open http://localhost:4200
```

## So testest du die Route

1. Klicke auf "Draw Route"
2. Klicke auf die Karte (im Raum Deutschland)
3. Klicke erneut für weiteren Wegpunkt
4. Route wird automatisch berechnet
5. Statistiken werden in der Footer-Leiste angezeigt

## Nächste Session

Empfohlene Prioritäten:
1. Elevation Profile Komponente
2. Sidebar mit Waypoint-Management
3. Track-Import (GPX laden)
4. Unit Tests für Core Services
