import { useEffect, useRef, useState, useCallback } from 'react';

export function useMjpegWs(wsUrl: string | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const pendingRef = useRef<ArrayBuffer | null>(null);
  const renderingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    renderingRef.current = false;
    pendingRef.current = null;
    retryCountRef.current = 0;
    playingRef.current = false;
    setPlaying(false);
    setReconnecting(false);
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    urlRef.current = wsUrl;

    const drawFrame = async () => {
      renderingRef.current = false;
      const frame = pendingRef.current;
      if (!frame) return;
      pendingRef.current = null;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const bitmap = await createImageBitmap(new Blob([frame], { type: 'image/jpeg' }));
        if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
        if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
      } catch {}

      if (pendingRef.current && !renderingRef.current) {
        renderingRef.current = true;
        rafIdRef.current = requestAnimationFrame(drawFrame);
      }
    };

    const connect = () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setError(false);
      setReconnecting(true);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => { setError(false); retryCountRef.current = 0; };

      ws.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer) || e.data.byteLength === 0) return;
        if (!playingRef.current) {
          setPlaying(true);
          setReconnecting(false);
          playingRef.current = true;
        }
        pendingRef.current = e.data;
        if (!renderingRef.current) {
          renderingRef.current = true;
          rafIdRef.current = requestAnimationFrame(drawFrame);
        }
      };

      ws.onerror = () => { setError(true); };

      ws.onclose = () => {
        setPlaying(false);
        setReconnecting(true);
        playingRef.current = false;
        if (urlRef.current === wsUrl) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000) + Math.random() * 1000;
          retryCountRef.current++;
          retryRef.current = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return cleanup;
  }, [wsUrl, cleanup]);

  return { canvasRef, playing, reconnecting, error };
}
