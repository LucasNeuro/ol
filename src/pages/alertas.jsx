// ============================================
// PÁGINA: Filtros salvos (alertas por e-mail)
// ============================================
// Lista os filtros salvos do usuário. Cada um pode ser ativado e ter um horário:
// nesse horário o sistema envia por e-mail as licitações que batem com o filtro.
// À direita, timeline de execuções dos alertas.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Mail, Clock, Trash2, Loader2, Filter, Edit2, ArrowRight, MessageCircle, Smartphone, CheckCircle2, XCircle, AlertTriangle, History, RefreshCw } from 'lucide-react'
import { useAlertasEmail, resumoFiltros } from '@/hooks/useAlertasEmail'
import { useNotifications } from '@/hooks/useNotifications'
import { supabase } from '@/lib/supabase'

function TimelineExecucoes({ alertasIds }) {
  const [execucoes, setExecucoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [erroQuery, setErroQuery] = useState(null)

  const carregarExecucoes = async () => {
    if (!alertasIds?.length) { setLoading(false); return }
    setLoading(true)
    setErroQuery(null)
    try {
      // Tentar buscar com created_at
      let { data, error } = await supabase
        .from('alertas_execucoes')
        .select('*')
        .in('alerta_id', alertasIds)
        .order('created_at', { ascending: false })
        .limit(50)

      // Se erro de coluna, tentar sem ordenação
      if (error?.message?.includes('created_at')) {
        const res2 = await supabase
          .from('alertas_execucoes')
          .select('*')
          .in('alerta_id', alertasIds)
          .limit(50)
        data = res2.data
        error = res2.error
      }

      if (error) {
        console.error('[Timeline] Erro na query alertas_execucoes:', error)
        setErroQuery(error.message)
      } else if (data) {
        console.log('[Timeline] Execuções carregadas:', data.length, data[0])
        // Ordenar no front se necessário
        const sorted = [...data].sort((a, b) => {
          const da = a.created_at || a.inserted_at || a.executado_em || a.data_execucao || ''
          const db = b.created_at || b.inserted_at || b.executado_em || b.data_execucao || ''
          return db.localeCompare(da)
        })
        setExecucoes(sorted)
      }
    } catch (e) {
      setErroQuery(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { carregarExecucoes() }, [alertasIds?.join(',')])

  const formatarData = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const hora = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dia}/${mes} ${hora}:${min}`
  }

  const getTs = (ex) => ex.created_at || ex.inserted_at || ex.executado_em || ex.data_execucao || ''

  const agruparPorDia = (items) => {
    const grupos = {}
    items.forEach(ex => {
      const ts = getTs(ex)
      const d = ts ? new Date(ts) : new Date()
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(ex)
    })
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
  }

  const formatarDiaLabel = (key) => {
    const [ano, mes, dia] = key.split('-')
    const hoje = new Date()
    const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia))
    const diff = Math.floor((hoje - data) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    return `${dia}/${mes}/${ano}`
  }

  const grupos = agruparPorDia(execucoes)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <History className="w-4 h-4 text-orange-500" />
          Histórico de envios
        </h3>
        <button
          onClick={carregarExecucoes}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
        </div>
      ) : erroQuery ? (
        <div className="text-center py-6 space-y-1">
          <XCircle className="w-6 h-6 mx-auto text-red-400" />
          <p className="text-xs text-red-600 font-medium">Erro ao carregar histórico</p>
          <p className="text-[11px] text-red-400 break-all">{erroQuery}</p>
          <p className="text-[11px] text-gray-400 mt-1">Verifique as permissões RLS da tabela <code className="bg-gray-100 px-1 rounded">alertas_execucoes</code></p>
        </div>
      ) : execucoes.length === 0 ? (
        <div className="text-center py-8">
          <History className="w-8 h-8 mx-auto text-gray-200 mb-2" />
          <p className="text-xs text-muted-foreground">Nenhum envio registrado ainda.</p>
          <p className="text-[11px] text-gray-400 mt-1">Os envios aparecem aqui após o horário agendado.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {grupos.map(([dia, items]) => (
            <div key={dia}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {formatarDiaLabel(dia)}
              </p>
              <div className="space-y-1.5">
                {items.map((ex) => (
                  <div
                    key={ex.id}
                    className={`relative pl-5 py-2 px-3 rounded-lg border text-xs transition-colors ${
                      ex.sucesso
                        ? 'bg-green-50/60 border-green-200'
                        : 'bg-red-50/60 border-red-200'
                    }`}
                  >
                    {/* Dot da timeline */}
                    <div className={`absolute left-1.5 top-3 w-2 h-2 rounded-full ${
                      ex.sucesso ? 'bg-green-500' : 'bg-red-400'
                    }`} />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {ex.sucesso ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                          )}
                          <span className={`font-medium ${ex.sucesso ? 'text-green-800' : 'text-red-800'}`}>
                            {ex.sucesso
                              ? ex.notificacao_enviada ? 'Enviado' : 'Sem novidades'
                              : 'Falha'}
                          </span>
                        </div>

                        {ex.total_encontrado > 0 && (
                          <p className="text-[11px] text-gray-600">
                            {ex.total_encontrado} licitação(ões) encontrada(s)
                          </p>
                        )}

                        {ex.sucesso && ex.total_encontrado === 0 && (
                          <p className="text-[11px] text-gray-500">
                            Nenhuma licitação nova no período
                          </p>
                        )}

                        {ex.erro_mensagem && (
                          <p className="text-[11px] text-red-600 mt-0.5 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="break-all">{ex.erro_mensagem}</span>
                          </p>
                        )}
                      </div>

                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatarData(getTs(ex))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AlertasContent() {
  const { alertas, alertasWhatsApp, isLoading, atualizar, remover } = useAlertasEmail()
  const { success, error: showError, confirm } = useNotifications()
  const [editandoId, setEditandoId] = useState(null)
  const [emailAlerta, setEmailAlerta] = useState('')
  const [horarioAlerta, setHorarioAlerta] = useState('08:00')
  const [whatsappAlerta, setWhatsappAlerta] = useState(false)
  const editandoAlerta = useMemo(() => {
    const all = [...(alertas || []).map((a) => ({ ...a, tipo: 'email' })), ...(alertasWhatsApp || [])]
    return all.find((a) => a.id === editandoId) || null
  }, [alertas, alertasWhatsApp, editandoId])
  const alertasUnificados = useMemo(() => {
    const email = (alertas || []).map((a) => ({ ...a, tipo: 'email' }))
    const whatsapp = alertasWhatsApp || []
    return [...email, ...whatsapp].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [alertas, alertasWhatsApp])

  const alertasIds = useMemo(() => alertasUnificados.map(a => a.id), [alertasUnificados])

  const toggleAtivo = async (alerta) => {
    try {
      await atualizar.mutateAsync({ id: alerta.id, ativo: !alerta.ativo })
      success(alerta.ativo ? 'Alerta desativado.' : 'Alerta ativado.')
    } catch (e) {
      showError('Erro ao atualizar: ' + (e?.message || e))
    }
  }

  const abrirEdicao = (alerta) => {
    setEditandoId(alerta.id)
    setEmailAlerta(alerta.email_notificacao || '')
    const h = alerta.horario_verificacao
    setHorarioAlerta(h ? String(h).slice(0, 5) : '08:00')
    setWhatsappAlerta(!!alerta.enviar_whatsapp)
  }

  const salvarEdicaoAlerta = async () => {
    if (!editandoId) return
    const payload = { id: editandoId, horario_verificacao: horarioAlerta }
    if (editandoAlerta?.tipo === 'email') {
      payload.email_notificacao = emailAlerta.trim() || null
      payload.enviar_whatsapp = whatsappAlerta
    }
    try {
      await atualizar.mutateAsync(payload)
      success('Alerta atualizado.')
      setEditandoId(null)
    } catch (e) {
      showError('Erro ao atualizar: ' + (e?.message || e))
    }
  }

  const excluir = async (alerta) => {
    const canal = alerta.tipo === 'whatsapp' ? 'WhatsApp' : 'e-mail'
    const ok = await confirm(
      'Excluir este filtro salvo?',
      `"${alerta.nome_alerta}" será removido e não receberá mais notificações por ${canal}.`
    )
    if (!ok) return
    try {
      await remover.mutateAsync(alerta.id)
      success('Filtro removido.')
    } catch (e) {
      showError('Erro ao remover: ' + (e?.message || e))
    }
  }

  return (
    <AppLayout>
      <div className="w-full px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="w-7 h-7 text-orange-500" />
              Filtros salvos e alertas por e-mail
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Salve filtros (estado, palavra-chave, setor etc.) e ative o envio por <strong>e-mail</strong> e/ou <strong>WhatsApp</strong> (cards com botões) no horário que preferir.
            </p>
          </div>
          <Link href="/licitacoes">
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Aplicar filtros e salvar
            </Button>
          </Link>
        </div>

        {/* Layout 2 colunas: Alertas | Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Coluna esquerda: Alertas */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Como funciona</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. Na tela de <strong>Licitações</strong>, aplique os filtros desejados (UF, busca, setor, valor, etc.) e clique em <strong>Salvar filtro atual</strong> no painel à esquerda.</p>
                <p>2. O filtro aparecerá aqui. Ative o interruptor e defina o <strong>horário</strong> em que deseja receber o e-mail.</p>
                <p>3. Todo dia, no horário configurado, o sistema busca as licitações que batem com esse filtro (últimos 2 dias) e envia por e-mail e/ou WhatsApp (no WhatsApp, no mesmo formato de card com botões do envio manual).</p>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : alertasUnificados.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-muted-foreground mb-2">Nenhum filtro salvo ainda.</p>
                  <p className="text-sm text-muted-foreground mb-4">Vá em Licitações, aplique filtros e use &quot;Salvar filtro atual&quot; no painel.</p>
                  <Link href="/licitacoes">
                    <Button variant="outline" className="gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Ir para Licitações
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alertasUnificados.map((alerta) => (
                  <Card key={alerta.id} className={alerta.ativo ? 'border-orange-200 bg-orange-50/30' : ''}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">{alerta.nome_alerta}</span>
                            {alerta.tipo === 'whatsapp' ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 border-0">
                                <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-0">
                                <Mail className="w-3 h-3 mr-1" /> E-mail
                              </Badge>
                            )}
                            {alerta.tipo !== 'whatsapp' && alerta.enviar_whatsapp && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 border-0">
                                <Smartphone className="w-3 h-3 mr-1" /> +WhatsApp
                              </Badge>
                            )}
                            {alerta.ativo && (
                              <Badge className="bg-green-600">Ativo</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate" title={resumoFiltros(alerta.filtros)}>
                            {resumoFiltros(alerta.filtros)}
                          </p>
                          {alerta.tipo === 'email' && alerta.email_notificacao && (
                            <p className="text-xs text-muted-foreground mt-1">E-mail: {alerta.email_notificacao}</p>
                          )}
                          {alerta.tipo === 'whatsapp' && (
                            <p className="text-xs text-muted-foreground mt-1">Enviado para os números cadastrados no painel de Licitações.</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {alerta.horario_verificacao ? String(alerta.horario_verificacao).slice(0, 5) : '—'}
                          </div>
                          <Switch
                            checked={!!alerta.ativo}
                            onCheckedChange={() => toggleAtivo(alerta)}
                            className="data-[state=checked]:bg-orange-500"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEdicao(alerta)} title={alerta.tipo === 'whatsapp' ? 'Editar horário' : 'Editar horário e e-mail'}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => excluir(alerta)} title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Coluna direita: Timeline de execuções */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardContent className="pt-4 pb-4">
                <TimelineExecucoes alertasIds={alertasIds} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal editar horário e e-mail */}
      <Dialog open={!!editandoId} onOpenChange={(open) => !open && setEditandoId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar alerta</DialogTitle>
            <DialogDescription>
              {editandoAlerta?.tipo === 'whatsapp' ? 'Altere o horário do envio por WhatsApp.' : 'Altere o horário e o e-mail de recebimento.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editandoAlerta?.tipo !== 'whatsapp' && (
              <div>
                <Label>E-mail para receber</Label>
                <Input type="email" value={emailAlerta} onChange={(e) => setEmailAlerta(e.target.value)} placeholder="seu@email.com" className="mt-1" />
              </div>
            )}
            <div>
              <Label>Horário do envio (diário)</Label>
              <Input type="time" value={horarioAlerta} onChange={(e) => setHorarioAlerta(e.target.value)} className="mt-1" />
            </div>
            {editandoAlerta?.tipo !== 'whatsapp' && (
              <div className="flex items-center justify-between rounded-lg border p-3 bg-green-50 border-green-200">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Também enviar por WhatsApp</p>
                    <p className="text-xs text-green-700">Envia para os números cadastrados na tela de Licitações</p>
                  </div>
                </div>
                <Switch
                  checked={whatsappAlerta}
                  onCheckedChange={setWhatsappAlerta}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoId(null)}>Cancelar</Button>
            <Button onClick={salvarEdicaoAlerta} disabled={atualizar.isPending}>
              {atualizar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export function AlertasPage() {
  return (
    <ProtectedRoute>
      <AlertasContent />
    </ProtectedRoute>
  )
}
