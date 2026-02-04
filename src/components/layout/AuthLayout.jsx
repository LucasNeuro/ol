import { Link } from 'wouter'
import { ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AuthLayout({ children, title, subtitle }) {
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
        <div className="w-full max-w-md">
          {title && (
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-xl mb-4">
                <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">{title}</h1>
              {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

