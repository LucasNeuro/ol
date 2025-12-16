import { useState, useEffect, useMemo } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useSetores } from '@/hooks/useSetores'
import { Loader2, Search } from 'lucide-react'

export function SelecionarSetores({ open, onOpenChange, setoresSelecionados, onConfirm }) {
  const { data: SETORES = [], isLoading: carregandoSetores } = useSetores()
  const [setorPrincipal, setSetorPrincipal] = useState('')
  const [subsetoresSelecionados, setSubsetoresSelecionados] = useState([])
  const [setoresAdicionados, setSetoresAdicionados] = useState([])
  const [buscaSetor, setBuscaSetor] = useState('')

  // Carregar setores já selecionados quando o modal abrir
  useEffect(() => {
    if (open && setoresSelecionados && setoresSelecionados.length > 0) {
      setSetoresAdicionados(setoresSelecionados)
    } else if (open) {
      setSetoresAdicionados([])
    }
  }, [open, setoresSelecionados])

  // Resetar campos quando mudar o setor principal
  useEffect(() => {
    setSubsetoresSelecionados([])
  }, [setorPrincipal])

  // Filtrar setores por busca
  const setoresFiltrados = useMemo(() => {
    if (!buscaSetor || !SETORES.length) return SETORES
    const buscaLower = buscaSetor.toLowerCase()
    return SETORES.filter(s => 
      s.setor.toLowerCase().includes(buscaLower) ||
      s.subsetores.some(sub => sub.toLowerCase().includes(buscaLower))
    )
  }, [buscaSetor, SETORES])

  const subsetoresDoSetor = useMemo(() => {
    if (!setorPrincipal || !SETORES.length) return []
    const setorEncontrado = SETORES.find(s => s.setor === setorPrincipal)
    return setorEncontrado?.subsetores || []
  }, [setorPrincipal, SETORES])

  const handleToggleSubsetor = (subsetor) => {
    setSubsetoresSelecionados(prev => {
      if (prev.includes(subsetor)) {
        return prev.filter(s => s !== subsetor)
      } else {
        return [...prev, subsetor]
      }
    })
  }

  const handleAdicionar = () => {
    if (!setorPrincipal) return

    const novoSetor = {
      setor: setorPrincipal,
      subsetores: subsetoresSelecionados
    }

    // Verificar se o setor já foi adicionado
    const setorJaExiste = setoresAdicionados.some(s => s.setor === setorPrincipal)
    
    if (setorJaExiste) {
      // Atualizar setor existente
      setSetoresAdicionados(prev => 
        prev.map(s => s.setor === setorPrincipal ? novoSetor : s)
      )
    } else {
      // Adicionar novo setor
      setSetoresAdicionados(prev => [...prev, novoSetor])
    }

    // Limpar campos
    setSetorPrincipal('')
    setSubsetoresSelecionados([])
  }

  const handleRemoverSetor = (setor) => {
    setSetoresAdicionados(prev => prev.filter(s => s.setor !== setor))
  }

  const handleConfirmar = () => {
    onConfirm(setoresAdicionados)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicione atividades</DialogTitle>
          <DialogDescription>
            Selecione um segmento e aguarde carregar as atividades
          </DialogDescription>
        </DialogHeader>

        {carregandoSetores ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <span className="ml-3 text-gray-600">Carregando setores...</span>
          </div>
        ) : (
        <div className="space-y-6 mt-4">
          {/* Busca de Setor */}
          <div className="space-y-2">
            <Label>Buscar setor (opcional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Digite para buscar um setor..."
                value={buscaSetor}
                onChange={(e) => setBuscaSetor(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Seleção de Setor Principal */}
          <div className="space-y-2">
            <Label>Selecione um segmento ({SETORES.length} disponíveis)</Label>
            <Select value={setorPrincipal} onValueChange={setSetorPrincipal}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um segmento" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {setoresFiltrados.map((setor) => (
                  <SelectItem key={setor.setor} value={setor.setor}>
                    {setor.setor} ({setor.subsetores.length} atividades)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {buscaSetor && (
              <p className="text-xs text-gray-500">
                {setoresFiltrados.length} setor(es) encontrado(s)
              </p>
            )}
          </div>

          {/* Lista de Subsetores */}
          {setorPrincipal && subsetoresDoSetor.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Selecione as atividades do segmento</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (subsetoresSelecionados.length === subsetoresDoSetor.length) {
                      // Desmarcar todos
                      setSubsetoresSelecionados([])
                    } else {
                      // Marcar todos
                      setSubsetoresSelecionados([...subsetoresDoSetor])
                    }
                  }}
                  className="text-xs"
                >
                  {subsetoresSelecionados.length === subsetoresDoSetor.length
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </Button>
              </div>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                {subsetoresDoSetor.map((subsetor) => (
                  <div key={subsetor} className="flex items-center space-x-2">
                    <Checkbox
                      id={`subsetor-${subsetor}`}
                      checked={subsetoresSelecionados.includes(subsetor)}
                      onCheckedChange={() => handleToggleSubsetor(subsetor)}
                    />
                    <Label
                      htmlFor={`subsetor-${subsetor}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {subsetor}
                    </Label>
                  </div>
                ))}
              </div>
              {subsetoresSelecionados.length > 0 && (
                <p className="text-xs text-gray-500">
                  {subsetoresSelecionados.length} de {subsetoresDoSetor.length} atividades selecionadas
                </p>
              )}
            </div>
          )}

          {/* Botão Adicionar */}
          {setorPrincipal && (
            <Button
              onClick={handleAdicionar}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Adicionar
            </Button>
          )}

          {/* Setores Adicionados */}
          {setoresAdicionados.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Setores selecionados:</Label>
              <div className="space-y-2">
                {setoresAdicionados.map((item) => (
                  <div
                    key={item.setor}
                    className="border rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.setor}</p>
                        {item.subsetores.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.subsetores.map((sub) => (
                              <span
                                key={sub}
                                className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoverSetor(item.setor)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
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
        )}
      </DialogContent>
    </Dialog>
  )
}

