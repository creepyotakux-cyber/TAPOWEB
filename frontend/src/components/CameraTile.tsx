import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Radio, Square, Maximize2, Settings, Aperture, RefreshCw, AlertTriangle } from 'lucide-react';
import { useMjpegWs } from '../hooks/useMjpegWs';
import { api } from '../lib/api';
import type { WatchdogStatus } from '../lib/api';

interface Props {
  index: number;
  name: string;
  wsUrl: string;
  watchdog: WatchdogStatus | null;
  onOpenPtz: (id: number) => void;
  onFullscreenEnter?: (id: number) => void;
  onFullscreenExit?: () => void;
  onFocus?: (id: number) => void;
  onBlur?: () => void;
  className?: string;
}

export function CameraTile({ index, name, wsUrl, watchdog, onOpenPtz, onFullscreenEnter, onFullscreenExit, onFocus, onBlur, className }: Props) {
  const { canvasRef, playing, error } = useMjpegWs(wsUrl);
  const [recording, setRecording] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const recovering = watchdog?.recovering ?? false;
  const blackDetected = watchdog?.black_detected ?? false;
  const failures = watchdog?.consecutive_failures ?? 0;

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
      onFullscreenEnter?.(index);
    } catch {}
  }, [index, onFullscreenEnter]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
  }, []);

  const handleRecord = async () => {
    if (recording) {
      await api.stopRecording(index);
      setRecording(false);
    } else {
      await api.startRecording(index);
      setRecording(true);
    }
  };

  const handleSnapshot = async () => {
    await api.takeSnapshot(index);
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-elevated border border-glass-border rounded-lg overflow-hidden group cursor-pointer min-h-[180px] ${isFullscreen ? 'flex flex-col' : ''} ${recovering ? 'ring-2 ring-warning/50' : ''} ${blackDetected ? 'ring-2 ring-danger/50' : ''} ${className ?? ''}`}
      onDoubleClick={enterFullscreen}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
      onMouseEnter={() => onFocus?.(index)}
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

      {recovering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/80 gap-2 z-10">
          <RefreshCw size={32} className="text-warning animate-spin" />
          <span className="text-warning text-sm font-semibold">Reconectando...</span>
          {failures > 1 && (
            <span className="text-text-muted text-[10px]">Intento #{failures}</span>
          )}
        </div>
      )}

      {blackDetected && !recovering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/80 gap-2 z-10">
          <AlertTriangle size={32} className="text-danger" />
          <span className="text-danger text-sm font-semibold">Pantalla negra detectada</span>
          <span className="text-text-muted text-[10px]">Reiniciando automaticamente</span>
        </div>
      )}

      {error && !playing && !recovering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/90 gap-2">
          <CameraOff size={32} className="text-text-muted" />
          <span className="text-text-muted text-sm">Sin senal</span>
        </div>
      )}

      {!playing && !error && !recovering && !blackDetected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/90 gap-2">
          <Camera size={32} className="text-text-muted animate-pulse" />
          <span className="text-text-muted text-sm">Conectando...</span>
        </div>
      )}

      {recording && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-recording/90 px-2 py-0.5 rounded text-white text-xs font-bold">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          REC
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-sm border-t border-glass-border px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={14} className={recovering ? 'text-warning' : blackDetected ? 'text-danger' : 'text-accent'} />
          <span className="text-xs font-semibold text-text-primary">{name}</span>
        </div>
        <div className="flex items-center gap-1">
          {playing && !recovering && <Radio size={12} className="text-live" />}
          {playing && !recovering && <span className="text-[10px] text-live font-bold">LIVE</span>}
          {recovering && <RefreshCw size={12} className="text-warning animate-spin" />}
          {recovering && <span className="text-[10px] text-warning font-bold">RETRY</span>}
        </div>
      </div>

      {menuOpen && (
        <div
          className="absolute top-8 right-2 bg-surface border border-glass-border rounded-lg shadow-xl z-50 min-w-[180px] py-1"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button onClick={() => { onOpenPtz(index); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-accent-bg hover:text-accent flex items-center gap-2">
            <Settings size={14} /> PTZ Control
          </button>
          <button onClick={() => { handleSnapshot(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-accent-bg hover:text-accent flex items-center gap-2">
            <Aperture size={14} /> Snapshot
          </button>
          <button onClick={() => { handleRecord(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-accent-bg hover:text-accent flex items-center gap-2">
            <Square size={14} /> {recording ? 'Detener grabacion' : 'Grabar'}
          </button>
          <button onClick={() => { enterFullscreen(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-accent-bg hover:text-accent flex items-center gap-2">
            <Maximize2 size={14} /> Pantalla completa
          </button>
        </div>
      )}
    </div>
  );
}
