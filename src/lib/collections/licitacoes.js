import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { supabase } from '../supabase'

/**
 * Schema Zod para validação de licitações
 */
export const licitacaoSchema = z.object({
  id: z.string(),
  numero_controle_pncp: z.string(),
  objeto_compra: z.string().nullable().optional(),
  data_publicacao_pncp: z.string().nullable().optional(),
  data_atualizacao: z.string().nullable().optional(),
  uf_sigla: z.string().nullable().optional(),
  modalidade_nome: z.string().nullable().optional(),
  orgao_razao_social: z.string().nullable().optional(),
  valor_total_estimado: z.number().nullable().optional(),
  dados_completos: z.any().nullable().optional(), // JSONB field
  anexos: z.array(z.any()).nullable().optional(),
  itens: z.array(z.any()).nullable().optional(),
  // Campos adicionais que podem existir
  numero_compra: z.string().nullable().optional(),
  ano_compra: z.number().nullable().optional(),
  processo: z.string().nullable().optional(),
  informacao_complementar: z.string().nullable().optional(),
  modalidade_id: z.number().nullable().optional(),
  modo_disputa_id: z.number().nullable().optional(),
  modo_disputa_nome: z.string().nullable().optional(),
  situacao_id: z.number().nullable().optional(),
  situacao_nome: z.string().nullable().optional(),
  valor_total_homologado: z.number().nullable().optional(),
  data_abertura_proposta: z.string().nullable().optional(),
  data_encerramento_proposta: z.string().nullable().optional(),
  link_sistema_origem: z.string().nullable().optional(),
  orgao_cnpj: z.string().nullable().optional(),
  orgao_poder_id: z.number().nullable().optional(),
  orgao_esfera_id: z.number().nullable().optional(),
  unidade_codigo: z.string().nullable().optional(),
  unidade_nome: z.string().nullable().optional(),
  municipio_codigo_ibge: z.string().nullable().optional(),
  municipio_nome: z.string().nullable().optional(),
  uf_nome: z.string().nullable().optional(),
  sincronizado_em: z.string().nullable().optional(),
})

/**
 * Função para buscar licitações do banco
 * Esta função será chamada apenas UMA VEZ no início da sessão
 */
async function buscarLicitacoesDoBanco() {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado')
    return []
  }

  try {
    console.log('📡 [Collection] Buscando licitações do banco...')
    
    const { data, error } = await supabase
      .from('licitacoes')
      .select(`
        id,
        numero_controle_pncp,
        objeto_compra,
        data_publicacao_pncp,
        data_atualizacao,
        uf_sigla,
        modalidade_nome,
        orgao_razao_social,
        valor_total_estimado,
        dados_completos,
        anexos,
        itens
      `)
      .order('data_publicacao_pncp', { ascending: false })
      .limit(50000) // Limite máximo para carregar tudo de uma vez

    if (error) {
      console.error('❌ [Collection] Erro ao buscar licitações:', error)
      throw error
    }

    console.log(`✅ [Collection] ${data?.length || 0} licitações carregadas do banco`)

    // Processar dados: garantir que anexos/itens sejam arrays
    const dadosProcessados = (data || []).map(licitacao => {
      // Parsear dados_completos se for string
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try {
          dadosCompletos = JSON.parse(dadosCompletos)
        } catch (e) {
          dadosCompletos = {}
        }
      }
      
      // Garantir que anexos e itens sejam arrays válidos
      let anexos = licitacao.anexos
      if (typeof anexos === 'string') {
        try {
          anexos = JSON.parse(anexos)
        } catch (e) {
          anexos = []
        }
      }
      if (!Array.isArray(anexos)) {
        if (dadosCompletos?.anexos && Array.isArray(dadosCompletos.anexos)) {
          anexos = dadosCompletos.anexos
        } else {
          anexos = []
        }
      }
      
      let itens = licitacao.itens
      if (typeof itens === 'string') {
        try {
          itens = JSON.parse(itens)
        } catch (e) {
          itens = []
        }
      }
      if (!Array.isArray(itens)) {
        if (dadosCompletos?.itens && Array.isArray(dadosCompletos.itens)) {
          itens = dadosCompletos.itens
        } else {
          itens = []
        }
      }
      
      return {
        ...licitacao,
        dados_completos: dadosCompletos || {},
        anexos: anexos || [],
        itens: itens || []
      }
    })

    return dadosProcessados
  } catch (error) {
    console.error('❌ [Collection] Erro ao buscar licitações:', error)
    return []
  }
}

/**
 * Collection principal de licitações
 * Usa QueryCollection para buscar do banco
 * 
 * Estratégia:
 * 1. Primeira vez: Busca do banco usando QueryCollection
 * 2. TanStack Query faz cache automático (baseado no queryKey)
 * 3. Todos os filtros são aplicados via live queries (sem chamadas ao banco)
 */
export const licitacoesCollection = createCollection(
  queryCollectionOptions({
    id: 'licitacoes',
    queryKey: ['licitacoes-collection'],
    queryFn: buscarLicitacoesDoBanco,
    getKey: (item) => item.id,
    schema: licitacaoSchema,
    syncMode: 'eager', // Carrega tudo de uma vez (melhor para cache completo)
    // Query options serão passadas via queryClient padrão
  })
)

/**
 * Hook para obter a collection (para uso em componentes)
 */
export function useLicitacoesCollection() {
  return licitacoesCollection
}

