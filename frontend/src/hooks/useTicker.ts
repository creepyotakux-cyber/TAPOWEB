import { useEffect, useState } from 'react';

const subscribers = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureInterval() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    subscribers.forEach((fn) => fn());
  }, 1000);
}

function removeInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useTicker() {
  const [, setNow] = useState(() => Date.now());

  useEffect(() => {
    const fn = () => setNow(Date.now());
    subscribers.add(fn);
    ensureInterval();
    return () => {
      subscribers.delete(fn);
      if (subscribers.size === 0) removeInterval();
    };
  }, []);

  return new Date();
}
