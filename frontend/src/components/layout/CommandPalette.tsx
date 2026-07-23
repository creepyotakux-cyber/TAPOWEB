import { useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useUIStore, useSettingsStore } from "@/lib/store"
import {
  LayoutDashboard,
  Settings,
  Video,
  FolderOpen,
  Sun,
  Moon,
} from "lucide-react"

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)
  const theme = useSettingsStore((s) => s.theme)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)
  const navigate = useNavigate()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    },
    [open, setOpen]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar acci\u00f3n o p\u00e1gina..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Navegar">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/dvr")}>
            <Video className="w-4 h-4 mr-2" />
            DVR
          </CommandItem>
          <CommandItem onSelect={() => go("/config")}>
            <Settings className="w-4 h-4 mr-2" />
            Configuraci\u00f3n
          </CommandItem>
          <CommandItem onSelect={() => go("/recordings")}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Grabaciones
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Acciones">
          <CommandItem onSelect={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="w-4 h-4 mr-2" />
            ) : (
              <Moon className="w-4 h-4 mr-2" />
            )}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
