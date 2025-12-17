/**
 * Script de teste para envio de emails via Resend
 * 
 * Para executar:
 * node server/testar-email.js
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { Resend } from 'resend'

// Configurar dotenv
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
dotenv.config({ path: resolve(rootDir, '.env') })

// Configuração do Resend
const resendApiKey = process.env.RESEND_API_KEY || 're_J8E9U3ja_FtygDuLctpub3nQiBYTxMPK6'
const resend = new Resend(resendApiKey)
// Usar domínio de teste do Resend (onboarding@resend.dev) para testes
const emailFrom = 'Sistema Licitação <onboarding@resend.dev>'

// Email de teste (pode ser alterado)
const emailTeste = process.argv[2] || process.env.EMAIL_TESTE || 'neuroboost.ai2025@gmail.com'

// Dados de teste (simulando licitações)
const licitacoesTeste = [
  {
    objeto_compra: 'Aquisição de equipamentos de informática',
    orgao_razao_social: 'Prefeitura Municipal de São Paulo',
    modalidade_nome: 'Pregão Eletrônico',
    valor_total_estimado: 150000.00,
    uf_sigla: 'SP',
    data_publicacao_pncp: '2025-12-16',
    link_sistema_origem: 'https://example.com/licitacao/1'
  },
  {
    objeto_compra: 'Contratação de serviços de manutenção predial',
    orgao_razao_social: 'Secretaria de Estado da Administração',
    modalidade_nome: 'Concorrência',
    valor_total_estimado: 500000.00,
    uf_sigla: 'RJ',
    data_publicacao_pncp: '2025-12-15',
    link_sistema_origem: 'https://example.com/licitacao/2'
  },
  {
    objeto_compra: 'Fornecimento de material de escritório',
    orgao_razao_social: 'Tribunal de Justiça',
    modalidade_nome: 'Pregão Eletrônico',
    valor_total_estimado: 75000.00,
    uf_sigla: 'MG',
    data_publicacao_pncp: '2025-12-14',
    link_sistema_origem: 'https://example.com/licitacao/3'
  }
]

// Template HTML (mesmo do servidor - sem emojis, com ícones SVG)
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

// Função principal
async function testarEmail() {
  console.log('🧪 Testando envio de email...\n')
  console.log(`📧 Remetente: ${emailFrom}`)
  console.log(`📬 Destinatário: ${emailTeste}\n`)

  try {
    const html = criarTemplateEmail(
      licitacoesTeste,
      { nome: 'TESTE - Alerta de Licitações' },
      { desde: '2025-12-11', ate: '2025-12-16' }
    )

    console.log('📤 Enviando email...')

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [emailTeste],
      subject: `TESTE - Alerta de Licitações - ${licitacoesTeste.length} licitação(ões) encontrada(s)`,
      html: html,
    })

    if (error) {
      console.error('❌ Erro ao enviar email:', error)
      process.exit(1)
    }

    console.log('✅ Email enviado com sucesso!')
    console.log(`📧 ID do email: ${data?.id}`)
    console.log(`\n💡 Verifique a caixa de entrada (e spam) de: ${emailTeste}`)
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

// Executar teste
testarEmail()

