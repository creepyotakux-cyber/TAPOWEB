import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import type { Camera, WatchdogStatus } from '../lib/api';
import { CameraTile } from '../components/CameraTile';
import { PTZPanel } from '../components/PTZPanel';
import { useKeyboardPtz } from '../hooks/useKeyboardPtz';

export function Dashboard() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [gridSize, setGridSize] = useState(4);
  const [ptzCamera, setPtzCamera] = useState<number | null>(null);
  const [focusedCamera, setFocusedCamera] = useState<number | null>(null);
  const [watchdogMap, setWatchdogMap] = useState<Map<number, WatchdogStatus>>(new Map());

  const { connected: kbPtzConnected } = useKeyboardPtz(cameras.length, focusedCamera);

  const load = useCallback(async () => {
    const cams = await api.getCameras();
    setCameras(cams);
    const s = await api.getSettings();
    setGridSize(s.grid_size);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pollWatchdog = useCallback(async () => {
    try {
      const h = await api.health();
      const map = new Map<number, WatchdogStatus>();
      for (const s of h.watchdog) {
        map.set(s.camera_id, s);
      }
      setWatchdogMap(map);
    } catch {}
  }, []);

  useEffect(() => {
    pollWatchdog();
    const iv = setInterval(pollWatchdog, 5000);
    return () => clearInterval(iv);
  }, [pollWatchdog]);

  const cols = gridSize;
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const mjpegUrl = (i: number) => `${wsProtocol}//${location.host}/ws/mjpeg/${i}`;

  return (
    <div className="h-full flex bg-void">
      <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">Dashboard</h1>
            <p className="text-xs text-text-muted">{cameras.length} camaras{focusedCamera !== null && cameras[focusedCamera] ? ` · Flechas: ${cameras[focusedCamera].name}${kbPtzConnected ? ' ✓' : ' ...'}` : ' · Hover para flechas PTZ'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={gridSize}
              onChange={e => { setGridSize(Number(e.target.value)); api.updateSettings({ grid_size: Number(e.target.value) }); }}
              className="bg-elevated border border-glass-border rounded-lg px-3 py-1.5 text-sm"
            >
              {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}x{n}</option>)}
            </select>
            <button onClick={load} className="p-1.5 bg-elevated border border-glass-border hover:border-accent rounded-lg transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div
          className="flex-1 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr' }}
        >
          {cameras.map((cam, i) => (
            <CameraTile
              key={i}
              index={i}
              name={cam.name}
              wsUrl={mjpegUrl(i)}
              watchdog={watchdogMap.get(i) ?? null}
              onOpenPtz={setPtzCamera}
              onFullscreenEnter={() => {}}
              onFullscreenExit={() => {}}
              onFocus={setFocusedCamera}
              onBlur={() => setFocusedCamera(null)}
            />
          ))}
          {Array.from({ length: Math.max(0, cols * cols - cameras.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="border-2 border-dashed border-glass-border rounded-lg flex items-center justify-center min-h-[180px] hover:border-accent-dim hover:bg-surface/50 transition-all cursor-pointer">
              <span className="text-text-muted text-sm">+</span>
            </div>
          ))}
        </div>
      </div>

      {ptzCamera !== null && (
        <PTZPanel cameraId={ptzCamera} cameraName={cameras[ptzCamera]?.name ?? ''} onClose={() => setPtzCamera(null)} />
      )}
    </div>
  );
}
