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
    <div className="w-[300px] bg-surface border-l border-glass-border flex flex-col h-full overflow-y-auto shrink-0">
      <div className="flex items-center justify-between p-4 border-b border-glass-border">
        <div>
          <h2 className="text-sm font-bold text-text-primary">PTZ Control</h2>
          <p className="text-[10px] text-text-muted">{cameraName}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-elevated rounded-lg"><X size={16} /></button>
      </div>

      {!connected && !error && (
        <div className="text-center py-8 text-text-muted text-xs">
          Conectando a ONVIF...
        </div>
      )}

      {!connected && error && (
        <div className="text-center py-8 px-4 flex flex-col gap-2">
          <AlertTriangle size={24} className="text-danger mx-auto" />
          <span className="text-danger text-xs font-semibold">Sin conexion ONVIF</span>
          <span className="text-text-muted text-[10px] leading-relaxed">{error}</span>
          <span className="text-text-muted text-[10px]">Reintentando automaticamente...</span>
        </div>
      )}

      {connected && (
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1">
            <button onMouseDown={() => move(0, -1)} onMouseUp={stop} onMouseLeave={stop} className="w-10 h-10 rounded-xl bg-elevated border border-glass-border hover:bg-accent-bg hover:border-accent flex items-center justify-center transition-all">
              <ChevronUp size={18} />
            </button>
            <div className="flex gap-1">
              <button onMouseDown={() => move(-1, 0)} onMouseUp={stop} onMouseLeave={stop} className="w-10 h-10 rounded-xl bg-elevated border border-glass-border hover:bg-accent-bg hover:border-accent flex items-center justify-center transition-all">
                <ChevronLeft size={18} />
              </button>
              <button onClick={home} className="w-10 h-10 rounded-xl bg-accent-dim hover:bg-accent flex items-center justify-center text-white transition-all">
                <Home size={18} />
              </button>
              <button onMouseDown={() => move(1, 0)} onMouseUp={stop} onMouseLeave={stop} className="w-10 h-10 rounded-xl bg-elevated border border-glass-border hover:bg-accent-bg hover:border-accent flex items-center justify-center transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
            <button onMouseDown={() => move(0, 1)} onMouseUp={stop} onMouseLeave={stop} className="w-10 h-10 rounded-xl bg-elevated border border-glass-border hover:bg-accent-bg hover:border-accent flex items-center justify-center transition-all">
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => led === 'on' ? ledOff() : ledOn()} className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-all ${led === 'on' ? 'bg-warning/20 border-warning text-warning' : 'bg-elevated border-glass-border hover:border-accent'}`}>
              {led === 'on' ? <Lightbulb size={14} /> : <LightbulbOff size={14} />}
              LED {led === 'on' ? 'ON' : 'OFF'}
            </button>
            <button onClick={handleSavePreset} className="flex items-center justify-center gap-2 py-2 rounded-lg border bg-elevated border-glass-border hover:border-accent text-xs transition-all">
              <CircleDot size={14} /> Guardar
            </button>
          </div>

          {presets.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted mb-1">Presets</p>
              <div className="flex flex-wrap gap-1">
                {presets.map(p => (
                  <button key={p.token} onClick={() => gotoPreset(p.token)} className="px-2 py-0.5 text-[10px] rounded-lg bg-elevated border border-glass-border hover:border-accent hover:bg-accent-bg transition-all">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={loadPresets} className="w-full py-1 text-[10px] text-accent hover:underline">Cargar presets</button>

          <div>
            <p className="text-[10px] text-text-muted mb-1">Cruce</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleCruiseH} className={`py-1.5 rounded-lg border text-xs transition-all ${activeCruise === 'h' ? 'bg-accent text-white' : 'bg-elevated border-glass-border hover:border-accent'}`}>
                <Compass size={12} className="inline mr-1" /> Horizontal
              </button>
              <button onClick={handleCruiseV} className={`py-1.5 rounded-lg border text-xs transition-all ${activeCruise === 'v' ? 'bg-accent text-white' : 'bg-elevated border-glass-border hover:border-accent'}`}>
                <Compass size={12} className="inline mr-1 rotate-90" /> Vertical
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-text-muted mb-1">Patrulla</p>
            <div className="flex gap-2">
              <select value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)} className="flex-1 bg-elevated border border-glass-border rounded-lg px-2 py-1.5 text-xs">
                <option value="">Seleccionar preset</option>
                {presets.map(p => <option key={p.token} value={p.token}>{p.name}</option>)}
              </select>
              <select value={patrolInterval} onChange={e => setPatrolInterval(Number(e.target.value))} className="w-16 bg-elevated border border-glass-border rounded-lg px-2 py-1.5 text-xs">
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
            </div>
            <button onClick={handlePatrol} disabled={!selectedPreset} className={`w-full mt-2 py-1.5 rounded-lg text-xs transition-all ${activePatrol ? 'bg-recording text-white' : selectedPreset ? 'bg-accent-dim hover:bg-accent text-white' : 'bg-elevated text-text-muted cursor-not-allowed'}`}>
              {activePatrol ? 'Detener patrulla' : 'Iniciar patrulla'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
