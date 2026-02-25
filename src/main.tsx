import React from 'react'
import ReactDOM from 'react-dom/client'
import { startReactDsfr } from '@codegouvfr/react-dsfr/spa'
import App from './App.tsx'
import { Link } from 'react-router-dom'

declare module '@codegouvfr/react-dsfr/spa' {
  interface RegisterLink {
    Link: typeof Link;
  }
}

startReactDsfr({ defaultColorScheme: 'system', Link })

// Import DSFR styles for Vite/SPA
import '@codegouvfr/react-dsfr/main.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
