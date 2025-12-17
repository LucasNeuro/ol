import { useState } from 'react'
import { useLocation, Link } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { PublicRoute } from '@/components/PublicRoute'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

export function LoginPage() {
  const [, setLocation] = useLocation()
  const { signIn, user } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  })

  // Redirecionar se já estiver logado
  if (user) {
    setLocation('/modulos')
    return null
  }

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)
    try {
      await signIn(data.email, data.password)
      setLocation('/modulos')
    } catch (err) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicRoute>
      <AuthLayout title="Entrar" subtitle="Acesse sua conta">
        <div className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 max-w-md mx-auto">
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

                <div>
                  <Label htmlFor="password">Senha</Label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    {...register('password')}
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  {errors.password && (
                    <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/recuperar-senha">
              <a className="text-sm text-orange-600 hover:text-orange-700 font-medium hover:underline cursor-pointer">
                Esqueci minha senha
              </a>
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link href="/cadastro">
                <a className="text-orange-600 hover:text-orange-700 font-semibold hover:underline cursor-pointer">
                  Cadastre-se aqui
                </a>
              </Link>
            </p>
          </div>
        </div>
      </AuthLayout>
    </PublicRoute>
  )
}

