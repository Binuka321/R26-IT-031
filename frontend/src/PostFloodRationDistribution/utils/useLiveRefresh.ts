import { useEffect, type DependencyList } from "react";

export function useLiveRefresh(
  callback: () => void | Promise<void>,
  dependencies: DependencyList = [],
  intervalMs = 15000,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return undefined;

    const timer = window.setInterval(() => {
      void callback();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, ...dependencies]);
}
