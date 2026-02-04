import { useFiltroContext } from '@/contexts/FiltroContext'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Loader2, Database, Filter, Sparkles } from 'lucide-react'

const ETAPAS = [
  { label: 'Carregando dados', min: 0, max: 30, icon: Database },
  { label: 'Filtrando perfil', min: 30, max: 55, icon: Filter },
  { label: 'Processando filtros', min: 55, max: 90, icon: Sparkles },
  { label: 'Concluído', min: 90, max: 101, icon: CheckCircle2 },
]

function stepAt(percent) {
  const i = ETAPAS.findIndex((e) => percent >= e.min && percent < e.max)
  return i >= 0 ? i : (percent >= 100 ? 3 : 0)
}

export function SidebarLogsFiltro({ aberto, onFechar }) {
  const { processandoFiltro, progressoPercentual, mensagemProgresso } = useFiltroContext()
  const etapaAtual = stepAt(progressoPercentual)

  if (!aberto) return null

  return (
    <>
      {/* Backdrop full-page */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        aria-hidden
        onClick={onFechar}
      />
      {/* Painel abaixo do header (não cobre o header) */}
      <aside
        className="fixed top-14 right-0 z-50 w-full max-w-[420px] h-[calc(100vh-3.5rem)] bg-white shadow-2xl flex flex-col overflow-hidden border-l border-gray-100"
        role="dialog"
        aria-label="Andamento do filtro"
      >
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Barra de progresso */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-medium text-gray-600">Progresso</span>
              <span className="text-2xl font-bold text-orange-600 tabular-nums">
                {Math.round(progressoPercentual)}%
              </span>
            </div>
            <Progress value={progressoPercentual} className="h-3 bg-gray-100 rounded-full" />
          </div>

          {/* Mensagem atual */}
          {mensagemProgresso && (
            <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed" title={mensagemProgresso}>
                {mensagemProgresso}
              </p>
            </div>
          )}

          {/* Steps melhorados */}
          <div>
            <span className="text-sm font-medium text-gray-600 mb-4 block">Etapas</span>
            <ul className="relative space-y-0">
              {ETAPAS.map((etapa, i) => {
                const Icon = etapa.icon
                const concluido = i < etapaAtual || (i === etapaAtual && progressoPercentual >= 100)
                const atual = i === etapaAtual && processandoFiltro
                const pendente = i > etapaAtual
                return (
                  <li key={etapa.label} className="relative flex gap-4 pb-8 last:pb-0">
                    {/* Linha conectora (exceto no último) */}
                    {i < ETAPAS.length - 1 && (
                      <div
                        className={`absolute left-[11px] top-8 bottom-0 w-0.5 rounded-full transition-colors ${
                          concluido ? 'bg-green-300' : 'bg-gray-200'
                        }`}
                        aria-hidden
                      />
                    )}
                    <div
                      className={`
                        relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all
                        ${concluido ? 'border-green-500 bg-green-500 text-white' : ''}
                        ${atual ? 'border-orange-500 bg-orange-50 text-orange-600' : ''}
                        ${pendente ? 'border-gray-200 bg-white text-gray-400' : ''}
                      `}
                    >
                      {concluido ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : atual && processandoFiltro ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p
                        className={`text-sm font-medium ${
                          concluido ? 'text-green-700' : atual ? 'text-orange-700' : 'text-gray-500'
                        }`}
                      >
                        {etapa.label}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </aside>
    </>
  )
}
