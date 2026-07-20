import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, Save, X, Camera as CameraIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { Camera } from '../lib/api';

export function Config() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Camera>>({ name: '', ip: '', user: '', password: '', model: '' });

  const load = useCallback(async () => {
    const cams = await api.getCameras();
    setCameras(cams);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const inputClass = 'w-full bg-elevated border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none';

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Configuracion</h1>
          <p className="text-xs text-text-muted">{cameras.length} camaras registradas</p>
        </div>
        <button onClick={() => { setForm({ name: '', ip: '', user: '', password: '', model: '' }); setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 bg-accent-dim hover:bg-accent text-white px-3 py-1.5 rounded-lg text-sm transition-all">
          <Plus size={14} /> Agregar Camara
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {cameras.map((cam) => (
          <div key={cam.id} className="bg-surface border border-glass-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent-bg flex items-center justify-center">
              <CameraIcon size={20} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">{cam.name}</h3>
              <p className="text-xs text-text-muted">{cam.model || 'Sin modelo'} &middot; {cam.ip}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleEdit(cam)} className="p-2 hover:bg-elevated rounded-lg transition-all" title="Editar">
                <Edit3 size={14} className="text-text-muted" />
              </button>
              <button onClick={() => handleDelete(cam.id)} className="p-2 hover:bg-danger-dim rounded-lg transition-all" title="Eliminar">
                <Trash2 size={14} className="text-danger" />
              </button>
            </div>
          </div>
        ))}

        {cameras.length === 0 && (
          <div className="text-center py-16 text-text-muted">
            <CameraIcon size={48} className="mx-auto mb-3 opacity-30" />
            <p>No hay camaras configuradas</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-glass-border rounded-2xl p-6 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">{editing !== null ? 'Editar Camara' : 'Agregar Camara'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-elevated rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Nombre" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              <input placeholder="IP (192.168.0.x)" value={form.ip || ''} onChange={e => setForm({ ...form, ip: e.target.value })} className={inputClass} />
              <input placeholder="Usuario" value={form.user || ''} onChange={e => setForm({ ...form, user: e.target.value })} className={inputClass} />
              <input placeholder="Contrasena" type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClass} />
              <input placeholder="Modelo (c200, c500...)" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} className={inputClass} />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-1.5 bg-accent-dim hover:bg-accent text-white py-2 rounded-lg text-sm transition-all">
                <Save size={14} /> {editing !== null ? 'Guardar' : 'Agregar'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-elevated border border-glass-border rounded-lg text-sm hover:border-accent transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
