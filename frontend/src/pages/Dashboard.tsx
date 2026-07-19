import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, LayoutGrid, Columns, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../lib/api';
import type { Camera, WatchdogStatus } from '../lib/api';
import { CameraTile } from '../components/CameraTile';
import { PTZPanel } from '../components/PTZPanel';
import { useKeyboardPtz } from '../hooks/useKeyboardPtz';

const GAP = 8;

function SortableCameraTile({
  index,
  cam,
  wsUrl,
  watchdog,
  viewMode,
  isMain,
  onOpenPtz,
  onFocus,
  onBlur,
  onClick,
  tileHeight,
}: {
  index: number;
  cam: Camera;
  wsUrl: string;
  watchdog: WatchdogStatus | null;
  viewMode: string;
  isMain: boolean;
  onOpenPtz: (id: number) => void;
  onFocus: (id: number) => void;
  onBlur: () => void;
  onClick?: () => void;
  tileHeight?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: index });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    ...(tileHeight ? { height: tileHeight, minHeight: tileHeight } : {}),
  };

  if (viewMode === 'lmain' && !isMain) {
    return (
      <div ref={setNodeRef} style={style} className="relative group h-full">
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 z-20 p-1 rounded bg-surface/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        >
          <GripVertical size={14} className="text-text-muted" />
        </div>
        <div onClick={onClick} className="cursor-pointer h-full">
          <CameraTile
            index={index}
            name={cam.name}
            wsUrl={wsUrl}
            watchdog={watchdog}
            onOpenPtz={onOpenPtz}
            onFocus={onFocus}
            onBlur={onBlur}
            className="min-h-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group h-full">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-20 p-1.5 rounded-lg bg-surface/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical size={14} className="text-text-muted" />
      </div>
      <CameraTile
        index={index}
        name={cam.name}
        wsUrl={wsUrl}
        watchdog={watchdog}
        onOpenPtz={onOpenPtz}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  );
}

export function Dashboard() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [gridSize, setGridSize] = useState(4);
  const [viewMode, setViewMode] = useState<'grid' | 'lmain'>('grid');
  const [mainCamera, setMainCamera] = useState(0);
  const [ptzCamera, setPtzCamera] = useState<number | null>(null);
  const [focusedCamera, setFocusedCamera] = useState<number | null>(null);
  const [watchdogMap, setWatchdogMap] = useState<Map<number, WatchdogStatus>>(new Map());
  const [containerH, setContainerH] = useState(0);

  const lmainRef = useRef<HTMLDivElement>(null);

  const { connected: kbPtzConnected } = useKeyboardPtz(cameras.length, focusedCamera);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    if (viewMode !== 'lmain') return;
    const el = lmainRef.current;
    if (!el) return;

    const measure = () => setContainerH(el.clientHeight);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [viewMode]);

  const load = useCallback(async () => {
    const cams = await api.getCameras();
    setCameras(cams);
    const s = await api.getSettings();
    setGridSize(s.grid_size);
    setViewMode(s.view_mode as 'grid' | 'lmain');
    setMainCamera(Math.min(s.main_camera, Math.max(0, cams.length - 1)));
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

  const toggleView = useCallback(() => {
    const next = viewMode === 'grid' ? 'lmain' : 'grid';
    setViewMode(next);
    api.updateSettings({ view_mode: next });
  }, [viewMode]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;

    const oldIndex = active.id as number;
    const newIndex = over.id as number;

    setCameras(prev => arrayMove(prev, oldIndex, newIndex));
    api.reorderCameras(oldIndex, newIndex);

    if (mainCamera === oldIndex) {
      setMainCamera(newIndex);
      api.updateSettings({ main_camera: newIndex });
    } else if (mainCamera > oldIndex && mainCamera <= newIndex) {
      setMainCamera(mainCamera - 1);
      api.updateSettings({ main_camera: mainCamera - 1 });
    } else if (mainCamera < oldIndex && mainCamera >= newIndex) {
      setMainCamera(mainCamera + 1);
      api.updateSettings({ main_camera: mainCamera + 1 });
    }
  }, [mainCamera]);

  const handleColumnClick = useCallback((clickedIndex: number) => {
    if (clickedIndex === mainCamera) return;
    const newCameras = [...cameras];
    const mainCam = newCameras[mainCamera];
    const clickedCam = newCameras[clickedIndex];
    newCameras[mainCamera] = clickedCam;
    newCameras[clickedIndex] = mainCam;

    setCameras(newCameras);
    api.reorderCameras(mainCamera, clickedIndex);
  }, [cameras, mainCamera]);

  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const mjpegUrl = (i: number) => `${wsProtocol}//${location.host}/ws/mjpeg/${i}`;

  const cols = gridSize;
  const cameraIds = cameras.map((_, i) => i);

  const otherIndices = cameras.map((_, i) => i).filter(i => i !== mainCamera);

  const leftCount = Math.min(otherIndices.length, 4);
  const bottomCount = Math.max(0, otherIndices.length - leftCount);
  const leftIndices = otherIndices.slice(0, leftCount);
  const bottomIndices = otherIndices.slice(leftCount);

  const thumbH = leftCount > 0
    ? Math.max(80, Math.floor((containerH - (leftCount > 1 ? (leftCount - 1) * GAP : 0) - (bottomCount > 0 ? GAP : 0)) / (leftCount + (bottomCount > 0 ? 1 : 0))))
    : 120;
  const upperH = containerH - thumbH - (bottomCount > 0 ? GAP : 0);

  return (
    <div className="h-full flex bg-void">
      <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-text-primary">Sistema de Vigilancia AGARVEN</h1>
            <p className="text-xs text-text-muted">
              {cameras.length} camaras
              {focusedCamera !== null && cameras[focusedCamera]
                ? ` \u00b7 Flechas: ${cameras[focusedCamera].name}${kbPtzConnected ? ' \u2713' : ' ...'}`
                : ' \u00b7 Hover para flechas PTZ'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleView}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-elevated border border-glass-border hover:border-accent rounded-lg text-sm transition-all"
              title={viewMode === 'grid' ? 'Cambiar a vista L+MAIN' : 'Cambiar a vista Grid'}
            >
              {viewMode === 'grid' ? <Columns size={14} /> : <LayoutGrid size={14} />}
              <span className="hidden sm:inline">{viewMode === 'grid' ? 'L+MAIN' : 'Grid'}</span>
            </button>
            {viewMode === 'grid' && (
              <select
                value={gridSize}
                onChange={e => { setGridSize(Number(e.target.value)); api.updateSettings({ grid_size: Number(e.target.value) }); }}
                className="bg-elevated border border-glass-border rounded-lg px-3 py-1.5 text-sm"
              >
                {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}x{n}</option>)}
              </select>
            )}
            <button onClick={load} className="p-1.5 bg-elevated border border-glass-border hover:border-accent rounded-lg transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cameraIds} strategy={rectSortingStrategy}>
              <div
                className="flex-1 grid gap-2"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr' }}
              >
                {cameras.map((cam, i) => (
                  <SortableCameraTile
                    key={i}
                    index={i}
                    cam={cam}
                    wsUrl={mjpegUrl(i)}
                    watchdog={watchdogMap.get(i) ?? null}
                    viewMode="grid"
                    isMain={false}
                    onOpenPtz={setPtzCamera}
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
            </SortableContext>
          </DndContext>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div ref={lmainRef} className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex gap-2" style={{ height: upperH, minHeight: upperH }}>
                <div className="shrink-0 flex flex-col gap-2" style={{ width: 260 }}>
                  <SortableContext items={cameraIds} strategy={verticalListSortingStrategy}>
                    {leftIndices.map(i => (
                      <SortableCameraTile
                        key={i}
                        index={i}
                        cam={cameras[i]}
                        wsUrl={mjpegUrl(i)}
                        watchdog={watchdogMap.get(i) ?? null}
                        viewMode="lmain"
                        isMain={false}
                        onOpenPtz={setPtzCamera}
                        onFocus={setFocusedCamera}
                        onBlur={() => setFocusedCamera(null)}
                        onClick={() => handleColumnClick(i)}
                        tileHeight={thumbH}
                      />
                    ))}
                  </SortableContext>
                </div>
                <div className="flex-1 min-w-0 h-full flex flex-col">
                  {cameras.length > 0 && (
                    <SortableCameraTile
                      index={mainCamera}
                      cam={cameras[mainCamera]}
                      wsUrl={mjpegUrl(mainCamera)}
                      watchdog={watchdogMap.get(mainCamera) ?? null}
                      viewMode="lmain"
                      isMain={true}
                      onOpenPtz={setPtzCamera}
                      onFocus={setFocusedCamera}
                      onBlur={() => setFocusedCamera(null)}
                    />
                  )}
                </div>
              </div>
              {bottomCount > 0 && (
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${bottomCount}, 1fr)`, height: thumbH, minHeight: thumbH }}>
                  <SortableContext items={cameraIds} strategy={verticalListSortingStrategy}>
                    {bottomIndices.map(i => (
                      <SortableCameraTile
                        key={i}
                        index={i}
                        cam={cameras[i]}
                        wsUrl={mjpegUrl(i)}
                        watchdog={watchdogMap.get(i) ?? null}
                        viewMode="lmain"
                        isMain={false}
                        onOpenPtz={setPtzCamera}
                        onFocus={setFocusedCamera}
                        onBlur={() => setFocusedCamera(null)}
                        onClick={() => handleColumnClick(i)}
                        tileHeight={thumbH}
                      />
                    ))}
                  </SortableContext>
                </div>
              )}
            </div>
          </DndContext>
        )}
      </div>

      {ptzCamera !== null && (
        <PTZPanel cameraId={ptzCamera} cameraName={cameras[ptzCamera]?.name ?? ''} onClose={() => setPtzCamera(null)} />
      )}
    </div>
  );
}
