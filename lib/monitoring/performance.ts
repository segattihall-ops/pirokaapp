// Performance monitoring and error tracking

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  context?: Record<string, any>;
}

interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private errors: ErrorReport[] = [];
  private maxMetrics = 1000;
  private maxErrors = 100;

  recordMetric(
    name: string,
    duration: number,
    context?: Record<string, any>
  ): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
      context,
    });

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  recordError(
    message: string,
    severity: 'error' | 'warning' | 'info' = 'error',
    context?: Record<string, any>
  ): void {
    this.errors.push({
      message,
      severity,
      timestamp: Date.now(),
      context,
    });

    // Trim old errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  getMetrics(filter?: { name?: string; minDuration?: number }): PerformanceMetric[] {
    let result = [...this.metrics];

    if (filter?.name) {
      result = result.filter((m) => m.name === filter.name);
    }

    if (filter?.minDuration !== undefined) {
      const minDuration = filter.minDuration;
      result = result.filter((m) => m.duration >= minDuration);
    }

    return result;
  }

  getErrors(filter?: { severity?: string }): ErrorReport[] {
    let result = [...this.errors];

    if (filter?.severity) {
      result = result.filter((e) => e.severity === filter.severity);
    }

    return result;
  }

  getMetricStats(name: string): { avg: number; min: number; max: number; count: number } {
    const metrics = this.getMetrics({ name });
    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const durations = metrics.map((m) => m.duration);
    return {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      count: durations.length,
    };
  }

  clear(): void {
    this.metrics = [];
    this.errors = [];
  }

  export(): { metrics: PerformanceMetric[]; errors: ErrorReport[] } {
    return {
      metrics: this.metrics,
      errors: this.errors,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Measure function execution
export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const start = performance.now();

  return fn()
    .then((result) => {
      const duration = performance.now() - start;
      performanceMonitor.recordMetric(name, duration, context);
      return result;
    })
    .catch((err) => {
      const duration = performance.now() - start;
      performanceMonitor.recordMetric(name, duration, { ...context, error: true });
      throw err;
    });
}

export function measureSync<T>(
  name: string,
  fn: () => T,
  context?: Record<string, any>
): T {
  const start = performance.now();

  try {
    const result = fn();
    const duration = performance.now() - start;
    performanceMonitor.recordMetric(name, duration, context);
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    performanceMonitor.recordMetric(name, duration, { ...context, error: true });
    throw err;
  }
}

// Global error handler
export function setupErrorTracking(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    performanceMonitor.recordError(event.message, 'error', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message =
      event.reason instanceof Error ? event.reason.message : String(event.reason);
    performanceMonitor.recordError(message, 'error', {
      type: 'unhandledRejection',
    });
  });
}
