import { useEffect, useRef, type DependencyList } from "react";

export function useLiveRefresh(
  callback: () => void | Promise<void>,
  dependencies: DependencyList = [],
  intervalMs = 15000,
  enabled = true,
) {
  const callbackRef = useRef(callback);
  const runningRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    const timer = window.setInterval(() => {
      if (document.hidden || runningRef.current) return;

      runningRef.current = true;
      Promise.resolve(callbackRef.current()).finally(() => {
        runningRef.current = false;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, ...dependencies]);
}
