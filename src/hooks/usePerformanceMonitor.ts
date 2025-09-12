import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  apiCallTime: number;
  totalTime: number;
  memoryUsage?: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const renderStartTime = useRef<number>(0);
  const apiStartTime = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms`);
        
        // Check for performance issues
        if (renderTime > 100) {
          console.warn(`[Performance Warning] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
        }
      }
    };
  });

  const startApiTimer = () => {
    apiStartTime.current = performance.now();
  };

  const endApiTimer = (apiName: string) => {
    const apiTime = performance.now() - apiStartTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${apiName} API call: ${apiTime.toFixed(2)}ms`);
      
      if (apiTime > 2000) {
        console.warn(`[Performance Warning] ${apiName} API call took ${apiTime.toFixed(2)}ms`);
      }
    }
    
    return apiTime;
  };

  const getMemoryUsage = (): number | undefined => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return undefined;
  };

  return {
    startApiTimer,
    endApiTimer,
    getMemoryUsage
  };
};
