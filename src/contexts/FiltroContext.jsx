import { createContext, useContext, useState } from 'react'

const FiltroContext = createContext()

export function FiltroProvider({ children }) {
  const [processandoFiltro, setProcessandoFiltro] = useState(false)
  const [mensagemProgresso, setMensagemProgresso] = useState('')
  const [progressoPercentual, setProgressoPercentual] = useState(0)

  return (
    <FiltroContext.Provider value={{
      processandoFiltro,
      setProcessandoFiltro,
      mensagemProgresso,
      setMensagemProgresso,
      progressoPercentual,
      setProgressoPercentual
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

