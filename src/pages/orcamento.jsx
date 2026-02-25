import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PublicRoute } from '@/components/PublicRoute'
import { Building2, Mail, Phone, MapPin, FileText } from 'lucide-react'

const DADOS_EMPRESA = {
  cnpj: '62.449.971/0001-70',
  tipo: 'MATRIZ',
  dataAbertura: '28/08/2025',
  razaoSocial: 'ONNZE TECNOLOGIA LTDA',
  nomeFantasia: 'ONNZE TECNOLOGIA E INTELIGENCIA',
  porte: 'ME',
  cnae: '62.01-5-02 - Web design (Dispensada)',
  endereco: 'São Paulo, SP',
  telefone: '(11) 97036-4501',
  email: 'marcondeslucas979@gmail.com',
}

const ITENS_ORCAMENTO = [
  { descricao: 'Desenvolvimento (Mão de Obra)', valor: 9000 },
  { descricao: 'Suporte', valor: 3500 },
]

const total = ITENS_ORCAMENTO.reduce((s, i) => s + i.valor, 0)

function formatarMoeda(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function OrcamentoPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Cabeçalho: dados da empresa em card */}
          <Card className="shadow-lg border-gray-200 overflow-hidden">
            <CardHeader className="bg-white border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{DADOS_EMPRESA.nomeFantasia}</h1>
                  <p className="text-sm text-gray-500">{DADOS_EMPRESA.razaoSocial}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">CNPJ</span>
                  <p className="font-medium text-gray-900">{DADOS_EMPRESA.cnpj}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tipo / Porte</span>
                  <p className="font-medium text-gray-900">{DADOS_EMPRESA.tipo} • {DADOS_EMPRESA.porte}</p>
                </div>
                <div>
                  <span className="text-gray-500">Data de abertura</span>
                  <p className="font-medium text-gray-900">{DADOS_EMPRESA.dataAbertura}</p>
                </div>
                <div>
                  <span className="text-gray-500">Atividade principal</span>
                  <p className="font-medium text-gray-900">{DADOS_EMPRESA.cnae}</p>
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-4 mt-2 pt-4 border-t border-gray-100">
                  <span className="inline-flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    {DADOS_EMPRESA.endereco}
                  </span>
                  <a href={`tel:${DADOS_EMPRESA.telefone.replace(/\D/g, '')}`} className="inline-flex items-center gap-2 text-gray-700 hover:text-orange-600">
                    <Phone className="w-4 h-4 text-orange-500" />
                    {DADOS_EMPRESA.telefone}
                  </a>
                  <a href={`mailto:${DADOS_EMPRESA.email}`} className="inline-flex items-center gap-2 text-gray-700 hover:text-orange-600">
                    <Mail className="w-4 h-4 text-orange-500" />
                    {DADOS_EMPRESA.email}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orçamento: itens em card */}
          <Card className="shadow-lg border-gray-200 overflow-hidden">
            <CardHeader className="bg-orange-50 border-b">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-900">Orçamento</h2>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {ITENS_ORCAMENTO.map((item, i) => (
                  <div key={i} className="flex justify-between items-center px-6 py-4 hover:bg-gray-50/50">
                    <span className="text-gray-800">{item.descricao}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{formatarMoeda(item.valor)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t-2 border-gray-200">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-orange-600 tabular-nums">{formatarMoeda(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicRoute>
  )
}
