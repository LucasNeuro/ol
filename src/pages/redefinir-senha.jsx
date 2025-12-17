import { useState, useEffect } from 'react'
import { useLocation, Link, useRoute } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { PublicRoute } from '@/components/PublicRoute'
import { validarTokenRecuperacao, redefinirSenha } from '@/lib/auth'
import { Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'

const redefinirSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

export function RedefinirSenhaPage() {
  const [, params] = useRoute('/redefinir-senha/:token')
  const [, setLocation] = useLocation()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validatingToken, setValidatingToken] = useState(true)
  const [tokenValido, setTokenValido] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(redefinirSchema),
  })

  // Obter email da query string
  const [email, setEmail] = useState('')

  // Validar token ao carregar a página
  useEffect(() => {
    const validarToken = async () => {
      if (!params?.token) {
        setError('Link inválido ou não fornecido.')
        setValidatingToken(false)
        return
      }

      // Obter email da query string
      const urlParams = new URLSearchParams(window.location.search)
      const emailParam = urlParams.get('email')
      
      if (!emailParam) {
        setError('Email não fornecido no link.')
        setValidatingToken(false)
        return
      }

      setEmail(emailParam)

      try {
        const valido = await validarTokenRecuperacao(params.token, emailParam)
        setTokenValido(valido)
        if (!valido) {
          setError('Link inválido ou expirado. Solicite um novo link de recuperação.')
        }
      } catch (err) {
        setError(err.message || 'Erro ao validar link.')
        setTokenValido(false)
      } finally {
        setValidatingToken(false)
      }
    }

    validarToken()
  }, [params?.token])

  const onSubmit = async (data) => {
    if (!params?.token || !email) {
      setError('Link inválido.')
      return
    }

    setError('')
    setSuccess(false)
    setLoading(true)
    try {
      await redefinirSenha(params.token, email, data.password)
      setSuccess(true)
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        setLocation('/login')
      }, 3000)
    } catch (err) {
      setError(err.message || 'Erro ao redefinir senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (validatingToken) {
    return (
      <PublicRoute>
        <AuthLayout title="Validando..." subtitle="Verificando token de recuperação">
          <div className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 max-w-md mx-auto text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Validando token...</p>
          </div>
        </AuthLayout>
      </PublicRoute>
    )
  }

  if (!tokenValido) {
    return (
      <PublicRoute>
        <AuthLayout title="Token Inválido" subtitle="O link de recuperação não é válido">
          <div className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 max-w-md mx-auto">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="w-16 h-16 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Token inválido ou expirado</h3>
              <p className="text-gray-600">
                O link de recuperação não é válido ou já expirou. 
                Solicite um novo link de recuperação.
              </p>
              <div className="pt-4 space-y-2">
                <Link href="/recuperar-senha">
                  <Button className="w-full">
                    Solicitar novo link
                  </Button>
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

