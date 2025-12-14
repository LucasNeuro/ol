import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Filter, 
  Trash2, 
  Edit, 
  X, 
  AlertCircle,
  CheckCircle2,
  Plus
} from 'lucide-react'
import { useFiltrosPermanentes } from '@/hooks/useFiltrosPermanentes'
import { useNotifications } from '@/hooks/useNotifications'
import { MontarFiltro } from '@/components/MontarFiltro'

export function FiltrosPermanentes() {
  const { 
    filtrosPermanentes, 
    isLoading, 
    toggleFiltroPermanente,
    atualizarFiltroPermanente,
    deletarFiltroPermanente,
    criarFiltroPermanente
  } = useFiltrosPermanentes()
  const { success, error: showError, confirm } = useNotifications()
  const [deletandoId, setDeletandoId] = useState(null)
  const [mostrarMontarFiltro, setMostrarMontarFiltro] = useState(false)
  const [filtroEditando, setFiltroEditando] = useState(null)

  const handleToggle = async (filtro) => {
    try {
      await toggleFiltroPermanente.mutateAsync({
        id: filtro.id,
        ativo: filtro.ativo
      })
      success(`Filtro "${filtro.nome}" ${filtro.ativo ? 'desativado' : 'ativado'} com sucesso`)
    } catch (err) {
      showError('Erro ao alterar status do filtro')
    }
  }

  const handleDelete = async (filtro) => {
    const confirmado = await confirm(
      'Excluir Filtro Permanente',
      `Tem certeza que deseja excluir o filtro "${filtro.nome}"? Esta ação não pode ser desfeita.`
    )

    if (!confirmado) return

    try {
      setDeletandoId(filtro.id)
      await deletarFiltroPermanente.mutateAsync(filtro.id)
      success('Filtro permanente excluído com sucesso')
    } catch (err) {
      showError('Erro ao excluir filtro permanente')
    } finally {
      setDeletandoId(null)
    }
  }

  const formatarCriterios = (criterios, filtrosExclusao) => {
    // Usar nova estrutura (criterios) ou estrutura antiga (filtrosExclusao)
    const crit = criterios || {}
    const exc = filtrosExclusao || {}
    
    const partes = []
    
    // Palavras
    const palavras = crit.palavras_objeto || exc.palavras_objeto || []
    if (palavras.length > 0) {
      partes.push(`${palavras.length} palavra(s)`)
    }
    
    // Estados
    const estados = crit.estados || exc.estados_excluir || []
    if (estados.length > 0) {
      partes.push(`${estados.length} estado(s)`)
    }
    
    // Modalidades
    if (crit.modalidades?.length > 0) {
      partes.push(`${crit.modalidades.length} modalidade(s)`)
    }
    
    // Valores
    if (crit.valor_min || crit.valor_max) {
      partes.push('faixa de valor')
    }
    
    // Órgãos
    if (crit.orgaos?.length > 0) {
      partes.push(`${crit.orgaos.length} órgão(ões)`)
    }
    
    return partes.length > 0 ? partes.join(', ') : 'Nenhum critério configurado'
  }

  const handleToggleModo = async (filtro) => {
    try {
      const novoModo = filtro.modo === 'incluir' ? 'excluir' : 'incluir'
      await atualizarFiltroPermanente.mutateAsync({
        id: filtro.id,
        modo: novoModo
      })
      success(`Filtro alterado para modo: ${novoModo === 'incluir' ? 'Incluir' : 'Excluir'}`)
    } catch (err) {
      showError('Erro ao alterar modo do filtro')
    }
  }

  const handleSalvarFiltro = async (dadosFiltro) => {
    try {
      if (filtroEditando) {
        await atualizarFiltroPermanente.mutateAsync({
          id: filtroEditando.id,
          ...dadosFiltro
        })
        success('Filtro atualizado com sucesso')
      } else {
        await criarFiltroPermanente.mutateAsync(dadosFiltro)
        success('Filtro criado com sucesso')
      }
      setMostrarMontarFiltro(false)
      setFiltroEditando(null)
    } catch (err) {
      showError('Erro ao salvar filtro')
    }
  }

  const handleEditar = (filtro) => {
    setFiltroEditando(filtro)
    setMostrarMontarFiltro(true)
  }

  const handleNovoFiltro = () => {
    setFiltroEditando(null)
    setMostrarMontarFiltro(true)
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">Carregando filtros permanentes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Botão Novo Filtro */}
      <Button
        onClick={handleNovoFiltro}
        className="w-full"
        size="sm"
        variant="outline"
      >
        <Plus className="w-4 h-4 mr-2" />
        Novo Filtro
      </Button>

      {filtrosPermanentes.length === 0 ? (
        <div className="text-center py-8">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">Nenhum filtro permanente cadastrado</p>
          <p className="text-xs text-gray-400">
            Clique em "Novo Filtro" para criar um filtro permanente
          </p>
        </div>
      ) : (
        <div className="space-y-3">
      {filtrosPermanentes.map((filtro) => {
        const estaDeletando = deletandoId === filtro.id
        
        return (
          <Card
            key={filtro.id}
            className={`
              transition-all duration-200
              ${filtro.ativo 
                ? 'border-blue-200 bg-blue-50/50 shadow-sm' 
                : 'border-gray-200 bg-white'
              }
              ${estaDeletando ? 'opacity-50' : ''}
            `}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                {/* Informações do Filtro */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className={`w-4 h-4 flex-shrink-0 ${
                      filtro.ativo ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <h4 className="font-semibold text-sm text-gray-900 truncate">
                      {filtro.nome}
                    </h4>
                    {filtro.ativo ? (
                      <Badge variant="default" className="bg-blue-500 text-white text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <X className="w-3 h-3 mr-1" />
                        Inativo
                      </Badge>
                    )}
                  </div>

                  {filtro.descricao && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-1">
                      {filtro.descricao}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {formatarCriterios(filtro.criterios, filtro.filtros_exclusao)}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {/* Toggle Modo Incluir/Excluir */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={filtro.modo === 'incluir'}
                      onCheckedChange={() => handleToggleModo(filtro)}
                      disabled={estaDeletando}
                    />
                    <Label className="text-xs text-gray-600">
                      {filtro.modo === 'incluir' ? 'Incluir' : 'Excluir'}
                    </Label>
                  </div>

                  {/* Toggle Ativo/Inativo */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={filtro.ativo}
                      onCheckedChange={() => handleToggle(filtro)}
                      disabled={estaDeletando}
                    />
                    <Label className="text-xs text-gray-600">
                      {filtro.ativo ? 'Ativo' : 'Inativo'}
                    </Label>
                  </div>

                  {/* Botão Editar */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditar(filtro)}
                    disabled={estaDeletando}
                    className="h-8 w-8 p-0"
                    title="Editar filtro"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  {/* Botão Deletar */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(filtro)}
                    disabled={estaDeletando}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Excluir filtro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
        </div>
      )}

      {/* Modal Montar Filtro */}
      <MontarFiltro
        open={mostrarMontarFiltro}
        onClose={() => {
          setMostrarMontarFiltro(false)
          setFiltroEditando(null)
        }}
        onSave={handleSalvarFiltro}
        filtroExistente={filtroEditando}
      />
    </div>
  )
}

