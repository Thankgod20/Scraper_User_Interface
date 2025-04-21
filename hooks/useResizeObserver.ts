// hooks/useResizeObserver.ts
import { useState, useEffect } from 'react';

interface Dimensions {
  width: number;
  height: number;
}

export const useResizeObserver = (
  ref: HTMLElement | null
): Dimensions | null => {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);

  useEffect(() => {
    if (!ref) return;

    const observeTarget = ref;
    const resizeObserver = new ResizeObserver(entries => {
      // We only observe one element, so we can use entries[0]
      if (entries.length > 0) {
        const entry = entries[0];
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(observeTarget);

    return () => {
      resizeObserver.unobserve(observeTarget);
      resizeObserver.disconnect();
    };
  }, [ref]);

  return dimensions;
};