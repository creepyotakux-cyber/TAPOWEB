import { useState, useEffect, useCallback } from 'react';
import { Download, Film, Image } from 'lucide-react';
import { api } from '../lib/api';
import type { Recording, Snapshot } from '../lib/api';

export function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [tab, setTab] = useState<'recordings' | 'snapshots'>('recordings');

  const load = useCallback(async () => {
    const r = await api.getRecordings();
    setRecordings(r);
    const s = await api.getSnapshots();
    setSnapshots(s);
  }, []);

  useEffect(() => { load(); }, [load]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleString('es-VE');

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div>
        <h1 className="text-lg font-bold text-text-primary">Grabaciones y Snapshots</h1>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setTab('recordings')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${tab === 'recordings' ? 'bg-accent text-white' : 'bg-elevated border border-glass-border hover:border-accent'}`}>
            <Film size={14} className="inline mr-1" /> Grabaciones ({recordings.length})
          </button>
          <button onClick={() => setTab('snapshots')} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${tab === 'snapshots' ? 'bg-accent text-white' : 'bg-elevated border border-glass-border hover:border-accent'}`}>
            <Image size={14} className="inline mr-1" /> Snapshots ({snapshots.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {tab === 'recordings' && (
          <div className="space-y-1">
            {recordings.map(r => (
              <div key={r.filename} className="bg-surface border border-glass-border rounded-lg px-4 py-3 flex items-center gap-3">
                <Film size={16} className="text-recording shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{r.filename}</p>
                  <p className="text-xs text-text-muted">{formatSize(r.size)} &middot; {formatDate(r.modified)}</p>
                </div>
                <a href={`/api/recordings/${r.filename}`} download className="p-2 hover:bg-elevated rounded-lg transition-all">
                  <Download size={14} className="text-accent" />
                </a>
              </div>
            ))}
            {recordings.length === 0 && <p className="text-center py-16 text-text-muted">No hay grabaciones</p>}
          </div>
        )}

        {tab === 'snapshots' && (
          <div className="space-y-1">
            {snapshots.map(s => (
              <div key={s.filename} className="bg-surface border border-glass-border rounded-lg px-4 py-3 flex items-center gap-3">
                <Image size={16} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{s.filename}</p>
                  <p className="text-xs text-text-muted">{formatSize(s.size)} &middot; {formatDate(s.modified)}</p>
                </div>
                <a href={`/api/snapshots/${s.filename}`} download className="p-2 hover:bg-elevated rounded-lg transition-all">
                  <Download size={14} className="text-accent" />
                </a>
              </div>
            ))}
            {snapshots.length === 0 && <p className="text-center py-16 text-text-muted">No hay snapshots</p>}
          </div>
        )}
      </div>
    </div>
  );
}
