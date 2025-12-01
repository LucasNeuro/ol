import { Link } from 'wouter'

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-12">
      <div className="container mx-auto px-6 md:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Empresa</h3>
            <p className="text-gray-600 text-sm">
              Av. Faria Lima, 2000<br />
              São Paulo - SP, 01452-000
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Links Rápidos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-gray-600 hover:text-orange-500">
                  Início
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-600 hover:text-orange-500">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/filtro" className="text-gray-600 hover:text-orange-500">
                  Buscar Licitações
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-gray-600 hover:text-orange-500">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-600 hover:text-orange-500">
                  Política de Privacidade
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} Sistema Licitação. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}


