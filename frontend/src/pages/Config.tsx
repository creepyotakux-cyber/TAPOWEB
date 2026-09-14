import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, Save, X, Camera as CameraIcon, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import type { Camera } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

export function Config() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Camera>>({ name: '', ip: '', user: '', password: '', model: '' });
  const [trailerCams, setTrailerCams] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const cams = await api.getCameras();
    setCameras(cams);
    try {
      const res = await api.getTrailerCameras();
      setTrailerCams(new Set(res.allowed_camera_ids));
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleTrailerCam = async (camId: string) => {
    let next: string[];
    if (trailerCams.has(camId)) {
      next = [...trailerCams].filter(id => id !== camId);
    } else {
      next = [...trailerCams, camId];
    }
    try {
      await api.setTrailerCameras(next);
      setTrailerCams(new Set(next));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      alert(msg);
    }
  };

  const handleSave = async () => {
    const ip = (form.ip || '').trim();
    if (!ip) { alert('La IP es obligatoria'); return; }
    try {
      if (editing !== null) {
        await api.updateCamera(editing, form);
      } else {
        await api.addCamera(form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', ip: '', user: '', password: '', model: '' });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      alert(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Eliminar esta camara?')) {
      await api.deleteCamera(id);
      load();
    }
  };

  const handleEdit = (cam: Camera) => {
    setForm({ ...cam });
    setEditing(cam.id);
    setShowForm(true);
  };

  const inputClass = 'w-full bg-void border border-glass-border/70 rounded-md px-3 py-2.5 text-sm font-mono text-text-primary placeholder-text-muted focus:border-accent focus:outline-none';

  return (
    <div className="h-full flex flex-col p-3 gap-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-void border border-glass-border/70 rounded-sm font-mono text-[10px] font-bold text-accent tracking-[0.14em] leading-none">CFG</span>
          <div>
            <h1 className="font-mono text-base font-bold uppercase tracking-[0.12em] text-text-primary">Configuracion</h1>
            <p className="font-mono text-[10px] text-text-muted">{cameras.length} camaras registradas</p>
          </div>
        </div>
<button onClick={() => { setForm({ name: '', ip: '', user: '', password: '', model: '' }); setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 bg-accent-dim hover:bg-accent text-on-accent px-3 py-2 rounded-md font-mono text-xs font-semibold uppercase tracking-[0.1em] transition-colors">
            <Plus size={14} /> Agregar
          </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <div className="border border-glass-border/60 rounded-sm overflow-hidden divide-y divide-glass-border/40">
          {cameras.map((cam, i) => (
            <div key={cam.id} className="bg-surface px-3 py-2.5 flex items-center gap-3 hover:bg-elevated/60 transition-colors">
              <span className="px-2 py-1 bg-void border border-glass-border/70 rounded-sm font-mono text-[10px] font-bold text-text-secondary tracking-[0.12em] leading-none shrink-0">
                CAM {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-xs font-mono font-semibold text-text-primary truncate">{cam.name}</h3>
                  {cam.enabled === false && (
                    <span className="px-1.5 py-[2px] bg-danger/15 border border-danger/40 rounded-sm font-mono text-[9px] font-bold text-danger uppercase tracking-[0.1em] leading-none">Off</span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-text-muted">{cam.ip} &middot; {cam.model || '—'}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleEdit(cam)} className="p-2 hover:bg-elevated rounded-sm transition-colors" title="Editar">
                  <Edit3 size={14} className="text-text-muted hover:text-accent" />
                </button>
                <button onClick={() => handleDelete(cam.id)} className="p-2 hover:bg-danger-dim rounded-sm transition-colors" title="Eliminar">
                  <Trash2 size={14} className="text-danger" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {cameras.length === 0 && (
          <EmptyState icon={CameraIcon} title="Sin cámaras configuradas" subtitle="Agrega tu primera cámara usando el botón de arriba." />
        )}

        {cameras.length > 0 && (
          <div className="border border-glass-border/60 rounded-sm overflow-hidden">
            <div className="px-3 py-2 bg-elevated/50 border-b border-glass-border/60">
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-text-primary">Camaras del Trailer</h2>
              <p className="text-[10px] font-mono text-text-muted mt-0.5">Selecciona que camaras puede ver el operador</p>
            </div>
            <div className="divide-y divide-glass-border/40">
              {cameras.map(cam => (
                <label key={cam.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface cursor-pointer hover:bg-elevated/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={trailerCams.has(cam.id)}
                    onChange={() => toggleTrailerCam(cam.id)}
                    className="w-4 h-4 rounded-sm accent-accent"
                  />
                  <span className="flex-1 text-xs font-mono text-text-primary truncate">{cam.name}</span>
                  <span className="font-mono text-[11px] text-text-muted">{cam.ip}</span>
                  {trailerCams.has(cam.id)
                    ? <Eye size={15} className="text-live" />
                    : <EyeOff size={15} className="text-text-muted" />
                  }
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-glass-border/60 rounded-sm p-5 w-full max-w-[420px] max-h-[90dvh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-glass-border/60 pb-3">
              <h2 className="text-sm font-mono font-bold uppercase tracking-[0.14em] text-text-primary">{editing !== null ? 'Editar Camara' : 'Agregar Camara'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-elevated rounded-sm text-text-secondary hover:text-accent transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Nombre" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              <input placeholder="IP (192.168.0.x)" value={form.ip || ''} onChange={e => setForm({ ...form, ip: e.target.value })} className={inputClass} />
              <input placeholder="Usuario" value={form.user || ''} onChange={e => setForm({ ...form, user: e.target.value })} className={inputClass} />
              <input placeholder="Contrasena" type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClass} />
              <input placeholder="Modelo (c200, c500...)" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} className={inputClass} />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-1.5 bg-accent-dim hover:bg-accent text-on-accent py-2.5 rounded-md font-mono text-xs font-semibold uppercase tracking-[0.1em] transition-colors">
                <Save size={14} /> {editing !== null ? 'Guardar' : 'Agregar'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-void border border-glass-border/70 rounded-md font-mono text-xs hover:border-accent transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
