import { useState } from 'react'
import { useLocation } from 'wouter'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUserStore } from '@/store/userStore'
import { 
  FileText, 
  Star, 
  Bell, 
  BarChart3, 
  User, 
  Target,
  Users,
  MessageSquare,
  Loader2
} from 'lucide-react'

function ModulosContent() {
  const { user } = useUserStore()
  const [, setLocation] = useLocation()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)

  const modulos = [
    {
      id: 'licitacoes',
      titulo: 'Licitações',
      descricao: 'Explore e filtre licitações públicas',
      icone: FileText,
      rota: '/licitacoes',
      disponivel: true
    },
    {
      id: 'favoritos',
      titulo: 'Favoritos',
      descricao: 'Suas licitações favoritadas',
      icone: Star,
      rota: '/favoritos',
      disponivel: true
    },
    {
      id: 'alertas',
      titulo: 'Alertas',
      descricao: 'Configure alertas personalizados',
      icone: Bell,
      rota: '/alertas',
      disponivel: true
    },
    {
      id: 'dashboard',
      titulo: 'Dashboard',
      descricao: 'Estatísticas e análises',
      icone: BarChart3,
      rota: '/dashboard',
      disponivel: user?.is_adm || false
    },
    {
      id: 'perfil',
      titulo: 'Perfil',
      descricao: 'Configure seu perfil e preferências',
      icone: User,
      rota: '/perfil',
      disponivel: true
    },
    {
      id: 'admin-usuarios',
      titulo: 'Controle de Usuários',
      descricao: 'Gerenciar usuários da plataforma',
      icone: Users,
      rota: '/admin/usuarios',
      disponivel: user?.is_adm || false
    }
  ]

  const modulosDisponiveis = modulos.filter(m => m.disponivel)

  const handleCardClick = (rota) => {
    setLocation(rota)
  }

  const handleEnviarFeedback = async () => {
    if (!email.trim() || !mensagem.trim()) {
      alert('Por favor, preencha o email e a mensagem.')
      return
    }

    setEnviando(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL não configurado')
      }

      // Obter token de autenticação
      const { supabase } = await import('@/lib/supabase')
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

      // Chamar Edge Function para contornar CORS
      const response = await fetch(
        `${supabaseUrl}/functions/v1/enviar-feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            email,
            mensagem,
            usuario: user?.email || user?.razao_social || 'Usuário não identificado',
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Erro ao enviar feedback')
      }

      alert('Obrigado pelo seu feedback! Sua opinião é muito importante para nós.')
      setEmail('')
      setMensagem('')
      setFeedbackOpen(false)
    } catch (error) {
      console.error('Erro ao enviar feedback:', error)
      alert(`Erro ao enviar feedback: ${error.message}. Por favor, tente novamente.`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Target className="w-10 h-10 text-orange-500" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              <strong>Sistema Licitação</strong>
            </h1>
          </div>
          <p className="text-xl text-gray-600 mt-2">
            Selecione o módulo que deseja acessar
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Escolha uma das opções abaixo para começar
          </p>
        </div>

        {/* Grid de Cards - 3 por coluna */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {modulosDisponiveis.map((modulo) => {
            const Icone = modulo.icone

            return (
              <Card
                key={modulo.id}
                className="
                  bg-white border border-gray-200
                  cursor-pointer transition-all duration-300
                  hover:border-orange-500 hover:shadow-md
                  h-full
                "
                onClick={() => handleCardClick(modulo.rota)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center h-full">
                  <div className="
                    w-16 h-16 rounded-lg 
                    flex items-center justify-center 
                    mb-4
                    bg-orange-50
                  ">
                    <Icone className="w-8 h-8 text-orange-500" />
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {modulo.titulo}
                  </h3>
                  
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {modulo.descricao}
                  </p>

                  <div className="mt-auto pt-4 border-t border-gray-200 w-full">
                    <span className="text-xs font-medium text-orange-500 uppercase tracking-wide">
                      Acessar →
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Bem-vindo, <strong>{user?.razao_social || user?.email || 'Usuário'}</strong>
          </p>
        </div>
      </div>

      {/* Badge Flutuante - Nos ajude a melhorar */}
      <button
        onClick={() => {
          setEmail(user?.email || '')
          setFeedbackOpen(true)
        }}
        className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 z-50"
        title="Nos ajude a melhorar"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-medium">Nos ajude a melhorar</span>
      </button>

      {/* Dialog de Feedback */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nos ajude a melhorar</DialogTitle>
            <DialogDescription>
              Sua opinião é muito importante para nós. Compartilhe suas sugestões, críticas ou elogios.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea
                id="mensagem"
                placeholder="Digite sua mensagem aqui..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={enviando}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeedbackOpen(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarFeedback}
              disabled={enviando || !email.trim() || !mensagem.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ModulosPage() {
  return (
    <ProtectedRoute>
      <ModulosContent />
    </ProtectedRoute>
  )
}

