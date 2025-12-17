/**
 * API Route para Vercel - Verificar Alertas
 * 
 * Esta API Route será chamada por um serviço de cron externo (cron-job.org, EasyCron, etc.)
 * porque a conta Hobby do Vercel tem limitações nos cron jobs (apenas 1x por dia).
 * 
 * Como usar:
 * 1. Configure um cron job externo para chamar esta URL a cada 5 minutos
 * 2. URL: https://seu-projeto.vercel.app/api/verificar-alertas
 * 3. Método: GET ou POST
 * 
 * Veja CONFIGURAR_CRON_EXTERNO.md para instruções detalhadas.
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Configuração do Resend para envio de emails
const resendApiKey = process.env.RESEND_API_KEY || 're_J8E9U3ja_FtygDuLctpub3nQiBYTxMPK6'
const resend = new Resend(resendApiKey)
let emailFrom = process.env.EMAIL_FROM || 'Sistema Licitação <onboarding@resend.dev>'
if (emailFrom.includes('@') && !emailFrom.includes('onboarding@resend.dev')) {
  emailFrom = 'Sistema Licitação <onboarding@resend.dev>'
}

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
      
      if (dados.itens && Array.isArray(dados.itens)) {
        dados.itens.forEach(item => {
          if (item.cnae) {
            cnaes.push(item.cnae)
          }
        })
      }
    } catch (e) {
      // Silencioso
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
      // Silencioso
    }
  }

  // Normalizar CNAEs (remover hífens e barras)
  return cnaes
    .map(c => String(c).trim())
    .filter(c => c)
    .map(c => c.replace(/[-\/]/g, ''))
}

/**
 * Busca licitações filtradas baseadas no perfil do usuário
 */
async function buscarLicitacoesFiltradas(supabase, alerta, usuario, dataInicio, dataFim) {
  let query = supabase
    .from('licitacoes')
    .select('*')
    .gte('data_publicacao_pncp', dataInicio)
    .order('data_publicacao_pncp', { ascending: false })
    .limit(500)

  if (dataFim) {
    query = query.lte('data_publicacao_pncp', dataFim)
  }

  // Filtrar por estados de interesse
  if (usuario.estados_interesse && Array.isArray(usuario.estados_interesse) && usuario.estados_interesse.length > 0) {
    if (usuario.estados_interesse.length === 1) {
      query = query.eq('uf_sigla', usuario.estados_interesse[0])
    } else {
      query = query.in('uf_sigla', usuario.estados_interesse)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar licitações:', error.message)
    return []
  }

  let licitacoes = data || []

  // Filtrar por CNAEs do perfil (normalizados)
  const cnaesPerfil = []

  if (usuario.cnae_principal) {
    const cnaeNormalizado = String(usuario.cnae_principal).trim().replace(/[-\/]/g, '')
    if (cnaeNormalizado) cnaesPerfil.push(cnaeNormalizado)
  }

  if (usuario.cnaes_secundarios && Array.isArray(usuario.cnaes_secundarios)) {
    usuario.cnaes_secundarios.forEach((cnae) => {
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

  // Filtrar licitações por CNAEs se houver
  if (cnaesPerfil.length > 0) {
    const licitacoesOriginais = [...licitacoes]
    
    licitacoes = licitacoes.filter((lic) => {
      const cnaesLicitacao = extrairCnaesLicitacao(lic)
      
      // Se a licitação não tem CNAE, incluir mesmo assim
      if (cnaesLicitacao.length === 0) {
        return true
      }
      
      // Comparar CNAEs normalizados
      return cnaesPerfil.some((cnaePerfil) => 
        cnaesLicitacao.some((cnaeLic) => {
          const cnaeLicNormalizado = String(cnaeLic).trim().replace(/[-\/]/g, '')
          return cnaeLicNormalizado === cnaePerfil
        })
      )
    })
    
    // Se nenhuma licitação passou no filtro, retornar todas (filtro muito restritivo)
    if (licitacoes.length === 0 && licitacoesOriginais.length > 0) {
      licitacoes = licitacoesOriginais.slice(0, 100)
    }
  }

  // Limitar a 100 licitações mais recentes
  if (licitacoes.length > 100) {
    licitacoes = licitacoes.slice(0, 100)
  }

  return licitacoes
}

/**
 * Cria template HTML para email (versão simplificada)
 */
function criarTemplateEmail(licitacoes, alerta, periodo) {
  const totalLicitacoes = licitacoes.length
  
  const iconFile = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path></svg>`
  const iconCalendar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line></svg>`
  
  let tabelaLicitacoes = ''
  if (licitacoes.length > 0) {
    tabelaLicitacoes = licitacoes.slice(0, 20).map((lic, index) => {
      const valor = lic.valor_total_estimado 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lic.valor_total_estimado)
        : 'Não informado'
      const data = lic.data_publicacao_pncp ? new Date(lic.data_publicacao_pncp).toLocaleDateString('pt-BR') : 'N/A'
      
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; color: #1f2937; font-size: 14px;">
            <strong>${lic.objeto_compra || 'Não informado'}</strong><br>
            <small style="color: #6b7280;">${lic.orgao_razao_social || 'Órgão não informado'}</small>
          </td>
          <td style="padding: 12px; text-align: right; color: #1f2937; font-size: 13px;">${valor}</td>
          <td style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">${lic.uf_sigla || 'N/A'}</td>
          <td style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">${data}</td>
          <td style="padding: 12px; text-align: center;">
            ${lic.link_sistema_origem ? `<a href="${lic.link_sistema_origem}" style="color: #f97316; text-decoration: none;">Ver</a>` : '-'}
          </td>
        </tr>
      `
    }).join('')
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #f97316; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Sistema Licitação</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">${alerta.nome} - ${totalLicitacoes} licitação(ões) encontrada(s)</h2>
                    
                    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                      <div style="display: flex; gap: 40px;">
                        <div>
                          <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Total</strong>
                          <p style="margin: 0; font-size: 28px; color: #f97316; font-weight: 700;">${totalLicitacoes}</p>
                        </div>
                        <div>
                          <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Período</strong>
                          <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 500;">${periodo.desde} até ${periodo.ate}</p>
                        </div>
                      </div>
                    </div>
                    
                    ${totalLicitacoes > 0 ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                      <thead>
                        <tr style="background: #f9fafb;">
                          <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 12px;">Objeto</th>
                          <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 12px;">Valor</th>
                          <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 12px;">UF</th>
                          <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 12px;">Data</th>
                          <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 12px;">Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${tabelaLicitacoes}
                      </tbody>
                    </table>
                    ${totalLicitacoes > 20 ? `<p style="margin-top: 16px; color: #6b7280; font-size: 12px;">* Mostrando as primeiras 20 de ${totalLicitacoes} licitações.</p>` : ''}
                    ` : '<p style="color: #6b7280;">Nenhuma licitação encontrada no período verificado.</p>'}
                  </td>
                </tr>
                <tr>
                  <td style="background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">Sistema Licitação - Portal de Licitações Públicas</p>
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
    const html = criarTemplateEmail(licitacoes, alerta, periodo)
    
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [para],
      subject: `${alerta.nome} - ${licitacoes.length} nova(s) licitação(ões) encontrada(s)`,
      html: html,
    })

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error.message)
    throw error
  }
}

/**
 * Handler principal da API Route
 */
export default async function handler(req, res) {
  // Permitir GET (para cron job) e POST (para teste manual)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST')

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        error: 'Variáveis de ambiente não configuradas',
        message: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const agora = new Date()
    const horaAtual = agora.toTimeString().slice(0, 5)

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
      return res.status(200).json({ 
        success: true, 
        processados: 0,
        message: 'Nenhum alerta encontrado'
      })
    }

    // Filtrar alertas que estão no horário programado
    const alertasParaProcessar = alertas.filter((alerta) => {
      if (!alerta.horario_verificacao) {
        return true
      }

      const horarioAlerta = typeof alerta.horario_verificacao === 'string'
        ? alerta.horario_verificacao.slice(0, 5)
        : alerta.horario_verificacao

      const [horaAlerta, minutoAlerta] = horarioAlerta.split(':').map(Number)
      const [horaAtualNum, minutoAtualNum] = horaAtual.split(':').map(Number)

      const minutosAlerta = horaAlerta * 60 + minutoAlerta
      const minutosAtual = horaAtualNum * 60 + minutoAtualNum

      let diferencaMinutos = minutosAtual - minutosAlerta
      
      if (diferencaMinutos < -12 * 60) {
        diferencaMinutos += 24 * 60
      } else if (diferencaMinutos > 12 * 60) {
        diferencaMinutos -= 24 * 60
      }

      const dentroDaJanelaAntes = diferencaMinutos >= -5 && diferencaMinutos <= 0
      const dentroDaJanelaDepois = diferencaMinutos > 0 && diferencaMinutos <= 30
      
      const ultimaVerificacao = alerta.ultima_verificacao
      const hoje = new Date().toISOString().split('T')[0]
      const foiProcessadoHoje = ultimaVerificacao && ultimaVerificacao.startsWith(hoje)
      
      return dentroDaJanelaAntes || (dentroDaJanelaDepois && !foiProcessadoHoje)
    })

    if (alertasParaProcessar.length === 0) {
      return res.status(200).json({ 
        success: true, 
        processados: 0,
        message: 'Nenhum alerta no horário para processar'
      })
    }

    // Processar cada alerta
    const resultados = []

    for (const alerta of alertasParaProcessar) {
      const usuario = alerta.profiles
      if (!usuario) continue

      try {
        const dataAtual = new Date()
        const dataInicio = formatarDataParaQuery(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000))
        const dataFim = formatarDataParaQuery(dataAtual)

        const licitacoesFiltradas = await buscarLicitacoesFiltradas(
          supabase, 
          alerta, 
          usuario, 
          dataInicio, 
          dataFim
        )

        const emailUsuario = usuario.email || alerta.email_notificacao
        let emailEnviadoComSucesso = false
        
        if (emailUsuario && licitacoesFiltradas.length > 0) {
          try {
            await enviarEmail(
              emailUsuario,
              licitacoesFiltradas,
              { nome: alerta.nome_alerta },
              { desde: dataInicio, ate: dataFim }
            )
            emailEnviadoComSucesso = true
          } catch (emailError) {
            console.error(`❌ Erro ao enviar email: ${emailError.message}`)
          }
        }

        // Atualizar última verificação APENAS se o email foi enviado com sucesso
        if (emailEnviadoComSucesso) {
          await supabase
            .from('alertas_usuario')
            .update({ ultima_verificacao: new Date().toISOString() })
            .eq('id', alerta.id)
        }

        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          licitacoes_encontradas: licitacoesFiltradas.length,
          email_enviado: emailEnviadoComSucesso,
          status: 'success',
        })

      } catch (error) {
        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          erro: error.message,
          status: 'error',
        })
      }
    }

    return res.status(200).json({
      success: true,
      processados: resultados.length,
      resultados,
    })

  } catch (error) {
    console.error('Erro ao verificar alertas:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro desconhecido',
    })
  }
}
