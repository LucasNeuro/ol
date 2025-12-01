import { useState } from 'react'
import { useLocation } from 'wouter'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatarDataParaPNCP } from '@/lib/pncp'

function BoletimContent() {
  const [, setLocation] = useLocation()
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  // Calcular dias da semana corretamente (domingo = 0, segunda = 1, etc.)
  // Pegar o primeiro dia do mês e calcular quantos dias vazios precisamos antes
  const firstDayOfWeek = getDay(monthStart) // 0 = domingo, 1 = segunda, etc.
  const emptyDays = Array(firstDayOfWeek).fill(null)

  const previousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1))
  }

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1))
  }

  const handleDayClick = (day) => {
    const dateStr = formatarDataParaPNCP(day)
    setLocation(`/boletim/${dateStr}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-12 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
              Boletim Diário
            </h1>
            <p className="text-gray-600">
              Selecione uma data para visualizar as licitações publicadas
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border-2 border-orange-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <Button variant="outline" onClick={previousMonth}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Mês Anterior
              </Button>
              
              <h2 className="text-2xl font-semibold text-gray-900 capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              
              <Button variant="outline" onClick={nextMonth}>
                Próximo Mês
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {/* Cabeçalho dos dias da semana */}
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <div key={day} className="text-center font-semibold text-gray-700 py-2">
                  {day}
                </div>
              ))}

              {/* Dias vazios antes do primeiro dia do mês para alinhar corretamente */}
              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="p-4"></div>
              ))}

              {/* Dias do mês */}
              {days.map((day) => {
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isToday = isSameDay(day, new Date())
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200 text-center
                      ${isCurrentMonth ? 'border-gray-200 hover:border-orange-500 hover:bg-orange-50' : 'border-transparent text-gray-400'}
                      ${isToday ? 'bg-orange-100 border-orange-500 font-semibold' : ''}
                      hover:scale-105
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export function BoletimPage() {
  return (
    <ProtectedRoute>
      <BoletimContent />
    </ProtectedRoute>
  )
}

