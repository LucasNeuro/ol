import { useState } from 'react'
import { useLocation, Link } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { PublicRoute } from '@/components/PublicRoute'
import { solicitarRecuperacaoSenha } from '@/lib/auth'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

const recuperarSchema = z.object({
  email: z.string().email('Email inválido'),
})

export function RecuperarSenhaPage() {
  const [, setLocation] = useLocation()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(recuperarSchema),
  })

  const onSubmit = async (data) => {
    setError('')
    setSuccess(false)
    setLoading(true)
    try {
      await solicitarRecuperacaoSenha(data.email)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Erro ao solicitar recuperação de senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicRoute>
      <AuthLayout title="Recuperar Senha" subtitle="Digite seu email para receber o link de recuperação">
        <div className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 max-w-md mx-auto">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Email enviado!</h3>
              <p className="text-gray-600">
                Enviamos um link de recuperação de senha para o seu email.
                Verifique sua caixa de entrada e siga as instruções.
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para o login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    {...register('email')}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando...' : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar link de recuperação
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <Link href="/login">
                  <a className="text-sm text-orange-600 hover:text-orange-700 font-medium hover:underline cursor-pointer flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para o login
                  </a>
                </Link>
              </div>
            </>
          )}
        </div>
      </AuthLayout>
    </PublicRoute>
  )
}

