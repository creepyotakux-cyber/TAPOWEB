import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Radio, Maximize2, Settings, Aperture, RefreshCw, AlertTriangle, MoreVertical } from 'lucide-react';
import { useMjpegWs } from '../hooks/useMjpegWs';
import { useTicker } from '../hooks/useTicker';
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
  camNumber?: number;
}

function LiveTime() {
  const now = useTicker();
  const s = now.toLocaleTimeString('es-VE', { hour12: false });
  return <span className="font-mono tabular-nums tracking-wide">{s}</span>;
}

export function CameraTile({ cameraId, name, wsUrl, watchdog, mjpeg, onOpenPtz, onFullscreenEnter, onFullscreenExit, onFocus, onBlur, className, compact, camNumber }: Props) {
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
      className={`relative bg-void border border-glass-border/60 rounded-sm overflow-hidden group cursor-pointer min-h-[140px] lg:min-h-[180px] h-full transition-colors duration-200 ${isFullscreen ? 'flex flex-col' : 'hover:border-accent/50'} ${recovering ? 'ring-1 ring-warning/40' : ''} ${blackDetected ? 'ring-1 ring-danger/40' : ''} ${className ?? ''}`}
      onDoubleClick={enterFullscreen}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
      onMouseEnter={() => onFocus?.(cameraId)}
      onMouseLeave={() => onBlur?.()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={name}
        className={`bg-void ${isFullscreen ? 'flex-1 object-contain' : 'w-full h-full object-contain'}`}
      />

      {isFullscreen && (
        <button onClick={exitFullscreen} className="absolute top-4 right-4 z-50 bg-void/85 backdrop-blur-sm border border-glass-border rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-text-primary hover:border-accent hover:text-accent transition-colors">
          Salir (ESC)
        </button>
      )}

      {/* CAM number + REC badge */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 pointer-events-none">
        <span className="px-2 py-1 bg-void/85 backdrop-blur-sm border border-glass-border/70 rounded-sm font-mono text-[11px] font-bold text-text-primary tracking-[0.14em] leading-none">
          {camNumber !== undefined ? `CAM ${String(camNumber).padStart(2, '0')}` : 'NVR'}
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 bg-recording/95 rounded-sm leading-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="font-mono text-[10px] font-bold text-on-accent tracking-[0.15em] leading-none">REC</span>
        </span>
      </div>

      {/* Timestamp + quick actions */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        {hasSignal && !isReconnecting && !recovering && (
          <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPtz(cameraId); }}
              aria-label="Control PTZ"
              title="Control PTZ"
              className="p-2 rounded-sm bg-void/85 backdrop-blur-sm border border-glass-border/70 text-text-secondary hover:border-accent hover:text-accent transition-colors"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleSnapshot(); }}
              aria-label="Snapshot"
              title="Snapshot"
              className="p-2 rounded-sm bg-void/85 backdrop-blur-sm border border-glass-border/70 text-text-secondary hover:border-accent hover:text-accent transition-colors"
            >
              <Aperture size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); enterFullscreen(); }}
              aria-label="Pantalla completa"
              title="Pantalla completa"
              className="p-2 rounded-sm bg-void/85 backdrop-blur-sm border border-glass-border/70 text-text-secondary hover:border-accent hover:text-accent transition-colors"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        )}
        {hasSignal && (
          <div className="bg-void/85 backdrop-blur-sm border border-glass-border/70 px-2.5 py-1 rounded-sm text-text-primary text-xs leading-none">
            <LiveTime />
          </div>
        )}
      </div>

      {/* Shimmer mientras conecta */}
      {isReconnecting && !hasSignal && (
        <div className="absolute inset-0 animate-shimmer" aria-hidden="true" />
      )}

      {(isReconnecting || recovering) && !hasSignal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/75 gap-2 z-10">
          <RefreshCw size={30} className="text-warning animate-spin" />
          <span className="text-warning text-sm font-semibold font-mono uppercase tracking-[0.18em]">Reconectando</span>
          {failures > 1 && (
            <span className="text-text-muted text-[11px] font-mono">Intento #{failures}</span>
          )}
        </div>
      )}

      {blackDetected && !isReconnecting && !recovering && !hasSignal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/85 gap-2 z-10">
          <AlertTriangle size={30} className="text-danger" />
          <span className="text-danger text-sm font-semibold font-mono uppercase tracking-[0.18em]">Pantalla negra</span>
          <span className="text-text-muted text-[11px] font-mono">Reinicio automatico</span>
        </div>
      )}

      {error && !hasSignal && !isReconnecting && !recovering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/70 backdrop-blur-sm gap-2">
          <CameraOff size={30} className="text-text-muted" />
          <span className="text-text-muted text-sm font-mono uppercase tracking-[0.18em]">Sin senal</span>
          <span className="text-text-muted text-[11px] font-mono">{name}</span>
        </div>
      )}

      {!hasSignal && !error && !isReconnecting && !recovering && !blackDetected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/70 backdrop-blur-sm gap-2">
          <Camera size={30} className="text-text-muted" />
          <span className="text-text-muted text-sm font-mono uppercase tracking-[0.18em]">Sin conexion</span>
          <span className="text-text-muted text-[11px] font-mono">{name}</span>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 bg-void/90 backdrop-blur-sm border-t border-glass-border/70 px-3 py-2 flex items-center justify-between ${compact ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-200' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-[1px] shrink-0 ${(isReconnecting || recovering) ? 'bg-warning' : blackDetected ? 'bg-danger' : hasSignal ? 'bg-accent' : 'bg-text-muted'}`} />
          <span className="text-xs font-semibold text-text-primary font-mono truncate">{name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasSignal && !isReconnecting && !recovering && <Radio size={12} className="text-live" />}
          {hasSignal && !isReconnecting && !recovering && <span className="font-mono text-[10px] text-live font-bold tracking-[0.16em]">LIVE</span>}
          {(isReconnecting || recovering) && <RefreshCw size={12} className="text-warning animate-spin" />}
          {(isReconnecting || recovering) && <span className="font-mono text-[10px] text-warning font-bold tracking-[0.16em]">RETRY</span>}
          {!hasSignal && !isReconnecting && !recovering && <span className="font-mono text-[10px] text-text-muted font-bold tracking-[0.16em]">OFFLINE</span>}
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Opciones"
            className="lg:hidden p-1 -mr-1 text-text-secondary hover:text-accent"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
        <div
          className="fixed inset-0 z-40"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
        />
        <div
          className="absolute top-8 right-2 bg-surface border border-glass-border rounded-sm shadow-xl z-50 min-w-[190px] py-1.5"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button onClick={() => { onOpenPtz(cameraId); setMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm font-mono text-text-secondary hover:bg-accent-bg hover:text-accent flex items-center gap-2.5">
            <Settings size={15} /> PTZ Control
          </button>
          <button onClick={() => { handleSnapshot(); setMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm font-mono text-text-secondary hover:bg-accent-bg hover:text-accent flex items-center gap-2.5">
            <Aperture size={15} /> Snapshot
          </button>
          <button onClick={() => { enterFullscreen(); setMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-sm font-mono text-text-secondary hover:bg-accent-bg hover:text-accent flex items-center gap-2.5">
            <Maximize2 size={15} /> Pantalla completa
          </button>
        </div>
        </>
      )}
    </div>
  );
}
