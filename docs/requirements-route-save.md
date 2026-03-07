# Anforderungs-Dokumentation: Route Speichern & Laden

## Zusammenfassung der Entscheidungen

| Aspekt | Entscheidung |
|--------|--------------|
| **Zu speichernde Daten** | Wegpunkte, Routing-Profil, Kartenebene, UI-Einstellungen (Höhenprofil, Overlays, Regionen) |
| **Dateiformat** | JSON mit `.velo` Endung |
| **Speicher-Technik** | File System Access API (direktes Überschreiben) |
| **Auto-Save** | Checkbox in Einstellungen (abwählbar) |
| **Datei-Verwaltung** | Keine Liste, aber Umbenennen/Löschen/Duplizieren möglich |
| **Ungespeicherte Änderungen** | Warnung NUR wenn bereits eine Datei geöffnet/gespeichert wurde |
| **Workflow** | Projekt-basiert (Dateiname in Titelleiste) |
| **Optionalität** | **Feature ist komplett optional - App funktioniert ohne Speichern wie bisher** |

---

## Wichtig: Optionales Feature

Das Speichern ist ein **Opt-in Feature**:

- App funktioniert ohne Speichern genau wie bisher
- Keine aufdringlichen "Speichern?"-Dialoge für Nutzer die das Feature nicht nutzen
- Warnung beim Verlassen NUR wenn Nutzer bereits einmal gespeichert hat (File Handle existiert)
- Status-Anzeige dezent (kein "Neue Route*" wenn nie gespeichert wurde)
- Menü-Einträge vorhanden aber nicht aufdringlich

---

## User Stories

### US-1: Route erstmalig speichern
Als Nutzer möchte ich meine geplante Route mit allen Einstellungen als Datei speichern können, damit ich später genau dort weiterarbeiten kann, wo ich aufgehört habe.

### US-2: Gespeicherte Route öffnen
Als Nutzer möchte ich eine zuvor gespeicherte .velo-Datei öffnen können, damit der komplette Arbeitszustand wiederhergestellt wird.

### US-3: Änderungen speichern
Als Nutzer möchte ich Änderungen an einer geöffneten Route speichern können, ohne jedes Mal den Speicherort wählen zu müssen.

### US-4: Route unter neuem Namen speichern
Als Nutzer möchte ich eine Route unter einem neuen Namen speichern können, um Varianten zu erstellen.

### US-5: Neue Route beginnen
Als Nutzer möchte ich eine neue Route beginnen können, während eine andere geöffnet ist.

### US-6: Automatisches Speichern
Als Nutzer möchte ich Auto-Save aktivieren können, damit meine Arbeit automatisch gesichert wird.

### US-7: Warnung bei Datenverlust
Als Nutzer möchte ich gewarnt werden, wenn ich ungespeicherte Änderungen habe und den Tab schließe.

### US-8: Aktuellen Status erkennen
Als Nutzer möchte ich sehen, welche Datei gerade geöffnet ist und ob es ungespeicherte Änderungen gibt.

---

## Dateiformat (.velo)

```json
{
  "version": "1.0",
  "created": "2026-03-07T10:30:00Z",
  "modified": "2026-03-07T14:22:00Z",
  "name": "Optionaler Routenname",
  "route": {
    "waypoints": [
      {"lat": 48.1351, "lng": 11.5820, "name": "optional"}
    ],
    "profile": "trekking-bike"
  },
  "map": {
    "layer": "OpenTopoMap",
    "center": {"lat": 48.17, "lng": 13.95},
    "zoom": 10
  },
  "ui": {
    "elevationProfileOpen": true,
    "activeOverlays": ["hiking-routes", "hillshading"],
    "loadedRegions": [
      {"id": "relation/123", "name": "Schwarzwald", "visible": true}
    ]
  }
}
```

---

## UI-Komponenten

### 1. Menü / Toolbar

```
📄 Datei
  ├─ Neue Route           (Ctrl+N)
  ├─ Öffnen...            (Ctrl+O)
  ├─ Speichern            (Ctrl+S)
  └─ Speichern unter...   (Ctrl+Shift+S)
```

### 2. Status-Anzeige (Header)

- `📁 bodensee-tour.velo` (gespeichert)
- `📁 bodensee-tour.velo*` (ungespeicherte Änderungen)
- `Neue Route*` (noch nie gespeichert)

### 3. Einstellungen

```
Route-Verwaltung
  ☐ Auto-Speichern aktivieren
  Speicher-Intervall: [30] Sekunden
```

### 4. Dialoge

**Ungespeicherte Änderungen:**
```
⚠️ Ungespeicherte Änderungen
Die aktuelle Route hat ungespeicherte Änderungen.
[Speichern]  [Verwerfen]  [Abbrechen]
```

---

## Technische Anforderungen

### State-Erweiterung

```typescript
interface FileState {
  handle: FileSystemFileHandle | null;
  name: string | null;
  isDirty: boolean;
  lastSaved: Date | null;
}

interface Settings {
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // Sekunden
}
```

### Browser-Kompatibilität

| Browser | File System Access API | Fallback |
|---------|------------------------|----------|
| Chrome/Edge 86+ | ✅ Voll | - |
| Firefox | ⚠️ Experimentell | Download |
| Safari | ❌ Nicht unterstützt | Download |

### Dirty-State Trigger

Auto-Save / Dirty-Flag bei:
- Wegpunkt hinzugefügt/entfernt/verschoben
- Routing-Profil gewechselt
- Kartenebene gewechselt
- Höhenprofil ein/ausgeklappt
- Overlay aktiviert/deaktiviert
- Region geladen/entfernt

---

## Akzeptanzkriterien

### Grundfunktionalität
- [ ] Route als .velo speichern
- [ ] .velo-Datei laden
- [ ] Alle Einstellungen nach Laden wiederhergestellt
- [ ] Datei ist gültiges, lesbares JSON

### Projekt-Workflow
- [ ] Status-Anzeige zeigt Dateinamen
- [ ] Asterisk (*) bei Änderungen
- [ ] "Speichern" ohne Dialog bei geöffneter Route
- [ ] "Neue Route" setzt App zurück

### Auto-Save
- [ ] Checkbox in Einstellungen
- [ ] Änderungen werden automatisch gespeichert
- [ ] Nur bei geöffneter Route (nicht bei "Neue Route")

### Datenverlust-Prävention
- [ ] Warnung beim Schließen (wenn Auto-Save aus)
- [ ] Keine Warnung bei Auto-Save an
- [ ] Dialog bei "Öffnen"/"Neue Route" mit Änderungen

---

## Priorisierung

### MVP (Must-Have)
1. Speichern / Öffnen / Speichern unter
2. Dirty-State-Management
3. Status-Anzeige
4. Menü-Integration

### Phase 2 (Should-Have)
1. Auto-Save
2. Warnung bei Datenverlust
3. Einstellungen-Panel

### Backlog (Nice-to-Have)
1. Drag & Drop
2. Recent Files Liste
3. Dateiname inline editieren

---

**Erstellt:** 2026-03-07
**Status:** Final - Bereit für Implementierung
