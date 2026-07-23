import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from "@/lib/query"
import { ErrorBoundary } from "@/components/layout/ErrorBoundary"
import { ThemeSync } from "@/components/layout/ThemeSync"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={200}>
          <ErrorBoundary>
            <ThemeSync />
            <App />
            <Toaster
              position="bottom-right"
              theme="dark"
              closeButton
              richColors
            />
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
