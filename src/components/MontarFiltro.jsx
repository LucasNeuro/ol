import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { X, Plus, Filter } from 'lucide-react'

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

const MODALIDADES = [
  'Pregão Eletrônico',
  'Pregão Presencial',
  'Concorrência Eletrônica',
  'Concorrência',
  'Dispensa Eletrônica',
  'Dispensa de Licitação',
  'Inexigibilidade',
  'Leilão',
  'Leilão - Eletrônico',
  'Tomada de Preços',
  'Convite',
  'Concurso',
  'Diálogo Competitivo'
]

export function MontarFiltro({ open, onClose, onSave, filtroExistente = null }) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [permanente, setPermanente] = useState(false)
  const [aplicarAutomaticamente, setAplicarAutomaticamente] = useState(false)
  const [modo, setModo] = useState('incluir')
  
  // Critérios
  const [palavrasObjeto, setPalavrasObjeto] = useState([])
  const [novaPalavra, setNovaPalavra] = useState('')
  const [estados, setEstados] = useState([])
  const [modalidades, setModalidades] = useState([])
  const [valorMin, setValorMin] = useState('')
  const [valorMax, setValorMax] = useState('')
  const [orgaos, setOrgaos] = useState([])
  const [novoOrgao, setNovoOrgao] = useState('')

  // Atualizar estados quando filtroExistente mudar ou modal abrir
  useEffect(() => {
    if (open) {
      if (filtroExistente) {
        // Normalizar critérios (pode estar em criterios ou filtros_exclusao._criterios)
        const criterios = filtroExistente.criterios || filtroExistente.filtros_exclusao?._criterios || {}
        const modoFiltro = filtroExistente.modo || filtroExistente.filtros_exclusao?._modo || 'incluir'
        const aplicarAuto = filtroExistente.aplicar_automaticamente !== undefined 
          ? filtroExistente.aplicar_automaticamente 
          : filtroExistente.filtros_exclusao?._aplicar_automaticamente || false

        setNome(filtroExistente.nome || '')
        setDescricao(filtroExistente.descricao || '')
        setPermanente(filtroExistente.permanente || filtroExistente.filtros_exclusao?._permanente || false)
        setAplicarAutomaticamente(aplicarAuto)
        setModo(modoFiltro)
        setPalavrasObjeto(criterios.palavras_objeto || [])
        setEstados(criterios.estados || [])
        setModalidades(criterios.modalidades || [])
        setValorMin(criterios.valor_min ? String(criterios.valor_min) : '')
        setValorMax(criterios.valor_max ? String(criterios.valor_max) : '')
        setOrgaos(criterios.orgaos || [])
      } else {
        // Resetar quando não há filtro existente (criar novo)
        setNome('')
        setDescricao('')
        setPermanente(false)
        setAplicarAutomaticamente(false)
        setModo('incluir')
        setPalavrasObjeto([])
        setEstados([])
        setModalidades([])
        setValorMin('')
        setValorMax('')
        setOrgaos([])
      }
      setNovaPalavra('')
      setNovoOrgao('')
    }
  }, [filtroExistente, open])

  const handleSalvar = () => {
    if (!nome.trim()) {
      alert('Por favor, digite um nome para o filtro')
      return
    }

    const criterios = {
      palavras_objeto: palavrasObjeto,
      estados: estados,
      modalidades: modalidades,
      valor_min: valorMin ? parseFloat(valorMin) : undefined,
      valor_max: valorMax ? parseFloat(valorMax) : undefined,
      orgaos: orgaos,
    }

    onSave({
      nome: nome.trim(),
      descricao: descricao.trim(),
      permanente,
      aplicar_automaticamente: aplicarAutomaticamente,
      modo,
      criterios
    })

    // Resetar
    setNome('')
    setDescricao('')
    setPermanente(false)
    setAplicarAutomaticamente(false)
    setModo('incluir')
    setPalavrasObjeto([])
    setEstados([])
    setModalidades([])
    setValorMin('')
    setValorMax('')
    setOrgaos([])
    onClose()
  }

  const adicionarPalavra = () => {
    if (novaPalavra.trim() && !palavrasObjeto.includes(novaPalavra.trim().toLowerCase())) {
      setPalavrasObjeto([...palavrasObjeto, novaPalavra.trim().toLowerCase()])
      setNovaPalavra('')
    }
  }

  const adicionarOrgao = () => {
    if (novoOrgao.trim() && !orgaos.includes(novoOrgao.trim())) {
      setOrgaos([...orgaos, novoOrgao.trim()])
      setNovoOrgao('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {filtroExistente ? 'Editar Filtro' : 'Montar Novo Filtro'}
          </DialogTitle>
          <DialogDescription>
            Configure os critérios do filtro. Todos os critérios devem ser atendidos (AND).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome e Descrição */}
          <div className="space-y-2">
            <Label>Nome do Filtro *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Filtro TI - Software"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o propósito deste filtro"
            />
          </div>

          {/* Configurações */}
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="permanente"
                checked={permanente}
                onCheckedChange={setPermanente}
              />
              <Label htmlFor="permanente" className="cursor-pointer">
                Filtro permanente
              </Label>
            </div>

            {permanente && (
              <div className="space-y-2 ml-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="aplicar-auto"
                    checked={aplicarAutomaticamente}
                    onCheckedChange={setAplicarAutomaticamente}
                  />
                  <Label htmlFor="aplicar-auto" className="cursor-pointer">
                    Aplicar automaticamente ao carregar
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Modo do Filtro</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="modo-incluir"
                        name="modo"
                        value="incluir"
                        checked={modo === 'incluir'}
                        onChange={(e) => setModo(e.target.value)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="modo-incluir" className="cursor-pointer">
                        Incluir (mostrar editais que atendem)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="modo-excluir"
                        name="modo"
                        value="excluir"
                        checked={modo === 'excluir'}
                        onChange={(e) => setModo(e.target.value)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="modo-excluir" className="cursor-pointer">
                        Excluir (esconder editais que atendem)
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Critérios */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Critérios do Filtro</h3>

            {/* Palavras no Objeto */}
            <div className="space-y-2">
              <Label>Palavras no Objeto (qualquer uma)</Label>
              <div className="flex gap-2">
                <Input
                  value={novaPalavra}
                  onChange={(e) => setNovaPalavra(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      adicionarPalavra()
                    }
                  }}
                  placeholder="Digite uma palavra e pressione Enter"
                />
                <Button type="button" onClick={adicionarPalavra} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {palavrasObjeto.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {palavrasObjeto.map((palavra, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {palavra}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={() => setPalavrasObjeto(palavrasObjeto.filter((_, i) => i !== idx))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Estados */}
            <div className="space-y-2">
              <Label>Estados (qualquer um)</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !estados.includes(value)) {
                    setEstados([...estados, value])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um estado" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.filter(uf => !estados.includes(uf)).map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {estados.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {estados.map((uf) => (
                    <Badge key={uf} variant="secondary" className="text-xs">
                      {uf}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={() => setEstados(estados.filter(e => e !== uf))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Modalidades */}
            <div className="space-y-2">
              <Label>Modalidades (qualquer uma)</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !modalidades.includes(value)) {
                    setModalidades([...modalidades, value])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {MODALIDADES.filter(mod => !modalidades.includes(mod)).map(mod => (
                    <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modalidades.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {modalidades.map((mod) => (
                    <Badge key={mod} variant="secondary" className="text-xs">
                      {mod}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={() => setModalidades(modalidades.filter(m => m !== mod))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Valor Estimado */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Valor Mínimo (R$)</Label>
                <Input
                  type="number"
                  value={valorMin}
                  onChange={(e) => setValorMin(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Máximo (R$)</Label>
                <Input
                  type="number"
                  value={valorMax}
                  onChange={(e) => setValorMax(e.target.value)}
                  placeholder="∞"
                />
              </div>
            </div>

            {/* Órgãos */}
            <div className="space-y-2">
              <Label>Órgãos (qualquer um)</Label>
              <div className="flex gap-2">
                <Input
                  value={novoOrgao}
                  onChange={(e) => setNovoOrgao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      adicionarOrgao()
                    }
                  }}
                  placeholder="Digite parte do nome do órgão"
                />
                <Button type="button" onClick={adicionarOrgao} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {orgaos.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {orgaos.map((orgao, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {orgao}
                      <X
                        className="w-3 h-3 ml-1 cursor-pointer"
                        onClick={() => setOrgaos(orgaos.filter((_, i) => i !== idx))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar}>
            Salvar Filtro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

