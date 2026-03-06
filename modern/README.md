# VeloRouter Modern

Angular 17+ frontend for BRouter bike route planning.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- ~500MB disk space for Germany routing data

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Download Routing Data

```bash
# Download Germany region (~400MB)
./scripts/download-segments.sh germany
```

Segment files are downloaded from [brouter.de](https://brouter.de/brouter/segments4/).

### 3. Start BRouter Backend

```bash
docker-compose -f docker-compose.dev.yml up -d
```

BRouter will be available at http://localhost:17777

### 4. Start Angular Dev Server

```bash
npm start
```

Open http://localhost:4200

## Project Structure

```
src/app/
├── core/services/         # Singleton services (BRouter API, Formats)
├── features/              # Feature modules (Map, Sidebar, Export)
├── shared/                # Shared components & utilities
├── state/                 # Angular Signals state management
└── app.component.ts       # Root component
```

## Development

```bash
# Start dev server with hot reload
npm start

# Build for production
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Docker Deployment

```bash
# Build and run everything
docker-compose up --build

# Frontend: http://localhost:8080
# BRouter:  http://localhost:17777
```

## Tech Stack

- **Framework:** Angular 17 (Standalone Components)
- **Styling:** Tailwind CSS
- **Maps:** Leaflet + ngx-leaflet
- **State:** Angular Signals
- **Backend:** BRouter routing engine

## Resources

- [BRouter GitHub](https://github.com/abrensch/brouter)
- [BRouter Docker Image](https://github.com/abrensch/brouter/pkgs/container/brouter)
- [Segment Files](https://brouter.de/brouter/segments4/)
- [ngx-leaflet](https://github.com/Asymmetrik/ngx-leaflet)
