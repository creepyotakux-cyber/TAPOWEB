import { useEffect, useRef, useState, useCallback } from 'react';

export function useMjpegWs(wsUrl: string | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const latestFrameRef = useRef<ArrayBuffer | null>(null);
  const renderScheduledRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    renderScheduledRef.current = false;
    latestFrameRef.current = null;
    retryCountRef.current = 0;
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    urlRef.current = wsUrl;

    const render = async () => {
      renderScheduledRef.current = false;
      const frame = latestFrameRef.current;
      if (!frame) return;
      latestFrameRef.current = null;

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
    };

    const connect = () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setError(false);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => { setPlaying(true); setError(false); retryCountRef.current = 0; };

      ws.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer) || e.data.byteLength === 0) return;
        latestFrameRef.current = e.data;
        if (!renderScheduledRef.current) {
          renderScheduledRef.current = true;
          rafIdRef.current = requestAnimationFrame(render);
        }
      };

      ws.onerror = () => { setError(true); };

      ws.onclose = () => {
        setPlaying(false);
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

  return { canvasRef, playing, error };
}
