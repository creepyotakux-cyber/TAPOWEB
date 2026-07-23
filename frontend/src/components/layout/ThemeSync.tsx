import { useEffect } from "react"
import { useSettingsStore } from "@/lib/store"

export function ThemeSync() {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    if (theme === "light") {
      root.classList.add("light")
    }
  }, [theme])

  return null
}
