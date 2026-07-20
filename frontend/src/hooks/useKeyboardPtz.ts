import { useEffect, useRef, useState } from 'react';

const SPEED = 1;

interface CamWs {
  ws: WebSocket;
  ready: boolean;
}

export function useKeyboardPtz(cameraIds: string[], focusedCamera: string | null) {
  const connsRef = useRef<Map<string, CamWs>>(new Map());
  const focusedRef = useRef<string | null>(null);
  const heldRef = useRef<Set<string>>(new Set());
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  focusedRef.current = focusedCamera;

  const cameraIdsKey = cameraIds.join(',');

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const conns = connsRef.current;

    for (const id of cameraIds) {
      if (conns.has(id)) continue;
      const ws = new WebSocket(`${protocol}//${location.host}/ws/ptz/${id}`);
      const entry: CamWs = { ws, ready: false };
      conns.set(id, entry);

      ws.onopen = () => { entry.ready = true; };
      ws.onclose = () => { entry.ready = false; conns.delete(id); };
      ws.onerror = () => { entry.ready = false; };
    }

    return () => {
      conns.forEach(e => e.ws.close());
      conns.clear();
    };
  }, [cameraIds, cameraIdsKey]);

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
          if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
          const { pan, tilt } = computeDirection();
          send({ action: 'move', pan, tilt });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        held.delete(e.key);
        if (held.size === 0) {
          if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
          stopTimerRef.current = setTimeout(() => {
            stopTimerRef.current = null;
            send({ action: 'stop' });
          }, 30);
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
      if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    };
  }, []);

  return { connected };
}
