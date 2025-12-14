import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ESTADOS_POR_REGIAO } from '@/lib/setores'

export function SelecionarEstados({ open, onOpenChange, estadosSelecionados, onConfirm }) {
  const [estados, setEstados] = useState([])

  // Carregar estados já selecionados quando o modal abrir
  useEffect(() => {
    if (open && estadosSelecionados && estadosSelecionados.length > 0) {
      setEstados(estadosSelecionados)
    } else if (open) {
      setEstados([])
    }
  }, [open, estadosSelecionados])

  const handleToggleNacional = () => {
    if (estados.includes('Nacional')) {
      setEstados([])
    } else {
      setEstados(['Nacional'])
    }
  }

  const handleToggleRegiao = (regiao) => {
    const estadosDaRegiao = ESTADOS_POR_REGIAO[regiao]
      .filter(e => e !== 'Nacional')
      .map(e => typeof e === 'string' ? e : e.sigla)

    const todosSelecionados = estadosDaRegiao.every(uf => estados.includes(uf))
    
    if (todosSelecionados) {
      // Desmarcar todos da região
      setEstados(prev => prev.filter(e => !estadosDaRegiao.includes(e)))
    } else {
      // Marcar todos da região
      setEstados(prev => {
        const novos = [...prev]
        estadosDaRegiao.forEach(uf => {
          if (!novos.includes(uf)) {
            novos.push(uf)
          }
        })
        return novos
      })
    }
  }

  const handleToggleEstado = (sigla) => {
    setEstados(prev => {
      if (prev.includes(sigla)) {
        return prev.filter(e => e !== sigla)
      } else {
        return [...prev, sigla]
      }
    })
  }

  const estadosDaRegiaoSelecionados = (regiao) => {
    const estadosDaRegiao = ESTADOS_POR_REGIAO[regiao]
      .filter(e => e !== 'Nacional')
      .map(e => typeof e === 'string' ? e : e.sigla)
    
    return estadosDaRegiao.filter(uf => estados.includes(uf))
  }

  const handleConfirmar = () => {
    onConfirm(estados)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Selecione a abrangência de interesse</DialogTitle>
          <DialogDescription>
            Selecione os estados onde sua empresa tem interesse em participar de licitações
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Opção Nacional */}
          <div className="space-y-2 border-b pb-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="nacional"
                checked={estados.includes('Nacional')}
                onCheckedChange={handleToggleNacional}
              />
              <Label htmlFor="nacional" className="text-base font-semibold cursor-pointer">
                Nacional
              </Label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Selecionar Nacional desmarcará todos os estados específicos
            </p>
          </div>

          {/* Regiões */}
          {Object.entries(ESTADOS_POR_REGIAO)
            .filter(([regiao]) => regiao !== 'Nacional')
            .map(([regiao, estadosRegiao]) => {
              const estadosFiltrados = estadosRegiao.filter(e => e !== 'Nacional')
              const selecionados = estadosDaRegiaoSelecionados(regiao)
              const todosSelecionados = selecionados.length === estadosFiltrados.length && estadosFiltrados.length > 0

              return (
                <div key={regiao} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`regiao-${regiao}`}
                      checked={todosSelecionados}
                      onCheckedChange={() => handleToggleRegiao(regiao)}
                    />
                    <Label
                      htmlFor={`regiao-${regiao}`}
                      className="text-base font-semibold cursor-pointer"
                    >
                      Região {regiao}
                    </Label>
                  </div>

                  <div className="ml-6 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {estadosFiltrados.map((estado) => {
                      const sigla = typeof estado === 'string' ? estado : estado.sigla
                      const nome = typeof estado === 'string' ? estado : estado.nome
                      
                      return (
                        <div key={sigla} className="flex items-center space-x-2">
                          <Checkbox
                            id={`estado-${sigla}`}
                            checked={estados.includes(sigla)}
                            onCheckedChange={() => handleToggleEstado(sigla)}
                            disabled={estados.includes('Nacional')}
                          />
                          <Label
                            htmlFor={`estado-${sigla}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {nome}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          {/* Resumo */}
          {estados.length > 0 && (
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold">
                Estados selecionados ({estados.length}):
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {estados.map((estado) => {
                  if (estado === 'Nacional') {
                    return (
                      <span
                        key={estado}
                        className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold"
                      >
                        {estado}
                      </span>
                    )
                  }
                  
                  // Buscar nome do estado
                  let nomeEstado = estado
                  Object.values(ESTADOS_POR_REGIAO).forEach(estadosRegiao => {
                    estadosRegiao.forEach(e => {
                      if (typeof e !== 'string' && e.sigla === estado) {
                        nomeEstado = e.nome
                      }
                    })
                  })

                  return (
                    <span
                      key={estado}
                      className="text-xs bg-orange-100 text-orange-800 px-3 py-1 rounded-full"
                    >
                      {nomeEstado} ({estado})
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} className="bg-green-600 hover:bg-green-700">
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

