import { useEffect, useRef, useCallback, useState } from 'react';

export function usePtzWs(cameraId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [led, setLed] = useState<'on' | 'off'>('off');
  const [lastOk, setLastOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (cameraId === null) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/ws/ptz/${cameraId}`);
    wsRef.current = ws;
    ws.onopen = () => {};
    ws.onclose = () => { setConnected(false); setLastOk(null); };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.connected) setConnected(true);
        if (data.led) setLed(data.led);
        if (typeof data.ok === 'boolean') setLastOk(data.ok);
      } catch {}
    };
    return () => { ws.close(); wsRef.current = null; setConnected(false); setLastOk(null); };
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
  const ledOn = useCallback(() => send({ action: 'led_on' }), [send]);
  const ledOff = useCallback(() => send({ action: 'led_off' }), [send]);

  return { connected, led, lastOk, move, stop, home, gotoPreset, setPreset, removePreset, cruiseH, cruiseV, stopCruise, patrol, stopPatrol, ledOn, ledOff };
}
