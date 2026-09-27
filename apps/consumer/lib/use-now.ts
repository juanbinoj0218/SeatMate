import { useEffect, useState } from "react";

// Current time that refreshes on an interval, for "Updated X min ago"
// labels. Read once lazily so render stays pure.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}
