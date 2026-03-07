import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteState } from '../../../../state/route.state';
import { RouteSegment } from '../../../../core/services/brouter/brouter.types';

/**
 * Elevation data point with cumulative distance and elevation
 */
interface ElevationPoint {
  distance: number; // cumulative distance in meters
  elevation: number; // elevation in meters
  lat: number;
  lng: number;
}

/**
 * Chart dimensions and padding configuration
 */
interface ChartDimensions {
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  plotWidth: number;
  plotHeight: number;
}

/**
 * Hover state for showing tooltip
 */
interface HoverState {
  x: number;
  y: number;
  distance: number;
  elevation: number;
  visible: boolean;
}

/**
 * Elevation profile chart component
 *
 * Displays an SVG line chart of the route elevation profile.
 * Features:
 * - X-axis: cumulative distance (km)
 * - Y-axis: elevation (m)
 * - Gradient fill under the line
 * - Min/max elevation labels
 * - Interactive hover showing distance/elevation
 * - Responsive width, fixed height
 */
@Component({
  selector: 'app-elevation-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      [class.hidden]="!hasElevationData()">
      <!-- Header -->
      <div class="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700">Elevation Profile</span>
        <div class="text-xs text-gray-500 flex gap-3">
          @if (stats()) {
            <span>
              <span class="text-gray-400">Min:</span>
              {{ stats()!.minElevation | number:'1.0-0' }} m
            </span>
            <span>
              <span class="text-gray-400">Max:</span>
              {{ stats()!.maxElevation | number:'1.0-0' }} m
            </span>
            <span>
              <span class="text-gray-400">Gain:</span>
              {{ stats()!.totalAscent | number:'1.0-0' }} m
            </span>
          }
        </div>
      </div>

      <!-- Chart Container -->
      <div
        #chartContainer
        class="relative w-full cursor-crosshair"
        [style.height.px]="chartHeight"
        (mousemove)="onMouseMove($event)"
        (mouseleave)="onMouseLeave()">

        <!-- SVG Chart -->
        <svg
          [attr.width]="dimensions().width"
          [attr.height]="dimensions().height"
          class="block">

          <!-- Gradient definition -->
          <defs>
            <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05" />
            </linearGradient>
          </defs>

          <!-- Y-axis grid lines -->
          @for (gridLine of yGridLines(); track gridLine.value) {
            <line
              [attr.x1]="dimensions().paddingLeft"
              [attr.y1]="gridLine.y"
              [attr.x2]="dimensions().width - dimensions().paddingRight"
              [attr.y2]="gridLine.y"
              stroke="#e5e7eb"
              stroke-width="1"
              stroke-dasharray="4,4" />
            <text
              [attr.x]="dimensions().paddingLeft - 4"
              [attr.y]="gridLine.y + 4"
              text-anchor="end"
              class="text-[10px] fill-gray-400">
              {{ gridLine.label }}
            </text>
          }

          <!-- X-axis grid lines -->
          @for (gridLine of xGridLines(); track gridLine.value) {
            <line
              [attr.x1]="gridLine.x"
              [attr.y1]="dimensions().paddingTop"
              [attr.x2]="gridLine.x"
              [attr.y2]="dimensions().height - dimensions().paddingBottom"
              stroke="#e5e7eb"
              stroke-width="1"
              stroke-dasharray="4,4" />
            <text
              [attr.x]="gridLine.x"
              [attr.y]="dimensions().height - dimensions().paddingBottom + 14"
              text-anchor="middle"
              class="text-[10px] fill-gray-400">
              {{ gridLine.label }}
            </text>
          }

          <!-- Filled area under the line -->
          @if (areaPath()) {
            <path
              [attr.d]="areaPath()"
              fill="url(#elevationGradient)" />
          }

          <!-- Elevation line -->
          @if (linePath()) {
            <path
              [attr.d]="linePath()"
              fill="none"
              stroke="#3b82f6"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round" />
          }

          <!-- Hover indicator -->
          @if (hoverState().visible) {
            <!-- Vertical line -->
            <line
              [attr.x1]="hoverState().x"
              [attr.y1]="dimensions().paddingTop"
              [attr.x2]="hoverState().x"
              [attr.y2]="dimensions().height - dimensions().paddingBottom"
              stroke="#6b7280"
              stroke-width="1"
              stroke-dasharray="3,3" />
            <!-- Point circle -->
            <circle
              [attr.cx]="hoverState().x"
              [attr.cy]="hoverState().y"
              r="5"
              fill="#3b82f6"
              stroke="white"
              stroke-width="2" />
          }
        </svg>

        <!-- Hover tooltip -->
        @if (hoverState().visible) {
          <div
            class="absolute pointer-events-none bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10"
            [style.left.px]="tooltipPosition().x"
            [style.top.px]="tooltipPosition().y"
            [style.transform]="tooltipPosition().transform">
            <div class="font-medium">{{ formatDistance(hoverState().distance) }}</div>
            <div class="text-gray-300">{{ hoverState().elevation | number:'1.0-0' }} m</div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class ElevationChartComponent implements OnDestroy {
  private readonly routeState = inject(RouteState);
  private readonly chartContainer = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

  /** Fixed chart height */
  readonly chartHeight = 150;

  /** Internal chart width signal updated on resize */
  private readonly chartWidth = signal(400);

  /** Hover state for tooltip display */
  readonly hoverState = signal<HoverState>({
    x: 0,
    y: 0,
    distance: 0,
    elevation: 0,
    visible: false,
  });

  /** ResizeObserver for responsive width */
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Setup ResizeObserver when container is available
    effect(() => {
      const container = this.chartContainer();
      if (container) {
        this.setupResizeObserver(container.nativeElement);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Extract elevation points from all route segments
   */
  readonly elevationPoints = computed<ElevationPoint[]>(() => {
    const segments = this.routeState.segments();
    return this.extractElevationPoints(segments);
  });

  /**
   * Check if we have elevation data to display
   */
  readonly hasElevationData = computed(() => this.elevationPoints().length > 1);

  /**
   * Statistics about the elevation profile
   */
  readonly stats = computed(() => {
    const points = this.elevationPoints();
    if (points.length === 0) return null;

    const elevations = points.map((p) => p.elevation);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const totalDistance = points[points.length - 1]?.distance ?? 0;
    const totalAscent = this.routeState.totalAscent();

    return {
      minElevation,
      maxElevation,
      totalDistance,
      totalAscent,
    };
  });

  /**
   * Chart dimensions with padding
   */
  readonly dimensions = computed<ChartDimensions>(() => {
    const width = this.chartWidth();
    const height = this.chartHeight;
    const paddingTop = 10;
    const paddingBottom = 25;
    const paddingLeft = 45;
    const paddingRight = 15;

    return {
      width,
      height,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      plotWidth: width - paddingLeft - paddingRight,
      plotHeight: height - paddingTop - paddingBottom,
    };
  });

  /**
   * Y-axis scale based on elevation range
   */
  private readonly yScale = computed(() => {
    const points = this.elevationPoints();
    if (points.length === 0) {
      return { min: 0, max: 100, range: 100 };
    }

    const elevations = points.map((p) => p.elevation);
    const dataMin = Math.min(...elevations);
    const dataMax = Math.max(...elevations);

    // Add some padding to the range (10%)
    const range = dataMax - dataMin || 100;
    const padding = range * 0.1;
    const min = Math.floor((dataMin - padding) / 10) * 10;
    const max = Math.ceil((dataMax + padding) / 10) * 10;

    return {
      min: Math.max(0, min), // Don't go below 0
      max,
      range: max - Math.max(0, min),
    };
  });

  /**
   * X-axis scale based on distance
   */
  private readonly xScale = computed(() => {
    const points = this.elevationPoints();
    if (points.length === 0) {
      return { min: 0, max: 1000, range: 1000 };
    }

    const maxDistance = points[points.length - 1].distance;
    return {
      min: 0,
      max: maxDistance,
      range: maxDistance || 1000,
    };
  });

  /**
   * Y-axis grid lines
   */
  readonly yGridLines = computed(() => {
    const scale = this.yScale();
    // Access dimensions to ensure dependency tracking
    this.dimensions();

    // Calculate nice grid intervals
    const numLines = 4;
    const rawInterval = scale.range / numLines;
    const niceInterval = this.niceNumber(rawInterval);

    const lines: { value: number; y: number; label: string }[] = [];
    const startValue = Math.ceil(scale.min / niceInterval) * niceInterval;

    for (let value = startValue; value <= scale.max; value += niceInterval) {
      const y = this.elevationToY(value);
      lines.push({
        value,
        y,
        label: `${Math.round(value)}`,
      });
    }

    return lines;
  });

  /**
   * X-axis grid lines
   */
  readonly xGridLines = computed(() => {
    const scale = this.xScale();
    // Access dimensions to ensure dependency tracking
    this.dimensions();

    // Calculate nice grid intervals in km
    const numLines = 5;
    const rangeKm = scale.range / 1000;
    const rawInterval = rangeKm / numLines;
    const niceInterval = this.niceNumber(rawInterval);

    const lines: { value: number; x: number; label: string }[] = [];
    const intervalMeters = niceInterval * 1000;

    for (let value = 0; value <= scale.max; value += intervalMeters) {
      const x = this.distanceToX(value);
      lines.push({
        value,
        x,
        label: this.formatDistanceShort(value),
      });
    }

    return lines;
  });

  /**
   * SVG path for the elevation line
   */
  readonly linePath = computed(() => {
    const points = this.elevationPoints();
    if (points.length < 2) return '';

    const pathParts = points.map((point, index) => {
      const x = this.distanceToX(point.distance);
      const y = this.elevationToY(point.elevation);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    });

    return pathParts.join(' ');
  });

  /**
   * SVG path for the filled area under the line
   */
  readonly areaPath = computed(() => {
    const points = this.elevationPoints();
    if (points.length < 2) return '';

    const dims = this.dimensions();
    const baseY = dims.height - dims.paddingBottom;

    // Start from bottom-left
    const firstX = this.distanceToX(points[0].distance);
    let path = `M ${firstX} ${baseY}`;

    // Draw up to first point, then along the line
    points.forEach((point) => {
      const x = this.distanceToX(point.distance);
      const y = this.elevationToY(point.elevation);
      path += ` L ${x} ${y}`;
    });

    // Close path back to bottom
    const lastX = this.distanceToX(points[points.length - 1].distance);
    path += ` L ${lastX} ${baseY} Z`;

    return path;
  });

  /**
   * Tooltip position (adjusted to stay within bounds)
   */
  readonly tooltipPosition = computed(() => {
    const hover = this.hoverState();
    const dims = this.dimensions();

    // Position tooltip above the point by default
    let x = hover.x;
    let y = hover.y - 35;
    let transform = 'translateX(-50%)';

    // Adjust if too close to edges
    if (hover.x < 60) {
      x = hover.x + 10;
      transform = 'translateX(0)';
    } else if (hover.x > dims.width - 60) {
      x = hover.x - 10;
      transform = 'translateX(-100%)';
    }

    // Keep tooltip above chart if point is near top
    if (y < 5) {
      y = hover.y + 25;
    }

    return { x, y, transform };
  });

  /**
   * Handle mouse move over chart
   */
  onMouseMove(event: MouseEvent): void {
    const container = this.chartContainer();
    if (!container) return;

    const rect = container.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const dims = this.dimensions();

    // Check if mouse is within plot area
    if (mouseX < dims.paddingLeft || mouseX > dims.width - dims.paddingRight) {
      this.hoverState.set({ ...this.hoverState(), visible: false });
      return;
    }

    // Find nearest elevation point
    const nearestPoint = this.findNearestPoint(mouseX);
    if (nearestPoint) {
      const x = this.distanceToX(nearestPoint.distance);
      const y = this.elevationToY(nearestPoint.elevation);

      this.hoverState.set({
        x,
        y,
        distance: nearestPoint.distance,
        elevation: nearestPoint.elevation,
        visible: true,
      });
    }
  }

  /**
   * Handle mouse leave
   */
  onMouseLeave(): void {
    this.hoverState.set({ ...this.hoverState(), visible: false });
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  }

  /**
   * Format distance for axis labels (shorter)
   */
  private formatDistanceShort(meters: number): string {
    if (meters >= 1000) {
      const km = meters / 1000;
      return km % 1 === 0 ? `${km}` : `${km.toFixed(1)}`;
    }
    return `${Math.round(meters)}`;
  }

  /**
   * Setup ResizeObserver for responsive width
   */
  private setupResizeObserver(element: HTMLElement): void {
    // Cleanup previous observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          this.chartWidth.set(width);
        }
      }
    });

    this.resizeObserver.observe(element);

    // Set initial width
    const initialWidth = element.getBoundingClientRect().width;
    if (initialWidth > 0) {
      this.chartWidth.set(initialWidth);
    }
  }

  /**
   * Extract elevation points from route segments
   */
  private extractElevationPoints(segments: RouteSegment[]): ElevationPoint[] {
    const points: ElevationPoint[] = [];
    let cumulativeDistance = 0;

    for (const segment of segments) {
      if (!segment.geojson || segment.loading || segment.error) {
        continue;
      }

      const coordinates = segment.geojson.geometry.coordinates;
      let prevCoord: [number, number, number] | null = null;

      for (const coord of coordinates) {
        // Skip if not enough data (need lng, lat, elevation)
        if (coord.length < 3) continue;

        const [lng, lat, elevation] = coord as [number, number, number];

        // Calculate distance from previous point
        if (prevCoord) {
          const distance = this.haversineDistance(
            prevCoord[1],
            prevCoord[0],
            lat,
            lng
          );
          cumulativeDistance += distance;
        }

        points.push({
          distance: cumulativeDistance,
          elevation,
          lat,
          lng,
        });

        prevCoord = [lng, lat, elevation];
      }
    }

    // Simplify points if too many (performance)
    return this.simplifyPoints(points, 500);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Simplify points array using Douglas-Peucker algorithm
   */
  private simplifyPoints(
    points: ElevationPoint[],
    maxPoints: number
  ): ElevationPoint[] {
    if (points.length <= maxPoints) {
      return points;
    }

    // Use a simple sampling approach for large datasets
    const step = Math.ceil(points.length / maxPoints);
    const simplified: ElevationPoint[] = [];

    for (let i = 0; i < points.length; i += step) {
      simplified.push(points[i]);
    }

    // Always include the last point
    const lastPoint = points[points.length - 1];
    if (simplified[simplified.length - 1] !== lastPoint) {
      simplified.push(lastPoint);
    }

    return simplified;
  }

  /**
   * Convert distance to X coordinate
   */
  private distanceToX(distance: number): number {
    const dims = this.dimensions();
    const scale = this.xScale();
    const ratio = distance / scale.range;
    return dims.paddingLeft + ratio * dims.plotWidth;
  }

  /**
   * Convert elevation to Y coordinate
   */
  private elevationToY(elevation: number): number {
    const dims = this.dimensions();
    const scale = this.yScale();
    const ratio = (elevation - scale.min) / scale.range;
    // Invert Y because SVG Y increases downward
    return dims.height - dims.paddingBottom - ratio * dims.plotHeight;
  }

  /**
   * Find nearest elevation point to mouse X position
   */
  private findNearestPoint(mouseX: number): ElevationPoint | null {
    const points = this.elevationPoints();
    if (points.length === 0) return null;

    // Binary search for efficiency
    const dims = this.dimensions();
    const scale = this.xScale();

    // Convert mouseX to distance
    const ratio = (mouseX - dims.paddingLeft) / dims.plotWidth;
    const targetDistance = ratio * scale.range;

    // Find nearest point
    let nearestPoint = points[0];
    let nearestDiff = Math.abs(points[0].distance - targetDistance);

    for (const point of points) {
      const diff = Math.abs(point.distance - targetDistance);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestPoint = point;
      }
    }

    return nearestPoint;
  }

  /**
   * Calculate a "nice" number for axis intervals
   */
  private niceNumber(value: number): number {
    if (value <= 0) return 1;

    const exponent = Math.floor(Math.log10(value));
    const fraction = value / Math.pow(10, exponent);

    let niceFraction: number;
    if (fraction <= 1) {
      niceFraction = 1;
    } else if (fraction <= 2) {
      niceFraction = 2;
    } else if (fraction <= 5) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }

    return niceFraction * Math.pow(10, exponent);
  }
}
