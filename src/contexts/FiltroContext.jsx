import { createContext, useContext, useState, useCallback } from 'react'

const FiltroContext = createContext()
const MAX_LOGS = 300

export function FiltroProvider({ children }) {
  const [processandoFiltro, setProcessandoFiltro] = useState(false)
  const [mensagemProgresso, setMensagemProgresso] = useState('')
  const [progressoPercentual, setProgressoPercentual] = useState(0)
  const [logsFiltro, setLogsFiltro] = useState([])

  const addLogFiltro = useCallback((mensagem, nivel = 'info') => {
    const entrada = {
      id: Date.now() + Math.random(),
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      mensagem: String(mensagem),
      nivel
    }
    setLogsFiltro(prev => {
      const next = [entrada, ...prev]
      return next.length > MAX_LOGS ? next.slice(0, MAX_LOGS) : next
    })
  }, [])

  const clearLogsFiltro = useCallback(() => setLogsFiltro([]), [])

  return (
    <FiltroContext.Provider value={{
      processandoFiltro,
      setProcessandoFiltro,
      mensagemProgresso,
      setMensagemProgresso,
      progressoPercentual,
      setProgressoPercentual,
      logsFiltro,
      addLogFiltro,
      clearLogsFiltro
    }}>
      {children}
    </FiltroContext.Provider>
  )
}

export function useFiltroContext() {
  const context = useContext(FiltroContext)
  if (!context) {
    throw new Error('useFiltroContext deve ser usado dentro de FiltroProvider')
  }
  return context
}


