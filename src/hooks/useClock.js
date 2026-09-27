import { useEffect, useState } from 'react';

/**
 * Single 1s ticker for the whole screen.
 * Returns the current instant and its minute bucket — heavy date math keys
 * its memos on `minute` so it recomputes once per minute, not every tick.
 * setState runs inside the interval callback, never synchronously in the effect.
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const ci = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(ci);
  }, []);

  const minute = Math.floor(now.getTime() / 60000);
  return { now, minute };
}
