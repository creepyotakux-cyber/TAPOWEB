import { create } from "zustand"
import type { Camera, Settings } from "./api"

export interface CameraStore {
  cameras: Camera[]
  setCameras: (cameras: Camera[]) => void
  addCamera: (cam: Camera) => void
  updateCamera: (cam: Camera) => void
  removeCamera: (id: string) => void
}

export const useCameraStore = create<CameraStore>((set) => ({
  cameras: [],
  setCameras: (cameras) => set({ cameras }),
  addCamera: (cam) => set((s) => ({ cameras: [...s.cameras, cam] })),
  updateCamera: (cam) =>
    set((s) => ({
      cameras: s.cameras.map((c) => (c.id === cam.id ? cam : c)),
    })),
  removeCamera: (id) =>
    set((s) => ({ cameras: s.cameras.filter((c) => c.id !== id) })),
}))

interface SettingsState {
  settings: Settings | null
  setSettings: (s: Settings) => void
  theme: "dark" | "light"
  toggleTheme: () => void
  setTheme: (t: "dark" | "light") => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  theme: (localStorage.getItem("theme") as "dark" | "light") || "dark",
  setSettings: (s) => set({ settings: s }),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark"
      localStorage.setItem("theme", next)
      return { theme: next }
    }),
  setTheme: (t) => {
    localStorage.setItem("theme", t)
    set({ theme: t })
  },
}))

interface UIStore {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  commandOpen: boolean
  setCommandOpen: (v: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: localStorage.getItem("sidebar") === "collapsed",
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed
      localStorage.setItem("sidebar", next ? "collapsed" : "expanded")
      return { sidebarCollapsed: next }
    }),
  setSidebarCollapsed: (v) => {
    localStorage.setItem("sidebar", v ? "collapsed" : "expanded")
    set({ sidebarCollapsed: v })
  },
  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
}))


