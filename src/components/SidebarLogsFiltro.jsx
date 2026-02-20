import { useFiltroContext } from '@/contexts/FiltroContext'
import { CheckCircle2, Loader2, Database, Filter, Sparkles } from 'lucide-react'

const ETAPAS_COMPLETAS = [
  { label: 'Carregando dados', min: 0, max: 30, icon: Database },
  { label: 'Filtrando perfil', min: 30, max: 55, icon: Filter },
  { label: 'Processando filtros', min: 55, max: 90, icon: Sparkles },
  { label: 'Concluído', min: 90, max: 101, icon: CheckCircle2 },
]

// Quando o progresso fica em 0%, os dados vêm do banco (por setor) — não há "Filtrando perfil" nem "Processando filtros"
const ETAPAS_POR_SETOR = [
  { label: 'Carregando dados', min: 0, max: 50, icon: Database },
  { label: 'Concluído', min: 50, max: 101, icon: CheckCircle2 },
]

function stepAt(etapas, percent) {
  const i = etapas.findIndex((e) => percent >= e.min && percent < e.max)
  return i >= 0 ? i : (percent >= 100 ? etapas.length - 1 : 0)
}

export function SidebarLogsFiltro({ aberto, onFechar }) {
  const { processandoFiltro, progressoPercentual, mensagemProgresso } = useFiltroContext()
  // Dados por setor (banco): progresso fica em 0%, mostrar só "Carregando dados" e "Concluído"
  const modoPorSetor = progressoPercentual <= 30
  const etapas = modoPorSetor ? ETAPAS_POR_SETOR : ETAPAS_COMPLETAS
  const etapaAtual = modoPorSetor && !processandoFiltro ? etapas.length - 1 : stepAt(etapas, progressoPercentual)

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
        <div className="flex-1 overflow-y-auto p-6">
          <div>
            <span className="text-sm font-medium text-gray-600 mb-4 block">Etapas</span>
            <ul className="relative space-y-0">
              {etapas.map((etapa, i) => {
                const Icon = etapa.icon
                const concluido = i < etapaAtual || (i === etapaAtual && progressoPercentual >= 100)
                const atual = i === etapaAtual && processandoFiltro
                const pendente = i > etapaAtual
                const percentNaEtapa = atual && processandoFiltro ? Math.round(progressoPercentual) : null
                return (
                  <li key={etapa.label} className="relative flex gap-4 pb-8 last:pb-0">
                    {i < etapas.length - 1 && (
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
                    <div
                      className="flex-1 min-w-0 pt-0.5 flex items-baseline justify-between gap-2"
                      title={atual && mensagemProgresso ? mensagemProgresso : undefined}
                    >
                      <p
                        className={`text-sm font-medium ${
                          concluido ? 'text-green-700' : atual ? 'text-orange-700' : 'text-gray-500'
                        }`}
                      >
                        {etapa.label}
                      </p>
                      {percentNaEtapa != null && (
                        <span className="text-sm font-semibold tabular-nums shrink-0 text-orange-600">
                          {percentNaEtapa}%
                        </span>
                      )}
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
