// ============================================================
// COMPONENTE: Painel de Notas e Anotações do Edital
// ============================================================
// Exibido como aba dentro do VisualizadorDocumento.
// Permite adicionar notas livres e citar trechos do documento.
// ============================================================

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  StickyNote,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Quote,
  FileText,
  Loader2,
  BookOpen,
} from 'lucide-react'
import { useNotasEdital } from '@/hooks/useNotasEdital'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function formatarData(iso) {
  try {
    return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR })
  } catch {
    return ''
  }
}

export function PainelNotas({ licitacaoId, paginaAtual = null }) {
  const { notas, isLoading, adicionarNota, adicionando, editarNota, deletarNota, habilitado } =
    useNotasEdital(licitacaoId)

  const [mostrando, setMostrando] = useState(false) // formulário de nova nota aberto
  const [novaNota, setNovaNota] = useState('')
  const [novoTrecho, setNovoTrecho] = useState('')
  const [novaPagina, setNovaPagina] = useState(paginaAtual ? String(paginaAtual) : '')
  const [erroForm, setErroForm] = useState('')

  const [editandoId, setEditandoId] = useState(null)
  const [textoEditado, setTextoEditado] = useState('')

  // ── Salvar nova nota ────────────────────────────────────────────────────
  const handleSalvar = async () => {
    setErroForm('')
    if (!novaNota.trim()) {
      setErroForm('A nota não pode estar vazia.')
      return
    }
    try {
      await adicionarNota({
        nota: novaNota,
        trechoCitado: novoTrecho || null,
        pagina: novaPagina ? parseInt(novaPagina, 10) : null,
      })
      setNovaNota('')
      setNovoTrecho('')
      setNovaPagina(paginaAtual ? String(paginaAtual) : '')
      setMostrando(false)
    } catch (e) {
      setErroForm(e.message || 'Erro ao salvar nota.')
    }
  }

  const handleCancelarForm = () => {
    setMostrando(false)
    setNovaNota('')
    setNovoTrecho('')
    setNovaPagina(paginaAtual ? String(paginaAtual) : '')
    setErroForm('')
  }

  // ── Editar nota existente ──────────────────────────────────────────────
  const handleIniciarEdicao = (nota) => {
    setEditandoId(nota.id)
    setTextoEditado(nota.nota)
  }

  const handleSalvarEdicao = async (id) => {
    try {
      await editarNota({ id, nota: textoEditado })
      setEditandoId(null)
    } catch (e) {
      // silencioso — pode mostrar toast se necessário
    }
  }

  const handleDeletar = async (id) => {
    try {
      await deletarNota(id)
    } catch (e) {
      // silencioso
    }
  }

  // ── Não habilitado (licitacaoId inválido) ──────────────────────────────
  if (!habilitado) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
        <BookOpen className="w-10 h-10 text-white/20 mb-3" />
        <p className="text-sm text-white/50">
          Notas disponíveis apenas ao visualizar documentos de uma licitação específica.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">
            {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
          </span>
        </div>
        {!mostrando && (
          <Button
            size="sm"
            onClick={() => setMostrando(true)}
            className="bg-yellow-500 hover:bg-yellow-400 text-black h-7 text-xs px-3 gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova nota
          </Button>
        )}
      </div>

      {/* Formulário de nova nota */}
      {mostrando && (
        <div className="px-4 py-3 border-b border-yellow-500/30 bg-yellow-500/5 flex-shrink-0 space-y-2">
          <p className="text-xs font-medium text-yellow-400 flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5" />
            Nova anotação
          </p>

          {/* Trecho citado (opcional) */}
          <div>
            <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
              <Quote className="w-3 h-3" />
              Trecho do documento (opcional)
            </label>
            <Textarea
              value={novoTrecho}
              onChange={(e) => setNovoTrecho(e.target.value)}
              placeholder="Cole ou digite um trecho do edital..."
              rows={2}
              className="text-xs bg-gray-700/60 border-gray-600 text-white placeholder:text-white/30 resize-none"
            />
          </div>

          {/* Nota */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">
              Sua anotação <span className="text-yellow-400">*</span>
            </label>
            <Textarea
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
              placeholder="Ex: Verificar certidão negativa estadual antes do prazo..."
              rows={3}
              autoFocus
              className="text-xs bg-gray-700/60 border-gray-600 text-white placeholder:text-white/30 resize-none"
            />
          </div>

          {/* Página */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/50 whitespace-nowrap flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Página
            </label>
            <Input
              type="number"
              value={novaPagina}
              onChange={(e) => setNovaPagina(e.target.value)}
              placeholder="ex: 3"
              min={1}
              className="w-20 h-7 text-xs bg-gray-700/60 border-gray-600 text-white placeholder:text-white/30"
            />
          </div>

          {erroForm && (
            <p className="text-xs text-red-400">{erroForm}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSalvar}
              disabled={adicionando || !novaNota.trim()}
              className="bg-yellow-500 hover:bg-yellow-400 text-black h-7 text-xs gap-1"
            >
              {adicionando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelarForm}
              className="text-white/60 hover:text-white hover:bg-gray-700 h-7 text-xs"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de notas */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          </div>
        )}

        {!isLoading && notas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3">
              <StickyNote className="w-7 h-7 text-yellow-500/40" />
            </div>
            <p className="text-sm text-white/50 mb-1">Nenhuma anotação ainda</p>
            <p className="text-xs text-white/30">
              Clique em "Nova nota" para registrar observações sobre este edital
            </p>
          </div>
        )}

        {notas.map((n) => (
          <div
            key={n.id}
            className="bg-gray-700/50 border border-white/10 rounded-lg p-3 space-y-2 hover:border-yellow-500/30 transition-colors"
          >
            {/* Trecho citado */}
            {n.trecho_citado && (
              <div className="border-l-2 border-yellow-500/60 pl-2">
                <p className="text-xs text-white/50 italic leading-relaxed line-clamp-3">
                  "{n.trecho_citado}"
                </p>
              </div>
            )}

            {/* Nota — modo edição */}
            {editandoId === n.id ? (
              <div className="space-y-2">
                <Textarea
                  value={textoEditado}
                  onChange={(e) => setTextoEditado(e.target.value)}
                  rows={3}
                  autoFocus
                  className="text-xs bg-gray-600 border-gray-500 text-white resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSalvarEdicao(n.id)}
                    disabled={!textoEditado.trim()}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black h-6 text-xs px-2 gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditandoId(null)}
                    className="text-white/60 hover:text-white h-6 text-xs px-2"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">
                {n.nota}
              </p>
            )}

            {/* Rodapé do card */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">
                  {formatarData(n.criado_em)}
                </span>
                {n.pagina && (
                  <Badge className="bg-gray-600 text-white/60 text-xs px-1.5 py-0 h-4 border-0">
                    p. {n.pagina}
                  </Badge>
                )}
                {n.atualizado_em !== n.criado_em && (
                  <span className="text-xs text-white/30 italic">editado</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editandoId !== n.id && (
                  <button
                    onClick={() => handleIniciarEdicao(n)}
                    className="text-white/40 hover:text-white/80 p-1 rounded transition-colors"
                    title="Editar nota"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleDeletar(n.id)}
                  className="text-white/40 hover:text-red-400 p-1 rounded transition-colors"
                  title="Excluir nota"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
