import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Search, Monitor, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/lib/store"
import { api } from "@/lib/api"
import type { CalendarDay } from "@/lib/api"

export function TopBar() {
  const location = useLocation()
  const setCommandOpen = useUIStore((s) => s.setCommandOpen)
  const [time, setTime] = useState(new Date())
  const [totalSize, setTotalSize] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    api.getCameras().then((cameras) => {
      if (cameras.length === 0) return
      const cams = cameras.filter((c) => c.enabled)
      Promise.all(
        cams.map((c) =>
          api.getDvrCalendar(c.id).catch<CalendarDay[]>(() => [])
        )
      ).then((calendars) => {
        let total = 0
        calendars.flat().forEach((d) => { total += d.total_size })
        setTotalSize(total)
      }).catch(() => {})
    }).catch(() => {})
  }, [location.pathname])

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 GB"
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  const pageTitle =
    location.pathname === "/" || location.pathname === "/dashboard"
      ? "Sistema de Vigilancia"
      : location.pathname === "/config"
        ? "Configuraci\u00f3n"
        : location.pathname.startsWith("/dvr")
          ? "DVR"
          : location.pathname === "/recordings"
            ? "Grabaciones"
            : ""

  return (
    <header className="h-20 border-b-2 border-accent/40 bg-gradient-to-r from-accent-dim/20 via-accent-bg/30 to-accent-dim/20 backdrop-blur-sm flex items-center justify-between px-8 shrink-0 shadow-[0_2px_12px_rgba(34,211,238,0.15)]">
      <div className="flex items-center gap-6">
        <h1 className="text-2xl font-bold text-accent tracking-wide">{pageTitle}</h1>
        <span className="text-lg text-text-muted tabular-nums font-mono">
          {time.toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden md:flex items-center gap-3 text-lg text-text-secondary mr-3">
          <HardDrive className="w-6 h-6" />
          <span>{formatSize(totalSize)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-text-secondary hover:text-accent hover:bg-accent-bg/50"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="w-6 h-6" />
          <span className="sr-only">Buscar</span>
        </Button>
        <div className="hidden sm:flex items-center gap-2.5 text-lg text-text-muted">
          <Monitor className="w-6 h-6" />
          <span>AGARVEN v1.0</span>
        </div>
      </div>
    </header>
  )
}
