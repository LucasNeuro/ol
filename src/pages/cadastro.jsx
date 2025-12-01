import { useState } from 'react'
import { useLocation, Link } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@/hooks/useAuth'
import { validarCNPJ, formatarCNPJ } from '@/lib/utils'

const cadastroSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
  cnpj: z.string().refine((val) => validarCNPJ(val), {
    message: 'CNPJ inválido',
  }),
  razaoSocial: z.string().min(3, 'Razão social deve ter no mínimo 3 caracteres'),
  cargo: z.enum(['Gerente', 'Dono', 'Independente'], {
    required_error: 'Selecione um cargo',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

export function CadastroPage() {
  const [, setLocation] = useLocation()
  const { signUp, user } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cnpjValue, setCnpjValue] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(cadastroSchema),
  })

  const cargo = watch('cargo')

  // Redirecionar se já estiver logado
  if (user) {
    setLocation('/dashboard')
    return null
  }

  const handleCnpjChange = (e) => {
    const value = e.target.value.replace(/\D/g, '')
    setCnpjValue(value)
    setValue('cnpj', value, { shouldValidate: true })
  }

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)
    try {
      const { confirmPassword, ...profileData } = data
      await signUp(data.email, data.password, {
        cnpj: data.cnpj,
        razao_social: data.razaoSocial,
        cargo: data.cargo,
      })
      setLocation('/dashboard')
    } catch (err) {
      setError(err.message || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-md">
          <div className="bg-white shadow-xl rounded-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Criar Conta
              </h1>
              <p className="text-gray-600">Cadastre-se para começar</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpjValue ? formatarCNPJ(cnpjValue) : ''}
                  onChange={handleCnpjChange}
                  maxLength={18}
                  className={errors.cnpj ? 'border-red-500' : ''}
                />
                {errors.cnpj && (
                  <p className="text-red-600 text-sm mt-1">{errors.cnpj.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="razaoSocial">Razão Social</Label>
                <Input
                  id="razaoSocial"
                  type="text"
                  placeholder="Nome da empresa"
                  {...register('razaoSocial')}
                  className={errors.razaoSocial ? 'border-red-500' : ''}
                />
                {errors.razaoSocial && (
                  <p className="text-red-600 text-sm mt-1">{errors.razaoSocial.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="cargo">Cargo</Label>
                <Select
                  value={cargo}
                  onValueChange={(value) => setValue('cargo', value, { shouldValidate: true })}
                >
                  <SelectTrigger className={errors.cargo ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione seu cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gerente">Gerente</SelectItem>
                    <SelectItem value="Dono">Dono</SelectItem>
                    <SelectItem value="Independente">Independente</SelectItem>
                  </SelectContent>
                </Select>
                {errors.cargo && (
                  <p className="text-red-600 text-sm mt-1">{errors.cargo.message}</p>
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

              <div>
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
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
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Já tem uma conta?{' '}
                <Link href="/login">
                  <span className="text-orange-600 hover:text-orange-700 underline decoration-2 cursor-pointer">
                    Faça login
                  </span>
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link href="/">
                <span className="text-sm text-gray-500 hover:text-orange-500 cursor-pointer">
                  ← Voltar para o início
                </span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

