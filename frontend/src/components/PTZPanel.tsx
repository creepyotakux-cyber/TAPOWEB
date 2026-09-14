import { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Home, Lightbulb, LightbulbOff, Compass, CircleDot, X, AlertTriangle } from 'lucide-react';
import { usePtzWs } from '../hooks/usePtzWs';
import { api } from '../lib/api';
import type { Preset } from '../lib/api';

interface Props {
  cameraId: string;
  cameraName: string;
  onClose: () => void;
}

export function PTZPanel({ cameraId, cameraName, onClose }: Props) {
  const { connected, error, led, move, stop, home, gotoPreset, setPreset, cruiseH, cruiseV, stopCruise, patrol, stopPatrol, ledOn, ledOff } = usePtzWs(cameraId);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [patrolInterval, setPatrolInterval] = useState(10);
  const [activeCruise, setActiveCruise] = useState<'h' | 'v' | null>(null);
  const [activePatrol, setActivePatrol] = useState(false);

  const loadPresets = useCallback(async () => {
    try {
      const p = await api.getPresets(cameraId);
      setPresets(p);
    } catch {}
  }, [cameraId]);

  const handleSavePreset = async () => {
    const name = prompt('Nombre del preset:');
    if (name) {
      await setPreset(name);
      loadPresets();
    }
  };

  const handleCruiseH = () => {
    if (activeCruise === 'h') { stopCruise(); setActiveCruise(null); }
    else { cruiseH(); setActiveCruise('h'); }
  };

  const handleCruiseV = () => {
    if (activeCruise === 'v') { stopCruise(); setActiveCruise(null); }
    else { cruiseV(); setActiveCruise('v'); }
  };

  const handlePatrol = () => {
    if (activePatrol) { stopPatrol(); setActivePatrol(false); }
    else if (selectedPreset) { patrol([selectedPreset], patrolInterval); setActivePatrol(true); }
  };

  return (
    <>
    <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={onClose} />
    <div className="w-[300px] max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:w-full max-lg:h-auto max-lg:max-h-[75dvh] max-lg:rounded-t-sm max-lg:border-t max-lg:border-l-0 bg-surface border-l border-glass-border/60 flex flex-col h-full overflow-y-auto shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-1 bg-void border border-glass-border/70 rounded-sm font-mono text-[10px] font-bold text-text-secondary tracking-[0.14em] leading-none">PTZ</span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-text-primary font-mono truncate">{cameraName}</h2>
            <p className="text-[10px] text-text-muted font-mono">ONVIF &middot; puerto 2020</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-elevated rounded-sm text-text-secondary hover:text-accent transition-colors"><X size={17} /></button>
      </div>

      {!connected && !error && (
        <div className="text-center py-8 text-text-muted text-xs font-mono uppercase tracking-[0.16em]">
          Conectando ONVIF...
        </div>
      )}

      {!connected && error && (
        <div className="text-center py-8 px-4 flex flex-col gap-2">
          <AlertTriangle size={26} className="text-danger mx-auto" />
          <span className="text-danger text-xs font-mono uppercase tracking-[0.16em]">Sin conexion ONVIF</span>
          <span className="text-text-muted text-[11px] font-mono leading-relaxed">{error}</span>
          <span className="text-text-muted text-[11px] font-mono">Reintentando...</span>
        </div>
      )}

      {connected && (
        <div className="p-3 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1">
            <button onMouseDown={() => move(0, -1)} onMouseUp={stop} onMouseLeave={stop} onTouchStart={() => move(0, -1)} onTouchEnd={stop} onTouchCancel={stop} className="w-12 h-12 lg:w-11 lg:h-11 rounded-md bg-void border border-glass-border/70 text-text-secondary hover:border-accent hover:text-accent flex items-center justify-center transition-colors">
              <ChevronUp size={19} />
            </button>
            <div className="flex gap-1">
              <button onMouseDown={() => move(-1, 0)} onMouseUp={stop} onMouseLeave={stop} onTouchStart={() => move(-1, 0)} onTouchEnd={stop} onTouchCancel={stop} className="w-12 h-12 lg:w-11 lg:h-11 rounded-md bg-void border border-glass-border/70 text-text-secondary hover:border-accent hover:text-accent flex items-center justify-center transition-colors">
                <ChevronLeft size={19} />
              </button>
              <button onClick={home} className="w-12 h-12 lg:w-11 lg:h-11 rounded-md bg-accent-dim hover:bg-accent flex items-center justify-center text-on-accent transition-colors" title="Home">
                <Home size={19} />
              </button>
              <button onMouseDown={() => move(1, 0)} onMouseUp={stop} onMouseLeave={stop} onTouchStart={() => move(1, 0)} onTouchEnd={stop} onTouchCancel={stop} className="w-12 h-12 lg:w-11 lg:h-11 rounded-md bg-void border border-glass-border/70 text-text-secondary hover:border-accent hover:text-accent flex items-center justify-center transition-colors">
                <ChevronRight size={19} />
              </button>
            </div>
            <button onMouseDown={() => move(0, 1)} onMouseUp={stop} onMouseLeave={stop} onTouchStart={() => move(0, 1)} onTouchEnd={stop} onTouchCancel={stop} className="w-12 h-12 lg:w-11 lg:h-11 rounded-md bg-void border border-glass-border/70 text-text-secondary hover:border-accent hover:text-accent flex items-center justify-center transition-colors">
              <ChevronDown size={19} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => led === 'on' ? ledOff() : ledOn()} className={`flex items-center justify-center gap-2 py-2.5 rounded-md border text-xs font-mono transition-colors ${led === 'on' ? 'bg-warning/15 border-warning/60 text-warning' : 'bg-void border-glass-border/70 hover:border-accent hover:text-accent'}`}>
              {led === 'on' ? <Lightbulb size={15} /> : <LightbulbOff size={15} />}
              LED {led === 'on' ? 'ON' : 'OFF'}
            </button>
            <button onClick={handleSavePreset} className="flex items-center justify-center gap-2 py-2.5 rounded-md border bg-void border-glass-border/70 hover:border-accent hover:text-accent text-xs font-mono transition-colors">
              <CircleDot size={15} /> Guardar
            </button>
          </div>

          {presets.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted font-mono uppercase tracking-[0.18em] mb-1.5">Presets</p>
              <div className="flex flex-wrap gap-1">
                {presets.map(p => (
                  <button key={p.token} onClick={() => gotoPreset(p.token)} className="px-2.5 py-1.5 text-[11px] rounded-sm bg-void border border-glass-border/70 hover:border-accent hover:bg-accent-bg font-mono transition-colors">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={loadPresets} className="w-full py-1.5 text-[11px] text-accent font-mono hover:underline">Cargar presets</button>

          <div>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-[0.18em] mb-1.5">Cruce</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleCruiseH} className={`py-2 rounded-md border text-xs font-mono transition-colors ${activeCruise === 'h' ? 'bg-accent text-on-accent border-accent' : 'bg-void border-glass-border/70 hover:border-accent hover:text-accent'}`}>
                <Compass size={13} className="inline mr-1" /> Horizontal
              </button>
              <button onClick={handleCruiseV} className={`py-2 rounded-md border text-xs font-mono transition-colors ${activeCruise === 'v' ? 'bg-accent text-on-accent border-accent' : 'bg-void border-glass-border/70 hover:border-accent hover:text-accent'}`}>
                <Compass size={13} className="inline mr-1 rotate-90" /> Vertical
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-[0.18em] mb-1.5">Patrulla</p>
            <div className="flex gap-2">
              <select value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)} className="flex-1 bg-void border border-glass-border/70 rounded-md px-2.5 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent">
                <option value="">Seleccionar preset</option>
                {presets.map(p => <option key={p.token} value={p.token}>{p.name}</option>)}
              </select>
              <select value={patrolInterval} onChange={e => setPatrolInterval(Number(e.target.value))} className="w-[4.5rem] bg-void border border-glass-border/70 rounded-md px-2.5 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent">
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
            </div>
            <button onClick={handlePatrol} disabled={!selectedPreset} className={`w-full mt-2 py-2 rounded-md text-xs font-mono uppercase tracking-[0.12em] transition-colors ${activePatrol ? 'bg-recording text-on-accent' : selectedPreset ? 'bg-accent-dim hover:bg-accent text-on-accent' : 'bg-void text-text-muted cursor-not-allowed border border-glass-border/60'}`}>
              {activePatrol ? 'Detener patrulla' : 'Iniciar patrulla'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
