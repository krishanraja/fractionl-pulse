import { useEffect, useState } from 'react';

export interface VisualViewportMetrics {
  height: number | null;
  offsetTop: number;
}

/**
 * Keeps portal-rendered mobile surfaces inside the part of the page that is
 * actually visible when an on-screen keyboard is open. Dynamic viewport units
 * are the fallback for browsers that do not expose VisualViewport.
 */
export const useVisualViewport = (active: boolean) => {
  const [metrics, setMetrics] = useState<VisualViewportMetrics>({ height: null, offsetTop: 0 });

  useEffect(() => {
    if (!active) return;

    if (!window.visualViewport) {
      setMetrics({ height: window.innerHeight, offsetTop: 0 });
      return;
    }

    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      setMetrics({ height: viewport.height, offsetTop: viewport.offsetTop });
      root.style.setProperty('--pulse-visual-height', `${viewport.height}px`);
      root.style.setProperty('--pulse-visual-offset-top', `${viewport.offsetTop}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--pulse-visual-height');
      root.style.removeProperty('--pulse-visual-offset-top');
      setMetrics({ height: null, offsetTop: 0 });
    };
  }, [active]);

  return metrics;
};
