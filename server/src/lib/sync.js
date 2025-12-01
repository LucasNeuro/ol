// Funções de sincronização reutilizadas do frontend
import { createClient } from '@supabase/supabase-js'
import { buscarDetalhesContratacao } from './pncp.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Carregar variáveis de ambiente do arquivo .env na pasta server
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas!')
  console.error('   Verifique se o arquivo server/.env existe e contém:')
  console.error('   - VITE_SUPABASE_URL')
  console.error('   - VITE_SUPABASE_ANON_KEY')
  throw new Error('Variáveis de ambiente do Supabase não configuradas!')
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Salva licitação completa no banco (com itens e documentos)
 */
export async function salvarLicitacaoCompleta(licitacaoBasica, userId = null) {
  if (!licitacaoBasica?.numeroControlePNCP) {
    return null
  }

  try {
    // Buscar detalhes da API
    const detalhes = await buscarDetalhesContratacao(licitacaoBasica.numeroControlePNCP)
    const licitacao = { ...licitacaoBasica }
    const itens = detalhes.itens || []
    const documentos = detalhes.documentos || []

    // Salvar licitação principal
    const { data: existente } = await supabase
      .from('licitacoes')
      .select('id')
      .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
      .maybeSingle()

    const dadosLicitacao = {
      numero_controle_pncp: licitacao.numeroControlePNCP,
      numero_compra: licitacao.numeroCompra,
      ano_compra: licitacao.anoCompra,
      processo: licitacao.processo,
      objeto_compra: licitacao.objetoCompra,
      informacao_complementar: licitacao.informacaoComplementar,
      modalidade_id: licitacao.codigoModalidadeContratacao,
      modalidade_nome: licitacao.modalidadeNome,
      valor_total_estimado: licitacao.valorTotalEstimado,
      data_abertura_proposta: licitacao.dataAberturaProposta || licitacao.dataAberturaPropostaData,
      data_encerramento_proposta: licitacao.dataEncerramentoProposta || licitacao.dataEncerramentoPropostaData,
      data_publicacao_pncp: licitacao.dataPublicacaoPNCP || licitacao.dataPublicacao,
      orgao_cnpj: licitacao.orgaoEntidade?.cnpj,
      orgao_razao_social: licitacao.orgaoEntidade?.razaosocial,
      municipio_codigo_ibge: licitacao.municipio?.codigoIBGE || licitacao.unidadeOrgao?.codigoIbge,
      municipio_nome: licitacao.municipio?.nomeIBGE || licitacao.unidadeOrgao?.municipioNome,
      uf_sigla: licitacao.municipio?.uf || licitacao.unidadeOrgao?.ufSigla,
      sincronizado_em: new Date().toISOString(),
    }

    let licitacaoId
    if (existente) {
      const { data: atualizada } = await supabase
        .from('licitacoes')
        .update(dadosLicitacao)
        .eq('id', existente.id)
        .select()
        .single()
      licitacaoId = atualizada?.id || existente.id
    } else {
      const { data: nova } = await supabase
        .from('licitacoes')
        .insert(dadosLicitacao)
        .select()
        .single()
      licitacaoId = nova?.id
    }

    if (!licitacaoId) return null

    // Salvar itens
    if (itens.length > 0) {
      await supabase
        .from('licitacao_itens')
        .delete()
        .eq('licitacao_id', licitacaoId)

      const itensParaSalvar = itens.map(item => ({
        licitacao_id: licitacaoId,
        numero_item: item.numeroItem || item.numero,
        descricao_item: item.descricaoItem || item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario || item.valorUnitarioEstimado,
        valor_total: item.valorTotal || item.valorTotalEstimado,
        unidade_fornecimento: item.unidadeFornecimento,
        classificacao_codigo: item.codigoClassificacao,
        classificacao_nome: item.nomeClassificacao,
      }))

      await supabase
        .from('licitacao_itens')
        .insert(itensParaSalvar)
    }

    // Salvar documentos (COM LINKS)
    if (documentos.length > 0) {
      await supabase
        .from('licitacao_documentos')
        .delete()
        .eq('licitacao_id', licitacaoId)

      const documentosParaSalvar = documentos.map(doc => ({
        licitacao_id: licitacaoId,
        tipo_documento_id: doc.codigoTipoDocumento || doc.tipoDocumentoId,
        tipo_documento_nome: doc.nomeTipoDocumento || doc.tipoDocumentoNome,
        nome_arquivo: doc.nomeArquivo || doc.nomeDocumento || 'Documento',
        url_documento: doc.urlDocumento || doc.url || doc.linkDocumento || doc.link,
        tamanho_bytes: doc.tamanhoArquivo || doc.tamanhoBytes,
        data_publicacao: doc.dataPublicacao || doc.dataPublicacaoDocumento,
      }))

      await supabase
        .from('licitacao_documentos')
        .insert(documentosParaSalvar)
    }

    return licitacaoId
  } catch (error) {
    console.error('❌ Erro ao salvar licitação completa:', error)
    return null
  }
}

