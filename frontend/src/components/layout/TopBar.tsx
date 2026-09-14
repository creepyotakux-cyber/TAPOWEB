import { useEffect, useState } from "react"
import { Sun, Moon, LogOut, HardDrive, Video } from "lucide-react"
import { api } from "@/lib/api"
import type { CalendarDay } from "@/lib/api"
import { useTicker } from "@/hooks/useTicker"

interface Props {
  page: string
  theme: string
  onToggleTheme: () => void
  role: string
  onLogout: () => void
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Monitor en vivo",
  dvr: "Reproduccion DVR",
  recordings: "Archivo de grabaciones",
  config: "Configuracion del sistema",
}

function formatSize(bytes: number) {
  if (bytes <= 0) return "0.0 GB"
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB`
}

export function TopBar({ page, theme, onToggleTheme, role, onLogout }: Props) {
  const now = useTicker()
  const [camOnline, setCamOnline] = useState(0)
  const [camTotal, setCamTotal] = useState(0)
  const [totalSize, setTotalSize] = useState(0)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const h = await api.health()
        if (cancelled) return
        const mjpeg = h.mjpeg ?? []
        setCamTotal(mjpeg.length)
        setCamOnline(mjpeg.filter((m) => m.has_signal).length)
      } catch {}
    }
    poll()
    const iv = setInterval(poll, 10000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.getCameras().then((cameras) => {
      const cams = cameras.filter((c) => c.enabled)
      return Promise.all(cams.map((c) => api.getDvrCalendar(c.id).catch<CalendarDay[]>(() => [])))
    }).then((calendars) => {
      if (cancelled || !calendars) return
      let total = 0
      calendars.flat().forEach((d) => { total += d.total_size })
      setTotalSize(total)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [page])

  const allOnline = camTotal > 0 && camOnline === camTotal

  return (
    <header className="h-14 shrink-0 bg-surface border-b border-glass-border flex items-center gap-3 px-3 lg:px-4 relative z-30">
      <div className="flex items-center gap-2.5 select-none">
        <span className="w-7 h-7 rounded-sm bg-accent flex items-center justify-center">
          <Video size={16} className="text-on-accent" />
        </span>
        <span className="font-display text-[16px] font-bold tracking-wide text-text-primary leading-none">
          AGARVEN<span className="text-accent"> NVR</span>
        </span>
      </div>

      <div className="h-6 w-px bg-glass-border hidden md:block" />

      <span className="hidden xl:block font-mono text-xl font-semibold uppercase tracking-[0.14em] text-text-primary">
        Sistema de Vigilancia AGARVEN
      </span>

      <div className="hidden md:flex items-center gap-4">
        <span className="flex items-center gap-1.5" title="Camaras con senal">
          <span className={`status-led ${allOnline ? "live" : camOnline > 0 ? "warn" : "off"}`} />
          <span className="font-mono text-xs text-text-secondary tabular-nums">CAM {camOnline}/{camTotal}</span>
        </span>
        <span className="flex items-center gap-1.5" title="Grabacion continua activa">
          <span className="w-1.5 h-1.5 rounded-full bg-recording animate-pulse" />
          <span className="font-mono text-xs text-text-secondary tabular-nums">REC {camTotal}</span>
        </span>
        <span className="hidden lg:flex items-center gap-1.5" title="Almacenamiento DVR">
          <HardDrive size={14} className="text-text-muted" />
          <span className="font-mono text-xs text-text-secondary tabular-nums">{formatSize(totalSize)}</span>
        </span>
      </div>

      <div className="flex-1" />

      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted hidden sm:block">
        {PAGE_TITLES[page] ?? ""}
      </span>

      <div className="h-6 w-px bg-glass-border hidden sm:block" />

      <span className="font-mono text-sm text-text-primary tabular-nums tracking-wide">
        {now.toLocaleTimeString("es-VE", { hour12: false })}
      </span>

      <span
        className={`hidden sm:inline font-mono text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-1 rounded-sm border ${
          role === "baseadv"
            ? "text-accent border-accent/40 bg-accent-bg/40"
            : "text-warning border-warning/40 bg-warning/10"
        }`}
      >
        {role === "baseadv" ? "Admin" : "Operador"}
      </span>

      <button
        onClick={onToggleTheme}
        aria-label="Cambiar tema"
        title="Cambiar tema"
        className="p-2 rounded-sm text-text-secondary hover:text-accent hover:bg-elevated border border-transparent hover:border-glass-border transition-all"
      >
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <button
        onClick={onLogout}
        aria-label="Cerrar sesion"
        title="Cerrar sesion"
        className="p-2 rounded-sm text-text-secondary hover:text-danger hover:bg-danger-dim/40 border border-transparent hover:border-danger/40 transition-all"
      >
        <LogOut size={17} />
      </button>
    </header>
  )
}
