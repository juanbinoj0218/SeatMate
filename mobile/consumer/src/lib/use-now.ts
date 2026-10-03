import { useEffect, useState } from "react";

// Current time that refreshes on an interval, for "Updated X min ago" and
// open/closed labels.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
