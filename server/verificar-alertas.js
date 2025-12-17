/**
 * Servidor Node.js para verificar alertas 24/7
 * Roda independente da aplicação web
 * 
 * Para rodar:
 * 1. npm install (instalar dependências)
 * 2. node server/verificar-alertas.js
 * 
 * Ou usar PM2 para rodar em background:
 * pm2 start server/verificar-alertas.js --name "verificar-alertas"
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Configurar dotenv para ler do .env da raiz do projeto
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
dotenv.config({ path: resolve(rootDir, '.env') })

// Aceitar tanto SUPABASE_URL quanto VITE_SUPABASE_URL
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Configuração do Resend para envio de emails
const resendApiKey = process.env.RESEND_API_KEY || 're_J8E9U3ja_FtygDuLctpub3nQiBYTxMPK6'
const resend = new Resend(resendApiKey)
// Garantir que sempre use o domínio de teste do Resend (onboarding@resend.dev)
// Para produção, verificar o domínio em https://resend.com/domains
let emailFrom = process.env.EMAIL_FROM || 'Sistema Licitação <onboarding@resend.dev>'
// Se o emailFrom contém um domínio não verificado, forçar uso do domínio de teste
if (emailFrom.includes('@') && !emailFrom.includes('onboarding@resend.dev')) {
  console.warn(`⚠️ Domínio customizado detectado em EMAIL_FROM. Usando domínio de teste do Resend.`)
  emailFrom = 'Sistema Licitação <onboarding@resend.dev>'
}

// Intervalo em minutos (padrão: 5 minutos)
const INTERVALO_MINUTOS = parseInt(process.env.INTERVALO_VERIFICACAO || '5', 10)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas!')
  console.error('Configure SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no arquivo .env')
  console.error('')
  console.error('O arquivo .env deve estar na raiz do projeto e conter:')
  console.error('SUPABASE_URL=https://seu-projeto.supabase.co')
  console.error('OU')
  console.error('VITE_SUPABASE_URL=https://seu-projeto.supabase.co')
  console.error('SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key')
  console.error('')
  console.error(`📁 Procurando .env em: ${resolve(rootDir, '.env')}`)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Formata data para query SQL (YYYY-MM-DD)
 */
function formatarDataParaQuery(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Extrai CNAEs da licitação
 */
function extrairCnaesLicitacao(licitacao) {
  const cnaes = []

  // Tentar extrair de dados_complementares
  if (licitacao.dados_complementares) {
    try {
      const dados = typeof licitacao.dados_complementares === 'string' 
        ? JSON.parse(licitacao.dados_complementares)
        : licitacao.dados_complementares

      if (dados.cnaes) {
        cnaes.push(...(Array.isArray(dados.cnaes) ? dados.cnaes : [dados.cnaes]))
      }
      
      // Também tentar extrair de itens se houver
      if (dados.itens && Array.isArray(dados.itens)) {
        dados.itens.forEach(item => {
          if (item.cnae) {
            cnaes.push(item.cnae)
          }
        })
      }
    } catch (e) {
      // Silencioso - não é crítico
    }
  }

  // Tentar extrair de dados_completos se houver
  if (licitacao.dados_completos) {
    try {
      const dados = typeof licitacao.dados_completos === 'string' 
        ? JSON.parse(licitacao.dados_completos)
        : licitacao.dados_completos

      if (dados.cnaes) {
        cnaes.push(...(Array.isArray(dados.cnaes) ? dados.cnaes : [dados.cnaes]))
      }
      
      if (dados.itens && Array.isArray(dados.itens)) {
        dados.itens.forEach(item => {
          if (item.cnae) {
            cnaes.push(item.cnae)
          }
        })
      }
    } catch (e) {
      // Silencioso - não é crítico
    }
  }

  // Normalizar CNAEs (remover hífens, barras, espaços)
  return cnaes
    .map(c => String(c).trim().replace(/[-\/]/g, ''))
    .filter(c => c && c.length > 0)
}

/**
 * Busca licitações filtradas baseadas no perfil do usuário
 */
async function buscarLicitacoesFiltradas(alerta, usuario, dataInicio, dataFim = null) {
  console.log(`🔍 Buscando licitações desde ${dataInicio}${dataFim ? ` até ${dataFim}` : ''}`)
  
  let query = supabase
    .from('licitacoes')
    .select('*')
    .gte('data_publicacao_pncp', dataInicio)
    .order('data_publicacao_pncp', { ascending: false })
    .limit(500)
  
  // Adicionar filtro de data fim se fornecido
  if (dataFim) {
    query = query.lte('data_publicacao_pncp', dataFim)
  }

  // Aplicar filtros de estados de interesse do perfil
  if (usuario.estados_interesse && Array.isArray(usuario.estados_interesse) && usuario.estados_interesse.length > 0) {
    console.log(`📍 Filtrando por estados: ${usuario.estados_interesse.join(', ')}`)
    if (usuario.estados_interesse.length === 1) {
      query = query.eq('uf_sigla', usuario.estados_interesse[0])
    } else {
      query = query.in('uf_sigla', usuario.estados_interesse)
    }
  } else {
    console.log(`📍 Sem filtro de estados - buscando todas as UFs`)
  }

  const { data, error } = await query

  if (error) {
    console.error('❌ Erro ao buscar licitações:', error.message)
    console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2))
    return []
  }

  let licitacoes = data || []
  console.log(`📊 Total de licitações encontradas (antes do filtro CNAE): ${licitacoes.length}`)
  
  // Log de debug: mostrar algumas datas encontradas
  if (licitacoes.length > 0) {
    console.log(`📅 Exemplo de datas encontradas: ${licitacoes.slice(0, 3).map(l => l.data_publicacao_pncp).join(', ')}`)
  } else {
    // Se não encontrou nada, fazer uma busca sem filtros para verificar se há licitações no banco
    console.log(`⚠️ Nenhuma licitação encontrada com os filtros aplicados. Verificando se há licitações no banco...`)
    const { data: todasLicitacoes, error: erroGeral } = await supabase
      .from('licitacoes')
      .select('data_publicacao_pncp, uf_sigla')
      .gte('data_publicacao_pncp', dataInicio)
      .order('data_publicacao_pncp', { ascending: false })
      .limit(10)
    
    if (!erroGeral && todasLicitacoes && todasLicitacoes.length > 0) {
      console.log(`ℹ️ Encontradas ${todasLicitacoes.length} licitações no período (sem filtros de estado)`)
      console.log(`📅 Exemplos: ${todasLicitacoes.slice(0, 3).map(l => `${l.data_publicacao_pncp} (${l.uf_sigla})`).join(', ')}`)
      console.log(`⚠️ Os filtros de estado podem estar muito restritivos!`)
    } else if (erroGeral) {
      console.error(`❌ Erro ao verificar licitações gerais:`, erroGeral.message)
    } else {
      console.log(`⚠️ Não há licitações no banco de dados no período de ${dataInicio} até ${dataFim || 'hoje'}`)
    }
  }
  
  // Log de debug: mostrar algumas datas encontradas
  if (licitacoes.length > 0) {
    console.log(`📅 Exemplo de datas encontradas: ${licitacoes.slice(0, 3).map(l => l.data_publicacao_pncp).join(', ')}`)
  } else {
    // Se não encontrou nada, fazer uma busca sem filtros para verificar se há licitações no banco
    console.log(`⚠️ Nenhuma licitação encontrada com os filtros aplicados. Verificando se há licitações no banco...`)
    const { data: todasLicitacoes, error: erroGeral } = await supabase
      .from('licitacoes')
      .select('data_publicacao_pncp, uf_sigla')
      .gte('data_publicacao_pncp', dataInicio)
      .order('data_publicacao_pncp', { ascending: false })
      .limit(10)
    
    if (!erroGeral && todasLicitacoes && todasLicitacoes.length > 0) {
      console.log(`ℹ️ Encontradas ${todasLicitacoes.length} licitações no período (sem filtros de estado)`)
      console.log(`📅 Exemplos: ${todasLicitacoes.slice(0, 3).map(l => `${l.data_publicacao_pncp} (${l.uf_sigla})`).join(', ')}`)
    } else if (erroGeral) {
      console.error(`❌ Erro ao verificar licitações gerais:`, erroGeral.message)
    } else {
      console.log(`⚠️ Não há licitações no banco de dados no período de ${dataInicio} até ${dataFim || 'hoje'}`)
    }
  }

  // Filtrar por CNAEs do perfil (normalizados - sem hífens/barras)
  const cnaesPerfil = []

  if (usuario.cnae_principal) {
    const cnaeNormalizado = String(usuario.cnae_principal).trim().replace(/[-\/]/g, '')
    if (cnaeNormalizado) cnaesPerfil.push(cnaeNormalizado)
  }

  if (usuario.cnaes_secundarios && Array.isArray(usuario.cnaes_secundarios)) {
    usuario.cnaes_secundarios.forEach((cnae) => {
      // Se for objeto, tentar extrair o código
      let cnaeStr = cnae
      if (typeof cnae === 'object' && cnae !== null) {
        cnaeStr = cnae.codigo || cnae.cnae || cnae.value || String(cnae)
      }
      const cnaeNormalizado = String(cnaeStr).trim().replace(/[-\/]/g, '').replace(/\[object Object\]/g, '')
      if (cnaeNormalizado && cnaeNormalizado !== 'object' && !cnaesPerfil.includes(cnaeNormalizado)) {
        cnaesPerfil.push(cnaeNormalizado)
      }
    })
  }

  if (usuario.setores_atividades && Array.isArray(usuario.setores_atividades)) {
    usuario.setores_atividades.forEach((cnae) => {
      // Se for objeto, tentar extrair o código
      let cnaeStr = cnae
      if (typeof cnae === 'object' && cnae !== null) {
        cnaeStr = cnae.codigo || cnae.cnae || cnae.value || String(cnae)
      }
      const cnaeNormalizado = String(cnaeStr).trim().replace(/[-\/]/g, '').replace(/\[object Object\]/g, '')
      if (cnaeNormalizado && cnaeNormalizado !== 'object' && !cnaesPerfil.includes(cnaeNormalizado)) {
        cnaesPerfil.push(cnaeNormalizado)
      }
    })
  }

  console.log(`🏢 CNAEs do perfil (normalizados): ${cnaesPerfil.length > 0 ? cnaesPerfil.join(', ') : 'Nenhum CNAE configurado'}`)

  // Filtrar licitações por CNAEs se houver
  // IMPORTANTE: Se não houver CNAEs no perfil OU se a licitação não tiver CNAE, incluir mesmo assim
  if (cnaesPerfil.length > 0) {
    const licitacoesAntesFiltro = licitacoes.length
    const licitacoesOriginais = [...licitacoes] // Guardar cópia
    let licitacoesComCnae = 0
    let licitacoesSemCnae = 0
    let licitacoesMatch = 0
    let licitacoesNoMatch = 0
    
    // Log de debug: ver alguns CNAEs extraídos
    if (licitacoes.length > 0) {
      const exemploCnaes = extrairCnaesLicitacao(licitacoes[0])
      console.log(`🔍 Exemplo de CNAEs extraídos da primeira licitação: ${exemploCnaes.length > 0 ? exemploCnaes.join(', ') : 'Nenhum CNAE encontrado'}`)
    }
    
    licitacoes = licitacoes.filter((lic) => {
      const cnaesLicitacao = extrairCnaesLicitacao(lic)
      
      // Se a licitação não tem CNAE, incluir mesmo assim (pode ser relevante)
      if (cnaesLicitacao.length === 0) {
        licitacoesSemCnae++
        return true
      }
      
      licitacoesComCnae++
      // Comparar CNAEs normalizados
      const match = cnaesPerfil.some((cnaePerfil) => 
        cnaesLicitacao.some((cnaeLic) => {
          // Normalizar CNAE da licitação também
          const cnaeLicNormalizado = String(cnaeLic).trim().replace(/[-\/]/g, '')
          return cnaeLicNormalizado === cnaePerfil
        })
      )
      
      if (match) {
        licitacoesMatch++
      } else {
        licitacoesNoMatch++
      }
      
      return match
    })
    console.log(`🔍 Após filtro de CNAE: ${licitacoes.length} de ${licitacoesAntesFiltro} licitações`)
    console.log(`📊 Detalhes: ${licitacoesComCnae} com CNAE (${licitacoesMatch} match, ${licitacoesNoMatch} no match), ${licitacoesSemCnae} sem CNAE (incluídas)`)
    
    // Se nenhuma licitação passou no filtro, retornar todas (filtro muito restritivo)
    if (licitacoes.length === 0 && licitacoesAntesFiltro > 0) {
      console.log(`⚠️ Filtro de CNAE muito restritivo! Retornando todas as ${licitacoesAntesFiltro} licitações encontradas.`)
      licitacoes = licitacoesOriginais.slice(0, 100)
    }
  } else {
    console.log(`ℹ️ Sem CNAEs no perfil - retornando todas as licitações encontradas`)
  }

  // Limitar a 100 licitações mais recentes para não sobrecarregar o email
  if (licitacoes.length > 100) {
    console.log(`⚠️ Limitando a 100 licitações mais recentes (de ${licitacoes.length} encontradas)`)
    licitacoes = licitacoes.slice(0, 100)
  }

  return licitacoes
}

/**
 * Cria template HTML para email com licitações
 * Usa a mesma identidade visual do sistema (laranja, branco, cinza)
 */
function criarTemplateEmail(licitacoes, alerta, periodo) {
  const totalLicitacoes = licitacoes.length
  
  // Ícones SVG inline (sem emojis)
  const iconBell = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
  const iconFile = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
  const iconCalendar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>`
  const iconDollar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`
  const iconMapPin = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`
  const iconExternalLink = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" x2="21" y1="14" y2="3"></line></svg>`
  const iconAlert = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>`
  
  let tabelaLicitacoes = ''
  if (licitacoes.length > 0) {
    tabelaLicitacoes = licitacoes.slice(0, 50).map((lic, index) => {
      const valor = lic.valor_total_estimado 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lic.valor_total_estimado)
        : 'Não informado'
      const data = lic.data_publicacao_pncp ? new Date(lic.data_publicacao_pncp).toLocaleDateString('pt-BR') : 'N/A'
      
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; text-align: left; color: #6b7280; font-size: 13px;">${index + 1}</td>
          <td style="padding: 12px; text-align: left;">
            <strong style="color: #1f2937; font-size: 14px;">${lic.objeto_compra || 'Não informado'}</strong><br>
            <small style="color: #6b7280; font-size: 12px;">${lic.orgao_razao_social || 'Órgão não informado'}</small>
          </td>
          <td style="padding: 12px; text-align: left; color: #374151; font-size: 13px;">${lic.modalidade_nome || 'N/A'}</td>
          <td style="padding: 12px; text-align: right; color: #059669; font-weight: 600; font-size: 13px;">${valor}</td>
          <td style="padding: 12px; text-align: center; color: #374151; font-size: 13px;">${lic.uf_sigla || 'N/A'}</td>
          <td style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">${data}</td>
          <td style="padding: 12px; text-align: center;">
            ${lic.link_sistema_origem ? `<a href="${lic.link_sistema_origem}" style="color: #f97316; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">Ver ${iconExternalLink}</a>` : '<span style="color: #9ca3af;">N/A</span>'}
          </td>
        </tr>
      `
    }).join('')
  } else {
    tabelaLicitacoes = `
      <tr>
        <td colspan="7" style="padding: 40px; text-align: center; color: #6b7280;">
          <div style="display: inline-flex; align-items: center; gap: 8px; color: #6b7280;">
            ${iconAlert}
            <span>Nenhuma licitação encontrada no período de ${periodo.desde} até ${periodo.ate}</span>
          </div>
        </td>
      </tr>
    `
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Novas Licitações - ${alerta.nome}</title>
    </head>
    <body style="font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 9px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px 30px; color: white;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 9px;">
                      ${iconBell}
                    </div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: white;">${alerta.nome}</h1>
                  </div>
                  <p style="margin: 0; font-size: 14px; opacity: 0.95; color: white;">Sistema Licitação - Alertas Automáticos</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 30px;">
                  <!-- Resumo -->
                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 9px; padding: 20px; margin-bottom: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                      ${iconFile}
                      Resumo
                    </h2>
                    <div style="display: flex; gap: 40px; flex-wrap: wrap;">
                      <div>
                        <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Total de Licitações</strong>
                        <p style="margin: 0; font-size: 28px; color: #f97316; font-weight: 700;">${totalLicitacoes}</p>
                      </div>
                      <div>
                        <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Período Verificado</strong>
                        <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 500; display: flex; align-items: center; gap: 6px;">
                          ${iconCalendar}
                          ${periodo.desde} até ${periodo.ate}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  ${totalLicitacoes > 0 ? `
                  <!-- Tabela de Licitações -->
                  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 9px; overflow: hidden;">
                    <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
                      <h2 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                        ${iconFile}
                        Licitações Encontradas
                      </h2>
                    </div>
                    <div style="overflow-x: auto;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                        <thead>
                          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">#</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Objeto</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Modalidade</th>
                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${iconDollar} Valor</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${iconMapPin} UF</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${iconCalendar} Data</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${tabelaLicitacoes}
                        </tbody>
                      </table>
                    </div>
                    ${totalLicitacoes > 50 ? `
                    <div style="padding: 16px 20px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
                      <p style="margin: 0; color: #6b7280; font-size: 12px;">* Mostrando as primeiras 50 licitações de ${totalLicitacoes} encontradas.</p>
                    </div>
                    ` : ''}
                  </div>
                  ` : `
                  <!-- Sem Licitações -->
                  <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 9px; padding: 24px; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 10px; color: #92400e; margin-bottom: 8px;">
                      ${iconAlert}
                      <strong style="font-size: 16px;">Nenhuma licitação encontrada</strong>
                    </div>
                    <p style="margin: 0; color: #92400e; font-size: 14px;">Nenhuma licitação foi encontrada no período verificado (${periodo.desde} até ${periodo.ate}).</p>
                  </div>
                  `}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0 0 6px 0; color: #6b7280; font-size: 12px;">Este é um email automático do Sistema Licitação.</p>
                  <p style="margin: 0; color: #9ca3af; font-size: 11px;">Para gerenciar seus alertas, acesse a plataforma.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Envia email com licitações usando Resend
 */
async function enviarEmail(para, licitacoes, alerta, periodo) {
  try {
    console.log(`📧 Enviando email para: ${para}`)
    
    const html = criarTemplateEmail(licitacoes, alerta, periodo)
    
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [para],
      subject: `${alerta.nome} - ${licitacoes.length} nova(s) licitação(ões) encontrada(s)`,
      html: html,
    })

    if (error) {
      console.error('❌ Erro ao enviar email:', error)
      throw error
    }

    console.log(`✅ Email enviado com sucesso! ID: ${data?.id}`)
    return data
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error.message)
    throw error
  }
}


/**
 * Verifica e processa alertas
 */
async function verificarAlertas() {
  try {
    const agora = new Date()
    const horaAtual = agora.toTimeString().slice(0, 5) // HH:MM
    const timestamp = agora.toLocaleString('pt-BR')
    
    console.log('')
    console.log(`🔍 [${timestamp}] Iniciando verificação de alertas...`)
    console.log(`🕐 Hora atual: ${horaAtual}`)

    // Buscar alertas ativos
    const { data: alertas, error: alertasError } = await supabase
      .from('alertas_usuario')
      .select(`
        *,
        profiles:usuario_id (
          *
        )
      `)
      .eq('ativo', true)
      .in('frequencia', ['diario', 'semanal'])

    if (alertasError) {
      throw new Error(`Erro ao buscar alertas: ${alertasError.message}`)
    }

    if (!alertas || alertas.length === 0) {
      console.log('ℹ️ Nenhum alerta encontrado')
      return { success: true, processados: 0 }
    }

    console.log(`🔍 Encontrados ${alertas.length} alerta(s) para verificar`)

    // Filtrar alertas que estão no horário programado
    const alertasParaProcessar = alertas.filter((alerta) => {
      if (!alerta.horario_verificacao) {
        console.log(`⏰ Alerta "${alerta.nome_alerta}" sem horário definido - processando`)
        return true
      }

      const horarioAlerta = typeof alerta.horario_verificacao === 'string'
        ? alerta.horario_verificacao.slice(0, 5)
        : alerta.horario_verificacao

      const [horaAlerta, minutoAlerta] = horarioAlerta.split(':').map(Number)
      const [horaAtualNum, minutoAtualNum] = horaAtual.split(':').map(Number)

      const minutosAlerta = horaAlerta * 60 + minutoAlerta
      const minutosAtual = horaAtualNum * 60 + minutoAtualNum

      // Calcular diferença (pode ser negativa se ainda não chegou no horário)
      let diferencaMinutos = minutosAtual - minutosAlerta
      
      // Se a diferença for muito negativa (mais de 12 horas), considerar que é do dia seguinte
      if (diferencaMinutos < -12 * 60) {
        diferencaMinutos += 24 * 60
      }
      // Se a diferença for muito positiva (mais de 12 horas), considerar que é do dia anterior
      else if (diferencaMinutos > 12 * 60) {
        diferencaMinutos -= 24 * 60
      }

      // Processar se:
      // 1. Estiver até 5 minutos ANTES do horário (para processar cedo)
      // 2. Já passou do horário E ainda não foi processado hoje (até 30 minutos depois)
      // Isso garante que alertas não sejam perdidos se o servidor estiver offline
      const dentroDaJanelaAntes = diferencaMinutos >= -5 && diferencaMinutos <= 0
      const dentroDaJanelaDepois = diferencaMinutos > 0 && diferencaMinutos <= 30
      
      // Verificar se já foi processado hoje
      const ultimaVerificacao = alerta.ultima_verificacao
      const hoje = new Date().toISOString().split('T')[0]
      const foiProcessadoHoje = ultimaVerificacao && ultimaVerificacao.startsWith(hoje)
      
      const dentroDaJanela = dentroDaJanelaAntes || (dentroDaJanelaDepois && !foiProcessadoHoje)

      if (dentroDaJanela) {
        if (dentroDaJanelaAntes) {
          console.log(`✅ Alerta "${alerta.nome_alerta}" está no horário programado (${horarioAlerta}, diferença: ${diferencaMinutos} min)`)
        } else {
          console.log(`✅ Alerta "${alerta.nome_alerta}" passou do horário mas ainda não foi processado hoje (${horarioAlerta}, diferença: ${diferencaMinutos} min)`)
        }
        return true
      } else {
        if (foiProcessadoHoje) {
          console.log(`⏭️ Alerta "${alerta.nome_alerta}" já foi processado hoje (${horarioAlerta}, última verificação: ${ultimaVerificacao})`)
        } else {
          console.log(`⏭️ Alerta "${alerta.nome_alerta}" não está no horário (programado: ${horarioAlerta}, atual: ${horaAtual}, diferença: ${diferencaMinutos} min)`)
        }
        return false
      }
    })

    console.log(`📋 ${alertasParaProcessar.length} de ${alertas.length} alerta(s) estão no horário para processar`)

    if (alertasParaProcessar.length === 0) {
      console.log('ℹ️ Nenhum alerta no horário para processar agora')
      return { success: true, processados: 0 }
    }

    // Processar cada alerta
    const resultados = []

    for (const alerta of alertasParaProcessar) {
      const usuario = alerta.profiles
      if (!usuario) {
        console.warn(`⚠️ Alerta "${alerta.nome_alerta}" sem perfil de usuário associado`)
        continue
      }

      try {
        // Buscar todas as licitações filtradas (últimos 5 dias)
        const dataAtual = new Date()
        const dataInicio = formatarDataParaQuery(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000))
        const dataFim = formatarDataParaQuery(dataAtual)

        console.log(`📋 Verificando alerta "${alerta.nome_alerta}" - buscando licitações de ${dataInicio} até ${dataFim}`)
        console.log(`👤 Usuário: ${usuario.razao_social || usuario.nome_fantasia || usuario.email}`)
        console.log(`📅 Data atual: ${dataAtual.toISOString()}`)

        const licitacoesFiltradas = await buscarLicitacoesFiltradas(alerta, usuario, dataInicio, dataFim)

        console.log(`✅ Encontradas ${licitacoesFiltradas.length} licitação(ões) filtrada(s) para "${alerta.nome_alerta}"`)
        
        if (licitacoesFiltradas.length > 0) {
          console.log(`📅 Licitação mais recente: ${licitacoesFiltradas[0].data_publicacao_pncp}`)
          console.log(`📅 Licitação mais antiga: ${licitacoesFiltradas[licitacoesFiltradas.length - 1].data_publicacao_pncp}`)
        }

        console.log(`📊 Total de licitações a enviar: ${licitacoesFiltradas.length}`)
        
        // Enviar email para o usuário
        const emailUsuario = usuario.email || alerta.email_notificacao
        let emailEnviadoComSucesso = false
        
        if (emailUsuario) {
          try {
            await enviarEmail(
              emailUsuario,
              licitacoesFiltradas,
              { nome: alerta.nome_alerta },
              { desde: dataInicio, ate: dataFim }
            )
            console.log(`✅ Email enviado para: ${emailUsuario}`)
            emailEnviadoComSucesso = true
          } catch (emailError) {
            console.error(`❌ Erro ao enviar email: ${emailError.message}`)
            // NÃO marcar como processado se o email falhar - permite tentar novamente
            console.warn(`⚠️ Alerta não será marcado como processado devido ao erro no email`)
          }
        } else {
          console.warn(`⚠️ Nenhum email encontrado para o usuário`)
        }

        // Atualizar última verificação APENAS se o email foi enviado com sucesso
        if (emailEnviadoComSucesso) {
          await supabase
            .from('alertas_usuario')
            .update({ ultima_verificacao: new Date().toISOString() })
            .eq('id', alerta.id)
        } else {
          console.log(`⏭️ Alerta "${alerta.nome_alerta}" não foi marcado como processado - será tentado novamente na próxima verificação`)
        }

        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          licitacoes_encontradas: licitacoesFiltradas.length,
          email_enviado: !!emailUsuario,
          status: 'success',
        })

        console.log(`✅ Alerta "${alerta.nome_alerta}" processado com sucesso!`)
        console.log(`   📧 ${licitacoesFiltradas.length} licitação(ões) enviada(s) via email`)

      } catch (error) {
        console.error(`❌ Erro ao processar alerta "${alerta.nome_alerta}":`, error.message)
        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          erro: error.message,
          status: 'error',
        })
      }
    }

    console.log(`✅ Verificação concluída: ${resultados.length} alerta(s) processado(s)`)
    return {
      success: true,
      processados: resultados.length,
      resultados,
    }

  } catch (error) {
    console.error('❌ Erro ao verificar alertas:', error.message)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao verificar alertas',
    }
  }
}

// Executar imediatamente
console.log('🚀 Servidor de verificação de alertas iniciado!')
console.log(`⏰ Verificando a cada ${INTERVALO_MINUTOS} minutos`)
console.log(`📧 Emails serão enviados automaticamente quando licitações forem encontradas`)
console.log(`📬 Remetente configurado: ${emailFrom}`)
console.log('')

// Primeira verificação imediata
verificarAlertas()

// Configurar intervalo
const intervaloMs = INTERVALO_MINUTOS * 60 * 1000
setInterval(() => {
  verificarAlertas()
}, intervaloMs)

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n⏹️ Encerrando servidor...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n⏹️ Encerrando servidor...')
  process.exit(0)
})

