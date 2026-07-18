import { useEffect, useRef, useState } from 'react';

const SPEED = 1;

interface CamWs {
  ws: WebSocket;
  ready: boolean;
}

export function useKeyboardPtz(camerasCount: number, focusedCamera: number | null) {
  const connsRef = useRef<Map<number, CamWs>>(new Map());
  const focusedRef = useRef<number | null>(null);
  const heldRef = useRef<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);

  focusedRef.current = focusedCamera;

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const conns = connsRef.current;

    for (let i = 0; i < camerasCount; i++) {
      if (conns.has(i)) continue;
      const ws = new WebSocket(`${protocol}//${location.host}/ws/ptz/${i}`);
      const entry: CamWs = { ws, ready: false };
      conns.set(i, entry);

      ws.onopen = () => { entry.ready = true; };
      ws.onclose = () => { entry.ready = false; conns.delete(i); };
      ws.onerror = () => { entry.ready = false; };
    }

    return () => {
      conns.forEach(e => e.ws.close());
      conns.clear();
    };
  }, [camerasCount]);

  useEffect(() => {
    setConnected(false);
    if (focusedCamera !== null) {
      const entry = connsRef.current.get(focusedCamera);
      if (entry?.ready) setConnected(true);
      else {
        const check = setInterval(() => {
          const e = connsRef.current.get(focusedCamera);
          if (e?.ready) { setConnected(true); clearInterval(check); }
        }, 100);
        const timeout = setTimeout(() => clearInterval(check), 5000);
        return () => { clearInterval(check); clearTimeout(timeout); };
      }
    }
  }, [focusedCamera]);

  useEffect(() => {
    const held = heldRef.current;
    const send = (cmd: Record<string, unknown>) => {
      const camId = focusedRef.current;
      if (camId === null) return;
      const entry = connsRef.current.get(camId);
      if (entry?.ready && entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(JSON.stringify(cmd));
      }
    };

    const computeDirection = () => {
      let pan = 0, tilt = 0;
      if (held.has('ArrowLeft'))  pan -= SPEED;
      if (held.has('ArrowRight')) pan += SPEED;
      if (held.has('ArrowUp'))    tilt -= SPEED;
      if (held.has('ArrowDown'))  tilt += SPEED;
      return { pan, tilt };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (!held.has(e.key)) {
          held.add(e.key);
          const { pan, tilt } = computeDirection();
          send({ action: 'move', pan, tilt });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        held.delete(e.key);
        if (held.size === 0) {
          send({ action: 'stop' });
        } else {
          const { pan, tilt } = computeDirection();
          send({ action: 'move', pan, tilt });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      held.clear();
    };
  }, []);

  return { connected };
}
