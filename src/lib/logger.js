/**
 * Logger condicional - só loga em desenvolvimento
 * Em produção, os logs são silenciados para evitar vazamento de informações sensíveis
 */

const isProd = import.meta.env.PROD
const isDev = import.meta.env.DEV

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args)
  },
  
  warn: (...args) => {
    if (isDev) console.warn(...args)
  },
  
  error: (...args) => {
    // Erros sempre logam (mas sanitizados em produção)
    if (isProd) {
      // Em produção, não logar dados sensíveis
      const sanitized = args.map(arg => {
        if (typeof arg === 'object') {
          return '[Object]'
        }
        return String(arg).replace(/[a-f0-9-]{36}/gi, '[UUID]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi, '[JWT]')
      })
      console.error(...sanitized)
    } else {
      console.error(...args)
    }
  },
  
  info: (...args) => {
    if (isDev) console.info(...args)
  },
  
  debug: (...args) => {
    if (isDev) console.debug(...args)
  },

  // Para quando realmente precisa logar em produção (ex: erro crítico)
  forceLog: (...args) => {
    console.log(...args)
  }
}

// Desabilitar console global em produção
if (isProd) {
  window.console.log = () => {}
  window.console.debug = () => {}
  window.console.info = () => {}
  // Manter console.error e console.warn para erros críticos
}
