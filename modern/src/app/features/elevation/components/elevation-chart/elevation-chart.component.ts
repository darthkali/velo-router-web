import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteState } from '../../../../state/route.state';
import { RouteSegment } from '../../../../core/services/brouter/brouter.types';

/**
 * Position on the route for cursor synchronization
 */
export interface RouteHoverPoint {
  lat: number;
  lng: number;
}

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
  gradient: number; // gradient in percent
  lat: number;
  lng: number;
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
      <!-- Header with toggle -->
      <button
        (click)="toggleExpanded()"
        class="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100">
        <span class="text-sm font-medium text-gray-700">Elevation Profile</span>
        <div class="flex items-center gap-3">
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
          <!-- Chevron icon -->
          <svg
            [class.rotate-180]="isExpanded()"
            class="w-4 h-4 text-gray-500 transition-transform duration-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <!-- Chart Container (collapsible) -->
      @if (isExpanded()) {
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

            <!-- Gradient definitions -->
            <defs>
              <!-- Default fill gradient -->
              <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05" />
              </linearGradient>
              <!-- Gradient colors for different slopes -->
              <linearGradient id="gradientFlat" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#22c55e" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#22c55e" stop-opacity="0.1" />
              </linearGradient>
              <linearGradient id="gradientModerate" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#eab308" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#eab308" stop-opacity="0.1" />
              </linearGradient>
              <linearGradient id="gradientSteep" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f97316" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#f97316" stop-opacity="0.1" />
              </linearGradient>
              <linearGradient id="gradientVerySteep" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.1" />
              </linearGradient>
              <!-- Descent gradient colors -->
              <linearGradient id="gradientDescentModerate" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.1" />
              </linearGradient>
              <linearGradient id="gradientDescentSteep" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.1" />
              </linearGradient>
              <linearGradient id="gradientDescentVerySteep" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.5" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.1" />
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

            <!-- Gradient-colored segments based on slope -->
            @for (segment of gradientSegments(); track $index) {
              <path
                [attr.d]="segment.areaPath"
                [attr.fill]="segment.fillGradient" />
              <path
                [attr.d]="segment.linePath"
                fill="none"
                [attr.stroke]="segment.strokeColor"
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
              <!-- Point circle with gradient-based color -->
              <circle
                [attr.cx]="hoverState().x"
                [attr.cy]="hoverState().y"
                r="5"
                [attr.fill]="getGradientColor(hoverState().gradient)"
                stroke="white"
                stroke-width="2" />
            }
          </svg>

          <!-- Hover tooltip -->
          @if (hoverState().visible) {
            <div
              class="absolute pointer-events-none bg-gray-800 text-white text-xs px-2 py-1.5 rounded shadow-lg whitespace-nowrap z-10"
              [style.left.px]="tooltipPosition().x"
              [style.top.px]="tooltipPosition().y"
              [style.transform]="tooltipPosition().transform">
              <div class="font-medium">{{ formatDistance(hoverState().distance) }}</div>
              <div class="text-gray-300">{{ hoverState().elevation | number:'1.0-0' }} m</div>
              <div class="flex items-center gap-1" [style.color]="getGradientColor(hoverState().gradient)">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  @if (hoverState().gradient >= 0) {
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  } @else {
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  }
                </svg>
                <span>{{ hoverState().gradient | number:'1.1-1' }}%</span>
              </div>
            </div>
          }

          <!-- Gradient legend -->
          <div class="absolute bottom-1 right-2 flex items-center gap-2 text-[9px] text-gray-500">
            <span class="flex items-center gap-0.5">
              <svg class="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span class="w-2 h-2 rounded-full bg-orange-500"></span>
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
            </span>
            <span class="w-px h-3 bg-gray-300"></span>
            <span class="flex items-center gap-0.5">
              <svg class="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
              <span class="w-2 h-2 rounded-full bg-sky-300"></span>
              <span class="w-2 h-2 rounded-full bg-sky-500"></span>
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            </span>
            <span class="w-2 h-2 rounded-full bg-green-500 ml-1"></span>
            <span>&lt;3%</span>
          </div>
        </div>
      }
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

  /** Signal for expanded/collapsed state */
  readonly isExpanded = signal(true);

  /** Output event for cursor synchronization with map */
  readonly hoverPoint = output<RouteHoverPoint | null>();

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
    gradient: 0,
    lat: 0,
    lng: 0,
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
   * Toggle the expanded/collapsed state
   */
  toggleExpanded(): void {
    this.isExpanded.update(v => !v);
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
   * Gradient segments for color-coded elevation display based on slope
   */
  readonly gradientSegments = computed(() => {
    const points = this.elevationPoints();
    if (points.length < 2) return [];

    const dims = this.dimensions();
    const baseY = dims.height - dims.paddingBottom;

    const segments: {
      linePath: string;
      areaPath: string;
      strokeColor: string;
      fillGradient: string;
      gradient: number;
    }[] = [];

    // Group consecutive points by gradient category
    let currentGroup: ElevationPoint[] = [points[0]];
    let currentGradient = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const distanceDiff = curr.distance - prev.distance;
      const elevationDiff = curr.elevation - prev.elevation;
      const gradient = distanceDiff > 0 ? (elevationDiff / distanceDiff) * 100 : 0;
      const gradientCategory = this.getGradientCategory(Math.abs(gradient));

      if (currentGroup.length === 1) {
        currentGradient = gradient;
        currentGroup.push(curr);
      } else {
        const prevGradientCategory = this.getGradientCategory(Math.abs(currentGradient));
        if (gradientCategory === prevGradientCategory) {
          currentGroup.push(curr);
          currentGradient = gradient;
        } else {
          // Create segment for current group
          segments.push(this.createGradientSegment(currentGroup, baseY, currentGradient));
          // Start new group with OVERLAP - include previous point to avoid gaps
          currentGroup = [prev, curr];
          currentGradient = gradient;
        }
      }
    }

    // Add final segment
    if (currentGroup.length >= 2) {
      segments.push(this.createGradientSegment(currentGroup, baseY, currentGradient));
    } else if (currentGroup.length === 1 && segments.length > 0) {
      // Add single point to last segment
      const lastSegment = segments[segments.length - 1];
      const point = currentGroup[0];
      const x = this.distanceToX(point.distance);
      const y = this.elevationToY(point.elevation);
      lastSegment.linePath += ` L ${x} ${y}`;
    }

    return segments;
  });

  /**
   * Create a gradient segment from a group of points
   */
  private createGradientSegment(
    points: ElevationPoint[],
    baseY: number,
    gradient: number
  ): { linePath: string; areaPath: string; strokeColor: string; fillGradient: string; gradient: number } {
    const firstX = this.distanceToX(points[0].distance);
    const firstY = this.elevationToY(points[0].elevation);

    let linePath = `M ${firstX} ${firstY}`;
    let areaPath = `M ${firstX} ${baseY} L ${firstX} ${firstY}`;

    for (let i = 1; i < points.length; i++) {
      const x = this.distanceToX(points[i].distance);
      const y = this.elevationToY(points[i].elevation);
      linePath += ` L ${x} ${y}`;
      areaPath += ` L ${x} ${y}`;
    }

    const lastX = this.distanceToX(points[points.length - 1].distance);
    areaPath += ` L ${lastX} ${baseY} Z`;

    const strokeColor = this.getGradientColor(gradient);
    const fillGradient = this.getGradientFill(gradient);

    return { linePath, areaPath, strokeColor, fillGradient, gradient };
  }

  /**
   * Get gradient category for grouping (0-3%, 3-6%, 6-10%, >10%)
   */
  private getGradientCategory(absGradient: number): number {
    if (absGradient < 3) return 0;
    if (absGradient < 6) return 1;
    if (absGradient < 10) return 2;
    return 3;
  }

  /**
   * Get color based on gradient percentage
   */
  getGradientColor(gradient: number): string {
    const absGradient = Math.abs(gradient);

    if (gradient >= 0) {
      // Ascent - red tones
      if (absGradient < 3) return '#22c55e'; // green - flat
      if (absGradient < 6) return '#eab308'; // yellow - moderate
      if (absGradient < 10) return '#f97316'; // orange - steep
      return '#ef4444'; // red - very steep
    } else {
      // Descent - blue tones
      if (absGradient < 3) return '#22c55e'; // green - flat
      if (absGradient < 6) return '#38bdf8'; // light blue - moderate
      if (absGradient < 10) return '#0ea5e9'; // sky blue - steep
      return '#3b82f6'; // blue - very steep
    }
  }

  /**
   * Get fill gradient ID based on gradient percentage
   */
  private getGradientFill(gradient: number): string {
    const absGradient = Math.abs(gradient);
    if (absGradient < 3) return 'url(#gradientFlat)';

    if (gradient >= 0) {
      // Ascent fills
      if (absGradient < 6) return 'url(#gradientModerate)';
      if (absGradient < 10) return 'url(#gradientSteep)';
      return 'url(#gradientVerySteep)';
    } else {
      // Descent fills
      if (absGradient < 6) return 'url(#gradientDescentModerate)';
      if (absGradient < 10) return 'url(#gradientDescentSteep)';
      return 'url(#gradientDescentVerySteep)';
    }
  }

  /**
   * Tooltip position (adjusted to stay within bounds)
   */
  readonly tooltipPosition = computed(() => {
    const hover = this.hoverState();
    const dims = this.dimensions();

    // Calculate if point is in upper or lower half
    const chartMidY = dims.paddingTop + dims.plotHeight / 2;
    const isUpperHalf = hover.y < chartMidY;

    let x = hover.x;
    let y: number;
    let transform = 'translateX(-50%)';

    // Show tooltip below point if in upper half, above if in lower half
    if (isUpperHalf) {
      y = hover.y + 45; // Below the point
    } else {
      y = hover.y - 55; // Above the point
    }

    // Adjust horizontal position if too close to edges
    if (hover.x < 60) {
      x = hover.x + 10;
      transform = 'translateX(0)';
    } else if (hover.x > dims.width - 60) {
      x = hover.x - 10;
      transform = 'translateX(-100%)';
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
      this.hoverPoint.emit(null);
      return;
    }

    // Find nearest elevation point and calculate gradient
    const result = this.findNearestPointWithGradient(mouseX);
    if (result) {
      const x = this.distanceToX(result.point.distance);
      const y = this.elevationToY(result.point.elevation);

      this.hoverState.set({
        x,
        y,
        distance: result.point.distance,
        elevation: result.point.elevation,
        gradient: result.gradient,
        lat: result.point.lat,
        lng: result.point.lng,
        visible: true,
      });

      // Emit hover point for map synchronization
      this.hoverPoint.emit({
        lat: result.point.lat,
        lng: result.point.lng,
      });
    }
  }

  /**
   * Handle mouse leave
   */
  onMouseLeave(): void {
    this.hoverState.set({ ...this.hoverState(), visible: false });
    this.hoverPoint.emit(null);
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
   * Find nearest elevation point with gradient calculation
   */
  private findNearestPointWithGradient(mouseX: number): { point: ElevationPoint; gradient: number } | null {
    const points = this.elevationPoints();
    if (points.length === 0) return null;

    const dims = this.dimensions();
    const scale = this.xScale();

    // Convert mouseX to distance
    const ratio = (mouseX - dims.paddingLeft) / dims.plotWidth;
    const targetDistance = ratio * scale.range;

    // Find nearest point and its index
    let nearestIndex = 0;
    let nearestDiff = Math.abs(points[0].distance - targetDistance);

    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].distance - targetDistance);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestIndex = i;
      }
    }

    const nearestPoint = points[nearestIndex];

    // Calculate gradient between this point and the next (or previous if at end)
    let gradient = 0;
    if (nearestIndex < points.length - 1) {
      const nextPoint = points[nearestIndex + 1];
      const distanceDiff = nextPoint.distance - nearestPoint.distance;
      const elevationDiff = nextPoint.elevation - nearestPoint.elevation;
      gradient = distanceDiff > 0 ? (elevationDiff / distanceDiff) * 100 : 0;
    } else if (nearestIndex > 0) {
      const prevPoint = points[nearestIndex - 1];
      const distanceDiff = nearestPoint.distance - prevPoint.distance;
      const elevationDiff = nearestPoint.elevation - prevPoint.elevation;
      gradient = distanceDiff > 0 ? (elevationDiff / distanceDiff) * 100 : 0;
    }

    return { point: nearestPoint, gradient };
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
