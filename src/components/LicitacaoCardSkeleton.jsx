import { Card, CardContent } from '@/components/ui/card'

/**
 * Skeleton do card de licitação (loader) – usado durante carregamento ou filtro.
 * Layout alinhado ao card real, com animação de brilho (shimmer).
 */
export function LicitacaoCardSkeleton() {
  return (
    <Card className="relative overflow-hidden rounded-xl border border-gray-100 border-l-4 border-l-orange-400 bg-white shadow-sm">
      {/* Shimmer */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-orange-50/60 to-transparent animate-shimmer pointer-events-none" />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200/80 shrink-0 animate-pulse" />
            <div className="h-5 w-5 rounded bg-gray-200/80 animate-pulse" />
            <div className="h-5 w-5 rounded bg-gray-200/80 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-gray-200/80 animate-pulse" />
            <div className="h-6 w-20 rounded-full bg-gray-200/80 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 mb-3">
          <div className="h-4 w-full rounded bg-gray-200/80 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-gray-200/80 animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="h-6 w-24 rounded-md bg-gray-200/80 animate-pulse" />
          <div className="h-6 w-28 rounded-md bg-gray-200/80 animate-pulse" />
          <div className="h-6 w-20 rounded-md bg-gray-200/80 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
          <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
          <div className="h-3 w-28 rounded bg-gray-100 animate-pulse" />
          <div className="h-3 w-36 rounded bg-gray-100 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}

/** Lista de N skeletons para preencher a tela durante loading */
export function LicitacaoCardSkeletonList({ count = 8 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <LicitacaoCardSkeleton key={i} />
      ))}
    </div>
  )
}
