import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'
import './styles/scrollbar.css'
// Importar logger para desabilitar console em produção
import './lib/logger'

// Link de recuperação de senha: forçar /redefinir-senha antes de qualquer auth (evita "login" imediato)
const isRecoveryRedirect =
  typeof window !== 'undefined' &&
  (window.location.hash || '').includes('type=recovery') &&
  window.location.pathname !== '/redefinir-senha'

if (isRecoveryRedirect) {
  window.location.replace(`${window.location.origin}/redefinir-senha${window.location.hash}`)
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}


