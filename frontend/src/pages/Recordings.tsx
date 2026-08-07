import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Film, Image, Folder, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { getToken } from '../lib/auth';
import type { Camera, Recording, Snapshot } from '../lib/api';

const PAGE_SIZE = 10;

export function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [tab, setTab] = useState<'recordings' | 'snapshots'>('recordings');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    const r = await api.getRecordings();
    setRecordings(r);
    const s = await api.getSnapshots();
    setSnapshots(s);
    try {
      const c = await api.getCameras();
      setCameras(c);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleString('es-VE');

  const camNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cameras) m.set(c.id, c.name);
    return m;
  }, [cameras]);

  const recTotalPages = Math.max(1, Math.ceil(recordings.length / PAGE_SIZE));
  const snapTotalPages = Math.max(1, Math.ceil(snapshots.length / PAGE_SIZE));
  const recPage = Math.min(page, recTotalPages - 1);
  const snapPage = Math.min(page, snapTotalPages - 1);

  const pageRecordings = useMemo(() => {
    const start = recPage * PAGE_SIZE;
    return recordings.slice(start, start + PAGE_SIZE);
  }, [recordings, recPage]);

  const pageSnapshots = useMemo(() => {
    const start = snapPage * PAGE_SIZE;
    return snapshots.slice(start, start + PAGE_SIZE);
  }, [snapshots, snapPage]);

  const groups = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const r of pageRecordings) {
      const parts = r.filename.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '__manual';
      const arr = map.get(folder) ?? [];
      arr.push(r);
      map.set(folder, arr);
    }
    return [...map.entries()];
  }, [pageRecordings]);

  const groupLabel = (folder: string) => {
    if (folder === '__manual') return 'Manuales';
    const parts = folder.split('/');
    return parts[parts.length - 1];
  };

  const Pagination = ({ totalPages, current }: { totalPages: number; current: number }) => (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        onClick={() => setPage(Math.max(0, current - 1))}
        disabled={current === 0}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-elevated border border-glass-border hover:border-accent text-text-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={14} /> Anterior
      </button>
      <span className="text-xs text-text-muted">Pagina {current + 1} de {totalPages}</span>
      <button
        onClick={() => setPage(Math.min(totalPages - 1, current + 1))}
        disabled={current >= totalPages - 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-elevated border border-glass-border hover:border-accent text-text-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Siguiente <ChevronRight size={14} />
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div>
        <h1 className="text-lg font-bold text-text-primary">Grabaciones y Snapshots</h1>
        <div className="flex gap-2 mt-2">
          <button onClick={() => { setTab('recordings'); setPage(0); }} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${tab === 'recordings' ? 'bg-accent text-white' : 'bg-elevated border border-glass-border hover:border-accent'}`}>
            <Film size={14} className="inline mr-1" /> Grabaciones ({recordings.length})
          </button>
          <button onClick={() => { setTab('snapshots'); setPage(0); }} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${tab === 'snapshots' ? 'bg-accent text-white' : 'bg-elevated border border-glass-border hover:border-accent'}`}>
            <Image size={14} className="inline mr-1" /> Snapshots ({snapshots.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {tab === 'recordings' && (
          <div className="space-y-3">
            {groups.map(([folder, items]) => {
              const camId = folder.split('/')[0].replace('cam_', '');
              const camName = folder === '__manual' ? '' : (camNameMap.get(camId) ?? camId);
              return (
                <div key={folder}>
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <Folder size={14} className="text-accent shrink-0" />
                    <span className="text-xs font-bold text-text-primary tracking-wide">{groupLabel(folder)}</span>
                    {camName && <span className="text-xs text-text-muted">&middot; {camName}</span>}
                    <span className="text-[10px] text-text-muted">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map(r => (
                      <div key={r.filename} className="bg-surface border border-glass-border rounded-lg px-4 py-3 flex items-center gap-3">
                        <Film size={16} className="text-recording shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{r.filename.split('/').pop()}</p>
                          <p className="text-xs text-text-muted">{formatSize(r.size)} &middot; {formatDate(r.modified)}</p>
                        </div>
                        <a href={`/api/recordings/${r.filename}?token=${getToken() ?? ''}`} download className="p-2 hover:bg-elevated rounded-lg transition-all">
                          <Download size={14} className="text-accent" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {recordings.length === 0 && <p className="text-center py-16 text-text-muted">No hay grabaciones</p>}
            {recordings.length > 0 && <Pagination totalPages={recTotalPages} current={recPage} />}
          </div>
        )}

        {tab === 'snapshots' && (
          <div className="space-y-1">
            {pageSnapshots.map(s => (
              <div key={s.filename} className="bg-surface border border-glass-border rounded-lg px-4 py-3 flex items-center gap-3">
                <Image size={16} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{s.filename}</p>
                  <p className="text-xs text-text-muted">{formatSize(s.size)} &middot; {formatDate(s.modified)}</p>
                </div>
                <a href={`/api/snapshots/${s.filename}?token=${getToken() ?? ''}`} download className="p-2 hover:bg-elevated rounded-lg transition-all">
                  <Download size={14} className="text-accent" />
                </a>
              </div>
            ))}
            {snapshots.length === 0 && <p className="text-center py-16 text-text-muted">No hay snapshots</p>}
            {snapshots.length > 0 && <Pagination totalPages={snapTotalPages} current={snapPage} />}
          </div>
        )}
      </div>
    </div>
  );
}
