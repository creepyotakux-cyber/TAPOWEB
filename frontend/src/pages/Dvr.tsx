import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Video, Play, Film, Trash2, RefreshCw,
  ChevronLeft, ChevronRight, Circle, X, Download, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Camera, CalendarDay, HourSegment } from '../lib/api';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatDateEs(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS_FULL[date.getDay()]}, ${d} de ${MONTHS_FULL[date.getMonth()]} de ${y}`;
}

function CalendarView({ days, selectedDate, onSelect }: {
  days: CalendarDay[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysByDate = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const calendarCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { date: string | null; dom: number | null }[] = [];
    for (let i = 0; i < startDow; i++) cells.push({ date: null, dom: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`,
        dom: d,
      });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, dom: null });
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  return (
    <div className="bg-surface border border-glass-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 rounded hover:bg-elevated transition-all">
          <ChevronLeft size={16} className="text-text-secondary" />
        </button>
        <h3 className="text-sm font-semibold text-text-primary">
          {MONTHS_ES[viewMonth]} {viewYear}
        </h3>
        <button onClick={nextMonth} className="p-1.5 rounded hover:bg-elevated transition-all">
          <ChevronRight size={16} className="text-text-secondary" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-text-muted py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, i) => {
          if (!cell.date) return <div key={i} className="aspect-square" />;
          const day = daysByDate.get(cell.date);
          const isToday = cell.date === todayStr;
          const isSelected = cell.date === selectedDate;
          const domNum = cell.date ? Number(cell.date.slice(-2)) : 0;
          const isFuture = (cell.dom ?? 0) > 0 &&
            (viewYear > todayYear || (viewYear === todayYear && viewMonth > todayMonth) ||
              (viewYear === todayYear && viewMonth === todayMonth && domNum > today.getDate()));
          return (
            <button
              key={i}
              onClick={() => day && cell.date && onSelect(cell.date)}
              disabled={!day || isFuture}
              className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs transition-all relative
                ${isSelected ? 'bg-accent text-white font-bold' : ''}
                ${!isSelected && day ? 'bg-elevated text-text-primary hover:bg-accent-bg hover:text-accent cursor-pointer' : ''}
                ${!day && !isFuture ? 'text-text-muted cursor-default' : ''}
                ${isFuture ? 'text-text-muted opacity-40 cursor-not-allowed' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-accent' : ''}
              `}
              title={day ? `${day.count} grabaciones` : ''}
            >
              <span>{cell.dom}</span>
              {day && (
                <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-recording'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HourGrid({ hours, selectedHour, onSelect }: {
  hours: HourSegment[];
  selectedHour: number | null;
  onSelect: (hour: number) => void;
}) {
  const all24 = Array.from({ length: 24 }, (_, h) => h);
  const byHour = new Map<number, HourSegment>();
  for (const h of hours) byHour.set(h.hour, h);

  return (
    <div className="bg-surface border border-glass-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Horas disponibles</h3>
      <div className="grid grid-cols-6 gap-2">
        {all24.map((h) => {
          const seg = byHour.get(h);
          const isSelected = h === selectedHour;
          const playable = seg?.playable !== false;
          return (
            <button
              key={h}
              onClick={() => seg && onSelect(h)}
              disabled={!seg || !playable}
              className={`rounded-lg p-2 flex flex-col items-center justify-center text-xs transition-all min-h-[60px]
                ${isSelected ? 'bg-accent text-white' : ''}
                ${!isSelected && seg && playable ? 'bg-elevated text-text-primary hover:bg-accent-bg hover:text-accent border border-glass-border' : ''}
                ${!seg || !playable ? 'bg-void/30 text-text-muted border border-glass-border/30 cursor-not-allowed' : ''}
              `}
              title={seg ? (playable ? `${pad(h)}:00 - ${pad(h + 1)}:00 (${formatSize(seg.size)})` : `${pad(h)}:00 — grabando (${formatSize(seg.size)})`) : ''}
            >
              <div className="flex items-center gap-1 font-semibold">
                {seg && !playable ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-recording animate-pulse" />
                ) : seg ? (
                  isSelected ? <Circle size={10} className="fill-white text-white" /> : <Play size={10} className="text-live" />
                ) : null}
                <span>{pad(h)}:00</span>
              </div>
              {seg ? (
                <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-text-muted'}`}>
                  {formatSize(seg.size)}
                </span>
              ) : (
                <span className="text-[9px] mt-0.5 text-text-muted opacity-50">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VideoPlayer({ filename, title, url, downloadUrl, onClose, onNext, onPrev }: {
  filename: string;
  title: string;
  url: string;
  downloadUrl: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const retriesRef = useRef(0);
  const MAX_RETRIES = 2;

  useEffect(() => {
    setLoading(true);
    setError(false);
    setErrorMsg('');
    retriesRef.current = 0;
    const v = videoRef.current;
    if (!v) return;

    let cancelled = false;

    const onLoaded = () => { if (!cancelled) setLoading(false); };
    const onErr = () => {
      if (cancelled) return;
      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current++;
        setTimeout(() => {
          if (!cancelled && v) {
            setLoading(true);
            setError(false);
            v.src = url;
            v.load();
          }
        }, 2000);
      } else {
        setError(true);
        setLoading(false);
        const code = v.error?.code;
        if (code === 3) setErrorMsg('Error de decodificacion — archivo corrupto o incompleto');
        else if (code === 4) setErrorMsg('Formato no soportado por el navegador');
        else setErrorMsg('No se pudo cargar el segmento');
      }
    };

    api.checkRecording(filename).then((res) => {
      if (cancelled) return;
      if (!res.playable) {
        setError(true);
        setLoading(false);
        if (res.reason.includes('in progress') || res.reason.includes('recording')) {
          setErrorMsg('Segmento en grabacion, aun no disponible');
        } else if (res.reason.includes('small')) {
          setErrorMsg('Segmento incompleto, grabacion en curso');
        } else if (res.reason.includes('moov')) {
          setErrorMsg('Archivo corrupto — segmento no finalizado');
        } else {
          setErrorMsg('Segmento no disponible');
        }
        return;
      }
      v.addEventListener('loadeddata', onLoaded);
      v.addEventListener('canplay', onLoaded);
      v.addEventListener('error', onErr);
      v.src = url;
    }).catch(() => {
      if (cancelled) return;
      v.addEventListener('loadeddata', onLoaded);
      v.addEventListener('canplay', onLoaded);
      v.addEventListener('error', onErr);
      v.src = url;
    });

    return () => {
      cancelled = true;
      v.removeEventListener('loadeddata', onLoaded);
      v.removeEventListener('canplay', onLoaded);
      v.removeEventListener('error', onErr);
    };
  }, [filename, url]);

  return (
    <div className="bg-surface border border-glass-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-glass-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {onPrev && (
            <button onClick={onPrev} className="p-1.5 rounded hover:bg-elevated transition-all text-text-secondary hover:text-accent" title="Hora anterior">
              <ChevronLeft size={14} />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} className="p-1.5 rounded hover:bg-elevated transition-all text-text-secondary hover:text-accent" title="Hora siguiente">
              <ChevronRight size={14} />
            </button>
          )}
          <a href={downloadUrl} download className="p-1.5 rounded hover:bg-elevated transition-all text-accent" title="Descargar">
            <Download size={14} />
          </a>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-elevated transition-all text-text-secondary hover:text-danger" title="Cerrar">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="relative bg-void aspect-video">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={28} className="text-accent animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm text-center px-4">
            {errorMsg}
          </div>
        )}
        <video
          ref={videoRef}
          controls
          autoPlay
          preload="metadata"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}

export function Dvr() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hours, setHours] = useState<HourSegment[]>([]);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedCameraRef = useRef(selectedCamera);
  const selectedDateRef = useRef(selectedDate);

  const loadCameras = useCallback(async () => {
    if (cameras.length > 0) return;
    try {
      const cams = await api.getCameras();
      setCameras(cams);
      if (cams.length > 0 && (!selectedCamera || !cams.find(c => c.id === selectedCamera))) {
        setSelectedCamera(cams[0].id);
      }
    } catch {}
  }, [cameras.length, selectedCamera]);

  const loadCalendar = useCallback(async () => {
    if (!selectedCamera) return;
    setLoadingCalendar(true);
    try {
      const c = await api.getDvrCalendar(selectedCamera);
      setCalendar(c);
    } catch {
      setCalendar([]);
    }
    setLoadingCalendar(false);
  }, [selectedCamera]);

  const loadHours = useCallback(async (date: string) => {
    try {
      const h = await api.getDvrHours(selectedCamera, date);
      setHours(h);
    } catch {
      setHours([]);
    }
  }, [selectedCamera]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  useEffect(() => {
    selectedCameraRef.current = selectedCamera;
    selectedDateRef.current = selectedDate;
  }, [selectedCamera, selectedDate]);

  useEffect(() => {
    if (!selectedCamera) return;
    loadCalendar();
    setSelectedDate(null);
    setHours([]);
    setSelectedHour(null);
  }, [selectedCamera, loadCalendar]);

  useEffect(() => {
    intervalRef.current = null;
    if (!selectedCamera) return;
    intervalRef.current = setInterval(() => {
      if (!selectedCameraRef.current) return;
      setAutoRefreshing(true);
      loadCalendar().finally(() => setAutoRefreshing(false));
      const currentDate = selectedDateRef.current;
      if (currentDate) loadHours(currentDate);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedCamera]);

  useEffect(() => {
    if (selectedDate) {
      loadHours(selectedDate);
      setSelectedHour(null);
    } else {
      setHours([]);
      setSelectedHour(null);
    }
  }, [selectedDate, loadHours]);

  const refreshCalendar = () => {
    loadCalendar();
    if (selectedDate) loadHours(selectedDate);
  };

  const handleCleanup = async () => {
    setCleanupBusy(true);
    try {
      const r = await api.cleanupDvr();
      setLastCleanup(`${r.deleted} archivos eliminados`);
      loadCalendar();
      if (selectedDate) loadHours(selectedDate);
    } catch {
      setLastCleanup('Error al limpiar');
    }
    setCleanupBusy(false);
    setTimeout(() => setLastCleanup(null), 5000);
  };

  const selectedSeg = useMemo(() => {
    if (selectedHour === null) return null;
    return hours.find((h) => h.hour === selectedHour) ?? null;
  }, [hours, selectedHour]);

  const nextHour = useMemo(() => {
    if (selectedHour === null) return null;
    return hours.find((h) => h.hour > selectedHour)?.hour ?? null;
  }, [hours, selectedHour]);

  const prevHour = useMemo(() => {
    if (selectedHour === null) return null;
    const prev = [...hours].reverse().find((h) => h.hour < selectedHour);
    return prev?.hour ?? null;
  }, [hours, selectedHour]);

  const selectedCam = cameras.find(c => c.id === selectedCamera);
  const cameraName = selectedCam?.name ?? 'Cam';
  const segUrl = selectedSeg ? api.recordingStreamUrl(selectedSeg.filename) : null;
  const segDownloadUrl = selectedSeg ? `/api/recordings/${selectedSeg.filename}` : null;
  const segTitle = selectedSeg && selectedDate
    ? `${cameraName} - ${selectedDate} ${pad(selectedSeg.hour)}:00 - ${pad((selectedSeg.hour + 1) % 24)}:00`
    : '';

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-y-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Video size={20} className="text-accent" />
          <h1 className="text-lg font-bold text-text-primary">DVR - Grabacion continua</h1>
          <div
            className="flex items-center gap-1.5 bg-recording/20 px-2 py-1 rounded border border-recording/40"
            title="Las camaras graban siempre. El DVR no se puede detener."
          >
            <div className="w-1.5 h-1.5 rounded-full bg-recording animate-pulse" />
            <span className="text-[10px] font-bold text-recording">REC</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="bg-elevated border border-glass-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.name || `Cam ${c.id}`}</option>
            ))}
          </select>
<button
              onClick={refreshCalendar}
              className="p-2 rounded-lg bg-elevated border border-glass-border text-text-secondary hover:text-accent hover:border-accent transition-all"
              title="Actualizar"
            >
              <RefreshCw size={14} className={(loadingCalendar || autoRefreshing) ? 'animate-spin' : ''} />
            </button>
          <button
            onClick={handleCleanup}
            disabled={cleanupBusy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-elevated border border-glass-border text-text-secondary hover:text-danger hover:border-danger transition-all disabled:opacity-50"
            title="Eliminar grabaciones antiguas"
          >
            <Trash2 size={14} className={cleanupBusy ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {lastCleanup && (
        <div className="bg-elevated border border-glass-border rounded-lg px-3 py-2 text-xs text-text-secondary">
          {lastCleanup}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
        <div className="lg:col-span-5 xl:col-span-4">
          <CalendarView days={calendar} selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
        <div className="lg:col-span-7 xl:col-span-8">
          {selectedDate ? (
            <>
              <div className="mb-2 text-xs text-text-muted">
                <Film size={12} className="inline mr-1" />
                {formatDateEs(selectedDate)}
              </div>
              <HourGrid hours={hours} selectedHour={selectedHour} onSelect={setSelectedHour} />
            </>
          ) : (
            <div className="bg-surface border border-glass-border rounded-lg p-4 h-full flex items-center justify-center text-text-muted text-sm">
              Selecciona una fecha del calendario para ver las horas grabadas
            </div>
          )}
        </div>
      </div>

      {selectedSeg && segUrl && segDownloadUrl && (
        <div className="mt-2">
          <VideoPlayer
            filename={selectedSeg.filename}
            title={segTitle}
            url={segUrl}
            downloadUrl={segDownloadUrl}
            onClose={() => setSelectedHour(null)}
            onNext={nextHour !== null ? () => setSelectedHour(nextHour) : undefined}
            onPrev={prevHour !== null ? () => setSelectedHour(prevHour) : undefined}
          />
        </div>
      )}

      {cameras.length === 0 && (
        <div className="text-center py-16 text-text-muted text-sm">
          No hay camaras configuradas. Ve a Configuracion para agregar una.
        </div>
      )}
    </div>
  );
}
