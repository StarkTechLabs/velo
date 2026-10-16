import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import { Toaster } from "./components/ui/toaster"
import { loadRuntimeConfig } from "./lib/config"

import "./index.css"

loadRuntimeConfig().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <main>
        <div className="wrapper">
          <div>
            <App />
          </div>
        </div>
      </main>
      <Toaster />
    </StrictMode>,
  )
})
