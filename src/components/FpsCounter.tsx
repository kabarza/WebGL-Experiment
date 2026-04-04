// ============================================================
// FpsCounter — Reliable frame-rate display using rAF timestamps
// ============================================================

import { useEffect, useRef, useState } from 'react';
import './fps-counter.css';

const SAMPLE_SIZE = 60;
const UPDATE_INTERVAL = 500; // ms between display refreshes

function useFps(): number {
  const [fps, setFps] = useState(0);
  const frameTimes = useRef<number[]>([]);
  const lastUpdate = useRef(0);
  const rafId = useRef(0);

  useEffect(() => {
    const tick = (now: number) => {
      const times = frameTimes.current;
      times.push(now);

      // Keep only the last SAMPLE_SIZE timestamps
      if (times.length > SAMPLE_SIZE) {
        times.shift();
      }

      // Update displayed value at throttled interval
      if (now - lastUpdate.current >= UPDATE_INTERVAL && times.length > 1) {
        const elapsed = times[times.length - 1] - times[0];
        const avgFps = ((times.length - 1) / elapsed) * 1000;
        setFps(Math.round(avgFps));
        lastUpdate.current = now;
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return fps;
}

export function FpsCounter() {
  const fps = useFps();

  return (
    <div className="fps-counter" title="Frames per second">
      <span className="fps-value">{fps}</span>
      <span className="fps-label">fps</span>
    </div>
  );
}
