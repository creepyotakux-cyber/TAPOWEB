import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Radio, Maximize2, Settings, Aperture, RefreshCw, AlertTriangle } from 'lucide-react';
import { useMjpegWs } from '../hooks/useMjpegWs';
import { api } from '../lib/api';
import type { WatchdogStatus, MjpegStatus } from '../lib/api';

interface Props {
  cameraId: string;
  name: string;
  wsUrl: string;
  watchdog: WatchdogStatus | null;
  mjpeg: MjpegStatus | null;
  onOpenPtz: (id: string) => void;
  onFullscreenEnter?: (id: string) => void;
  onFullscreenExit?: () => void;
  onFocus?: (id: string) => void;
  onBlur?: () => void;
  className?: string;
  compact?: boolean;
}

export function CameraTile({ cameraId, name, wsUrl, watchdog, mjpeg, onOpenPtz, onFullscreenEnter, onFullscreenExit, onFocus, onBlur, className, compact }: Props) {
  const { canvasRef, playing, reconnecting, error } = useMjpegWs(wsUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const recovering = watchdog?.recovering ?? false;
  const blackDetected = watchdog?.black_detected ?? false;
  const failures = watchdog?.consecutive_failures ?? 0;

  const hasSignal = playing || (mjpeg?.has_signal ?? false);
  const isReconnecting = !hasSignal && ((mjpeg?.reconnecting ?? false) || reconnecting);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        onFullscreenExit?.();
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [onFullscreenExit]);

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen();
      setIsFullscreen(true);
      onFullscreenEnter?.(cameraId);
    } catch {}
  }, [cameraId, onFullscreenEnter]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
  }, []);

  const handleSnapshot = async () => {
    await api.takeSnapshot(cameraId);
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-elevated border border-glass-border rounded-lg overflow-hidden group cursor-pointer min-h-[180px] h-full ${isFullscreen ? 'flex flex-col' : ''} ${recovering ? 'ring-2 ring-warning/50' : ''} ${blackDetected ? 'ring-2 ring-danger/50' : ''} ${className ?? ''}`}
      onDoubleClick={enterFullscreen}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
      onMouseEnter={() => onFocus?.(cameraId)}
      onMouseLeave={() => onBlur?.()}
    >
      <canvas
        ref={canvasRef}
        className={`bg-void ${isFullscreen ? 'flex-1 object-contain' : 'w-full h-full object-contain'}`}
      />

      {isFullscreen && (
        <button onClick={exitFullscreen} className="absolute top-4 right-4 z-50 bg-surface/80 backdrop-blur-sm border border-glass-border rounded-lg px-3 py-1.5 text-sm hover:bg-elevated transition-all">
          Salir (ESC)
        </button>
      )}

      {(isReconnecting || recovering) && !hasSignal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/80 gap-2 z-10">
          <RefreshCw size={32} className="text-warning animate-spin" />
          <span className="text-warning text-sm font-semibold">Reconectando...</span>
          {failures > 1 && (
            <span className="text-text-muted text-[10px]">Intento #{failures}</span>
          )}
        </div>
      )}

      {blackDetected && !isReconnecting && !recovering && !hasSignal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/80 gap-2 z-10">
          <AlertTriangle size={32} className="text-danger" />
          <span className="text-danger text-sm font-semibold">Pantalla negra detectada</span>
          <span className="text-text-muted text-[10px]">Reiniciando automaticamente</span>
        </div>
      )}

      {error && !hasSignal && !isReconnecting && !recovering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/70 backdrop-blur-sm gap-2">
          <CameraOff size={32} className="text-text-muted" />
          <span className="text-text-muted text-sm">Sin senal</span>
          <span className="text-text-muted text-[10px]">{name}</span>
        </div>
      )}

      {!hasSignal && !error && !isReconnecting && !recovering && !blackDetected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/60 backdrop-blur-sm gap-2">
          <Camera size={32} className="text-text-muted" />
          <span className="text-text-muted text-sm">Sin conexion</span>
          <span className="text-text-muted text-[10px]">{name}</span>
        </div>
      )}

      <div className="absolute top-2 right-2 flex items-center gap-1 bg-recording/90 px-2 py-0.5 rounded text-white text-xs font-bold">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        REC
      </div>

      <div className={`absolute bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-sm border-t border-glass-border px-3 py-1.5 flex items-center justify-between ${compact ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-200' : ''}`}>
        <div className="flex items-center gap-2">
          <Camera size={14} className={(isReconnecting || recovering) ? 'text-warning' : blackDetected ? 'text-danger' : hasSignal ? 'text-accent' : 'text-text-muted'} />
          <span className="text-xs font-semibold text-text-primary">{name}</span>
        </div>
        <div className="flex items-center gap-1">
          {hasSignal && !isReconnecting && !recovering && <Radio size={12} className="text-live" />}
          {hasSignal && !isReconnecting && !recovering && <span className="text-[10px] text-live font-bold">LIVE</span>}
          {(isReconnecting || recovering) && <RefreshCw size={12} className="text-warning animate-spin" />}
          {(isReconnecting || recovering) && <span className="text-[10px] text-warning font-bold">RETRY</span>}
          {!hasSignal && !isReconnecting && !recovering && <span className="text-[10px] text-text-muted font-bold">OFFLINE</span>}
        </div>
      </div>

      {menuOpen && (
        <div
          className="absolute top-8 right-2 bg-surface border border-glass-border rounded-lg shadow-xl z-50 min-w-[180px] py-1"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button onClick={() => { onOpenPtz(cameraId); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-accent-bg hover:text-accent flex items-center gap-2">
            <Settings size={14} /> PTZ Control
          </button>
          <button onClick={() => { handleSnapshot(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-accent-bg hover:text-accent flex items-center gap-2">
            <Aperture size={14} /> Snapshot
          </button>
          <button onClick={() => { enterFullscreen(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-accent-bg hover:text-accent flex items-center gap-2">
            <Maximize2 size={14} /> Pantalla completa
          </button>
        </div>
      )}
    </div>
  );
}
