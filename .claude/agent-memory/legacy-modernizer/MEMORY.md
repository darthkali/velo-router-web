# VeloRouter-Web Modernization Memory

## Project Overview
- **Name**: brouter-web (VeloRouter fork)
- **Purpose**: Web client for BRouter bike routing engine
- **Version**: 0.18.1
- **License**: MIT

## Current Tech Stack (Legacy)
- **Build**: Gulp 4.0.2, Babel 7.22.5
- **UI Framework**: jQuery 3.6.4 + Bootstrap 4.6.2
- **Mapping**: Leaflet 1.7.1 + 15+ Leaflet plugins
- **i18n**: i18next 19.9.2 (20+ languages)
- **Testing**: Jest 29.1.2 (minimal coverage)
- **No TypeScript, no modern bundler**

## Architecture Patterns Identified
- Global namespace pollution (`BR.`, `L.` objects)
- Leaflet class extension pattern for all components
- Event-driven communication via L.Evented
- jQuery DOM manipulation throughout
- IIFE (Immediately Invoked Function Expression) structure
- No module system (global concatenation)

## Key Files Structure
- `js/index.js` - App bootstrap and wiring
- `js/Map.js` - Map initialization
- `js/Browser.js` - Browser feature detection
- `js/router/BRouter.js` - Backend API communication
- `js/plugin/Routing.js` - Core routing logic
- `js/control/*.js` - UI controls (13 files)
- `js/plugin/*.js` - Features (14 files)
- `js/format/*.js` - File format handlers (6 files)

## Critical Dependencies
- leaflet-routing (forked: nrenner/leaflet-routing)
- leaflet-sidebar-v2 (forked: nrenner/leaflet-sidebar-v2)
- leaflet.heightgraph (forked)
- fit-file-writer (forked)
- togpx (forked)
- Many forks indicate customizations that need preservation

## Migration Risks
- Heavy Leaflet plugin ecosystem dependency
- Custom forks of multiple libraries
- Global state management via BR.conf
- No clear separation of concerns
- Tight coupling between components
