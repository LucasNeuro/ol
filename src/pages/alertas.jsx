// ============================================
// PÁGINA: Filtros salvos (alertas por e-mail)
// ============================================
// Lista os filtros salvos do usuário. Cada um pode ser ativado e ter um horário:
// nesse horário o sistema envia por e-mail as licitações que batem com o filtro.

import { useState } from 'react'
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
import { Mail, Clock, Trash2, Loader2, Filter, Edit2, ArrowRight } from 'lucide-react'
import { useAlertasEmail, resumoFiltros } from '@/hooks/useAlertasEmail'
import { useNotifications } from '@/hooks/useNotifications'

function AlertasContent() {
  const { alertas, isLoading, atualizar, remover } = useAlertasEmail()
  const { success, error: showError, confirm } = useNotifications()
  const [editandoId, setEditandoId] = useState(null)
  const [emailAlerta, setEmailAlerta] = useState('')
  const [horarioAlerta, setHorarioAlerta] = useState('08:00')

  const toggleAtivo = async (alerta) => {
    try {
      await atualizar.mutateAsync({ id: alerta.id, ativo: !alerta.ativo })
      success(alerta.ativo ? 'Alerta desativado.' : 'Alerta ativado.')
    } catch (e) {
      showError('Erro ao atualizar: ' + (e?.message || e))
    }
  }

  const salvarEdicao = async () => {
    if (!editandoId) return
    try {
      await atualizar.mutateAsync({
        id: editandoId,
        horario_verificacao: horarioAlerta,
        email_notificacao: emailAlerta.trim() || null,
      })
      success('Alerta atualizado.')
      setEditandoId(null)
    } catch (e) {
      showError('Erro ao atualizar: ' + (e?.message || e))
    }
  }

  const abrirEdicao = (alerta) => {
    setEditandoId(alerta.id)
    setEmailAlerta(alerta.email_notificacao || '')
    const h = alerta.horario_verificacao
    setHorarioAlerta(h ? String(h).slice(0, 5) : '08:00')
  }

  const excluir = async (alerta) => {
    const ok = await confirm(
      'Excluir este filtro salvo?',
      `"${alerta.nome_alerta}" será removido e não receberá mais e-mails.`
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
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="w-7 h-7 text-orange-500" />
              Filtros salvos e alertas por e-mail
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Salve filtros (estado, palavra-chave, setor etc.) e ative o envio por e-mail no horário que preferir.
            </p>
          </div>
          <Link href="/licitacoes">
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Aplicar filtros e salvar
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Na tela de <strong>Licitações</strong>, aplique os filtros desejados (UF, busca, setor, valor, etc.) e clique em <strong>Salvar filtro atual</strong> no painel à esquerda.</p>
            <p>2. O filtro aparecerá aqui. Ative o interruptor e defina o <strong>horário</strong> em que deseja receber o e-mail.</p>
            <p>3. Todo dia, no horário configurado, o sistema busca as licitações que batem com esse filtro (últimos 2 dias) e envia um resumo para o e-mail informado.</p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : alertas.length === 0 ? (
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
          <div className="space-y-4">
            {alertas.map((alerta) => (
              <Card key={alerta.id} className={alerta.ativo ? 'border-orange-200 bg-orange-50/30' : ''}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{alerta.nome_alerta}</span>
                        {alerta.ativo && (
                          <Badge className="bg-green-600">Ativo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate" title={resumoFiltros(alerta.filtros)}>
                        {resumoFiltros(alerta.filtros)}
                      </p>
                      {alerta.email_notificacao && (
                        <p className="text-xs text-muted-foreground mt-1">E-mail: {alerta.email_notificacao}</p>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEdicao(alerta)} title="Editar horário e e-mail">
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

      {/* Modal editar horário e e-mail */}
      <Dialog open={!!editandoId} onOpenChange={(open) => !open && setEditandoId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar alerta</DialogTitle>
            <DialogDescription>Altere o horário e o e-mail de recebimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>E-mail para receber</Label>
              <Input type="email" value={emailAlerta} onChange={(e) => setEmailAlerta(e.target.value)} placeholder="seu@email.com" className="mt-1" />
            </div>
            <div>
              <Label>Horário do envio (diário)</Label>
              <Input type="time" value={horarioAlerta} onChange={(e) => setHorarioAlerta(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoId(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={atualizar.isPending}>
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
