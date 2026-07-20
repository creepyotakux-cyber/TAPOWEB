import { useEffect, useRef, useCallback, useState } from 'react';

export function usePtzWs(cameraId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [led, setLed] = useState<'on' | 'off'>('off');
  const [lastOk, setLastOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (cameraId === null) return;

    const connect = () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setError(null);

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/ws/ptz/${cameraId}`);
      wsRef.current = ws;
      ws.onopen = () => { retryCountRef.current = 0; };
      ws.onclose = () => {
        setConnected(false);
        setLastOk(null);
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000) + Math.random() * 500;
        retryCountRef.current++;
        retryRef.current = setTimeout(connect, delay);
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.error) {
            setError(data.error);
            setConnected(false);
            return;
          }
          if (data.connected) {
            setConnected(true);
            setError(null);
          }
          if (data.led) setLed(data.led);
          if (typeof data.ok === 'boolean') setLastOk(data.ok);
        } catch {}
      };
      ws.onerror = () => { setConnected(false); };
    };

    connect();
    return () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setConnected(false);
      setLastOk(null);
      setError(null);
    };
  }, [cameraId]);

  const send = useCallback((cmd: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  const move = useCallback((pan: number, tilt: number) => send({ action: 'move', pan, tilt }), [send]);
  const stop = useCallback(() => send({ action: 'stop' }), [send]);
  const home = useCallback(() => send({ action: 'home' }), [send]);
  const gotoPreset = useCallback((token: string) => send({ action: 'goto_preset', token }), [send]);
  const setPreset = useCallback((name: string) => send({ action: 'set_preset', name }), [send]);
  const removePreset = useCallback((token: string) => send({ action: 'remove_preset', token }), [send]);
  const cruiseH = useCallback((speed?: number) => send({ action: 'cruise_h', speed: speed ?? 0.5 }), [send]);
  const cruiseV = useCallback((speed?: number) => send({ action: 'cruise_v', speed: speed ?? 0.5 }), [send]);
  const stopCruise = useCallback(() => send({ action: 'stop_cruise' }), [send]);
  const patrol = useCallback((tokens: string[], interval?: number) => send({ action: 'patrol', tokens, interval: interval ?? 10 }), [send]);
  const stopPatrol = useCallback(() => send({ action: 'stop_patrol' }), [send]);
  const patrolSweep = useCallback((speed?: number) => send({ action: 'patrol_sweep', speed: speed ?? 0.5 }), [send]);
  const stopSweep = useCallback(() => send({ action: 'stop_sweep' }), [send]);
  const ledOn = useCallback(() => send({ action: 'led_on' }), [send]);
  const ledOff = useCallback(() => send({ action: 'led_off' }), [send]);

  return { connected, error, led, lastOk, move, stop, home, gotoPreset, setPreset, removePreset, cruiseH, cruiseV, stopCruise, patrol, stopPatrol, patrolSweep, stopSweep, ledOn, ledOff };
}
