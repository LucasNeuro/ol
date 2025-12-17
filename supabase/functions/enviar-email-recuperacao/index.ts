// ============================================
// EDGE FUNCTION: ENVIAR EMAIL RECUPERAÇÃO SENHA
// ============================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, resetUrl } = await req.json()
    
    if (!email || !resetUrl) {
      throw new Error('Email e resetUrl são obrigatórios')
    }

    console.log('📧 Enviando email de recuperação para:', email)

    // Configurar Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || 're_J8E9U3ja_FtygDuLctpub3nQiBYTxMPK6'
    const emailFrom = Deno.env.get('EMAIL_FROM') || 'Sistema Licitação <onboarding@resend.dev>'
    
    const resend = new Resend(resendApiKey)

    // Template do email
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperação de Senha - Sistema Licitação</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #f97316; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Sistema Licitação</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Recuperação de Senha</h2>
                      
                      <p style="color: #4b5563; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                        Você solicitou a recuperação de senha para sua conta no Sistema Licitação.
                      </p>
                      
                      <p style="color: #4b5563; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                        Clique no botão abaixo para redefinir sua senha:
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <a href="${resetUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Redefinir Senha</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #6b7280; margin: 30px 0 0 0; font-size: 14px; line-height: 1.6;">
                        Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                      </p>
                      <p style="color: #3b82f6; margin: 10px 0 0 0; font-size: 14px; word-break: break-all;">
                        ${resetUrl}
                      </p>
                      
                      <p style="color: #6b7280; margin: 30px 0 0 0; font-size: 14px; line-height: 1.6;">
                        Este link expira em 24 horas. Se você não solicitou esta recuperação, ignore este email.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                      <p style="color: #6b7280; margin: 0; font-size: 12px;">
                        Sistema Licitação - Portal de Licitações Públicas
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: 'Recuperação de Senha - Sistema Licitação',
      html: html,
    })

    if (error) {
      console.error('❌ Erro ao enviar email:', error)
      throw error
    }

    console.log('✅ Email enviado com sucesso! ID:', data?.id)

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao enviar email' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

