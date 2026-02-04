import { useState, useEffect } from 'react'
import { useLocation, Link } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { PublicRoute } from '@/components/PublicRoute'
import { supabase } from '@/lib/supabase'
import { hasRecoverySession, redefinirSenhaViaSupabase } from '@/lib/auth'
import { Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'

const redefinirSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

export function RedefinirSenhaPage() {
  const [, setLocation] = useLocation()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [temSessaoRecuperacao, setTemSessaoRecuperacao] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(redefinirSchema),
  })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const ok = await hasRecoverySession()
        if (!cancelled) setTemSessaoRecuperacao(ok)
      } catch (_) {
        if (!cancelled) setTemSessaoRecuperacao(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    const { data: sub } = supabase?.auth?.onAuthStateChange?.((event, session) => {
      if (cancelled) return
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session?.user) {
        setTemSessaoRecuperacao(true)
        setChecking(false)
      }
    }) || {}

    check()
    return () => {
      cancelled = true
      sub?.unsubscribe?.()
    }
  }, [])

  const onSubmit = async (data) => {
    setError('')
    setSuccess(false)
    setLoading(true)
    try {
      await redefinirSenhaViaSupabase(data.password)
      setSuccess(true)
      setTimeout(() => setLocation('/login'), 3000)
    } catch (err) {
      setError(err.message || 'Erro ao redefinir senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <PublicRoute>
        <AuthLayout title="Validando..." subtitle="Verificando link de recuperação">
          <div className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 max-w-md mx-auto text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
            <p className="mt-4 text-gray-600">Validando...</p>
          </div>
        </AuthLayout>
      </PublicRoute>
    )
  }

  if (!temSessaoRecuperacao) {
    return (
      <PublicRoute>
        <AuthLayout title="Link inválido" subtitle="Acesse pelo link enviado no e-mail">
          <div className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 max-w-md mx-auto">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="w-16 h-16 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Acesse pelo link do e-mail</h3>
              <p className="text-gray-600">
                Use o link que enviamos para o seu e-mail para redefinir a senha.
                Se não recebeu, solicite novamente.
              </p>
              <div className="pt-4 space-y-2">
                <Link href="/recuperar-senha">
                  <Button className="w-full">Solicitar novo link</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para o login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </AuthLayout>
      </PublicRoute>
    )
  }

  return (
    <PublicRoute>
      <AuthLayout title="Redefinir Senha" subtitle="Digite sua nova senha">
        <div className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 max-w-md mx-auto">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Senha redefinida!</h3>
              <p className="text-gray-600">
                Sua senha foi redefinida com sucesso. Você será redirecionado para o login.
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label htmlFor="password">Nova Senha</Label>
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
                <div>
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="••••••••"
                    {...register('confirmPassword')}
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Redefinindo...' : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Redefinir senha
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
