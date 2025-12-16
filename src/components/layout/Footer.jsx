import { Link } from 'wouter'

export function Footer() {
  return (
    <footer className="bg-gray-1000 border-t border-gray-200 py-12">
      <div className="container mx-auto px-6 md:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-orange-600 mb-4">Empresa</h3>
            <p className="text-orange-600 text-sm">
              Av. Faria Lima, 2000<br />
              São Paulo - SP, 01452-000
            </p>
          </div>


        </div>

        <div className=" mt-8 pt-8 border-t border-gray-200 text-center text-sm text-orange-600">
          <p>&copy; {new Date().getFullYear()} Sistema Licitação. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}


