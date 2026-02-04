import { Link } from 'wouter'
import { ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AuthLayout({ children, title, subtitle, contentClassName }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <div className="absolute top-6 left-6 z-10">
        <Link href="/">
          <a>
            <Button variant="ghost" className="text-muted-foreground hover:text-primary">
              <Home className="w-5 h-5 mr-2" />
              Voltar à home
            </Button>
          </a>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center py-12 px-6">
        <div className={contentClassName ?? 'w-full max-w-md'}>
          {(title || subtitle) && (
            <div className="text-center mb-8">
              <div className={`inline-flex items-center justify-center rounded-xl mb-4 overflow-hidden ${title ? 'w-16 h-16' : 'w-28 h-28 sm:w-32 sm:h-32'}`}>
                <img src="/logo/logo_licita.png" alt="" className="w-full h-full object-contain" aria-hidden />
              </div>
              {title && <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">{title}</h1>}
              {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

