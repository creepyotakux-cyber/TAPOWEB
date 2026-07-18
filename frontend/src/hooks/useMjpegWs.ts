import { useEffect, useRef, useState, useCallback } from 'react';

export function useMjpegWs(wsUrl: string | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    urlRef.current = wsUrl;

    const connect = () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      setError(false);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => { setPlaying(true); setError(false); };

      ws.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer) || e.data.byteLength === 0) return;
        const blob = new Blob([e.data], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          if (canvas.width !== img.naturalWidth) canvas.width = img.naturalWidth;
          if (canvas.height !== img.naturalHeight) canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      };

      ws.onerror = () => { setError(true); };

      ws.onclose = () => {
        setPlaying(false);
        if (urlRef.current === wsUrl) {
          retryRef.current = setTimeout(connect, 2000);
        }
      };
    };

    connect();
    return cleanup;
  }, [wsUrl, cleanup]);

  return { canvasRef, playing, error };
}
