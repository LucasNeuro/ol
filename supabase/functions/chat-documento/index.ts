

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
 
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      pergunta, 
      documentoUrl, 
      documentoId,
      dadosEmpresa = null,
      historico = [] 
    } = await req.json()

    if (!pergunta || !documentoUrl) {
      throw new Error('Parâmetros obrigatórios: pergunta, documentoUrl')
    }

    // Validar URL do documento
    try {
      new URL(documentoUrl)
    } catch {
      throw new Error('URL do documento inválida')
    }

    console.log('💬 Nova pergunta:', pergunta)
    console.log('📄 Documento URL:', documentoUrl)
    console.log('🏢 Dados empresa:', dadosEmpresa ? 'Sim' : 'Não')
    console.log('📚 Histórico:', historico.length, 'mensagens')

    // Verificar se a URL é acessível (opcional, mas recomendado)
    // O Document QnA do Mistral precisa de URL pública e acessível
    if (!documentoUrl.startsWith('http://') && !documentoUrl.startsWith('https://')) {
      console.warn('⚠️ URL do documento não parece ser uma URL HTTP válida')
    }

   
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY')
    
    if (!mistralApiKey) {
      throw new Error('MISTRAL_API_KEY não configurada')
    }


    // Preparar contexto da empresa para o system prompt
    let contextoEmpresa = ''
    if (dadosEmpresa) {
      const empresaInfo = []
      
      if (dadosEmpresa.razao_social) empresaInfo.push(`Razão Social: ${dadosEmpresa.razao_social}`)
      if (dadosEmpresa.nome_fantasia) empresaInfo.push(`Nome Fantasia: ${dadosEmpresa.nome_fantasia}`)
      if (dadosEmpresa.cnpj) empresaInfo.push(`CNPJ: ${dadosEmpresa.cnpj}`)
      if (dadosEmpresa.uf) empresaInfo.push(`Estado: ${dadosEmpresa.uf}`)
      if (dadosEmpresa.municipio) empresaInfo.push(`Município: ${dadosEmpresa.municipio}`)
      if (dadosEmpresa.cnae_principal) empresaInfo.push(`CNAE Principal: ${dadosEmpresa.cnae_principal}`)
      if (dadosEmpresa.porte_empresa) empresaInfo.push(`Porte: ${dadosEmpresa.porte_empresa}`)
      if (dadosEmpresa.natureza_juridica) empresaInfo.push(`Natureza Jurídica: ${dadosEmpresa.natureza_juridica}`)
      if (dadosEmpresa.capital_social) empresaInfo.push(`Capital Social: R$ ${dadosEmpresa.capital_social.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      if (dadosEmpresa.setores_atividades && Array.isArray(dadosEmpresa.setores_atividades) && dadosEmpresa.setores_atividades.length > 0) {
        empresaInfo.push(`Setores de Atividade: ${dadosEmpresa.setores_atividades.join(', ')}`)
      }
      if (dadosEmpresa.estados_interesse && Array.isArray(dadosEmpresa.estados_interesse) && dadosEmpresa.estados_interesse.length > 0) {
        empresaInfo.push(`Estados de Interesse: ${dadosEmpresa.estados_interesse.join(', ')}`)
      }
      
      if (empresaInfo.length > 0) {
        contextoEmpresa = `\n\nDADOS DA EMPRESA DO USUÁRIO:\n${empresaInfo.join('\n')}\n\nUse essas informações para dar respostas mais precisas sobre a participação da empresa nesta licitação. Considere o porte da empresa, localização, setores de atividade e outros dados relevantes ao analisar a viabilidade de participação.`
      }
    }

    // Preparar mensagens com system prompt em português - Assistente Conversacional Especializado
    // IMPORTANTE: O Document QnA do Mistral processa o documento automaticamente
    // O documento deve ser incluído em cada mensagem do usuário para garantir que o contexto seja mantido
    const messages = [
      {
        role: "system",
        content: `Você é o "Assistente Sistema Licitação", um especialista em licitações públicas brasileiras. Você tem acesso DIRETO ao conteúdo completo do documento PDF através do Document QnA da Mistral.

SUA FUNÇÃO PRINCIPAL:
- Use o Document QnA para ler e analisar TODO o conteúdo do documento PDF fornecido
- Responda perguntas baseando-se EXCLUSIVAMENTE no conteúdo real do documento
- Cite informações específicas do documento (páginas, seções, valores, datas, requisitos técnicos)
- Use os dados da empresa do usuário para contextualizar respostas sobre participação${contextoEmpresa}

REGRAS DE RESPOSTA:
1. SEMPRE analise o documento PDF fornecido antes de responder
2. Cite informações específicas: "Segundo o edital, na página X...", "O valor estimado é de R$ X...", "O requisito técnico especifica..."
3. Se não encontrar informação no documento, diga claramente: "Não encontrei essa informação específica no documento"
4. Quando perguntado sobre participação, compare os requisitos do edital com os dados da empresa
5. Evite respostas genéricas - seja específico e baseado no conteúdo real
6. NUNCA invente informações que não estão no documento
7. Se a pergunta for sobre algo que não está no documento, seja honesto e diga isso

ESTILO:
- Português (PT-BR), tom cordial e profissional
- Respostas diretas e objetivas (1-3 parágrafos)
- Cite valores, datas e requisitos exatos do documento
- Use os dados da empresa apenas para contextualizar, não para inventar requisitos

IMPORTANTE:
- Você está conversando com o documento REAL - use o Document QnA para buscar informações precisas
- Cada pergunta deve ser analisada com base no conteúdo atual do PDF
- Se a resposta parecer repetitiva, verifique se está analisando o documento correto e forneça informações mais específicas`
      },
      // Incluir histórico, mas garantir que mensagens do usuário tenham o documento
      ...historico.map((msg: any) => {
        if (msg.role === 'user') {
          // Se for mensagem do usuário, garantir que tenha o documento
          const content = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }]
          // Verificar se já tem document_url
          const hasDocument = content.some((c: any) => c.type === 'document_url')
          if (!hasDocument) {
            content.push({
              type: "document_url",
              document_url: documentoUrl
            })
          }
          return {
            role: msg.role,
            content: content
          }
        }
        return {
          role: msg.role,
          content: msg.content
        }
      }),
      {
        role: "user",
        content: [
          {
            type: "text",
            text: pergunta
          },
          {
            type: "document_url",
            document_url: documentoUrl
          }
        ]
      }
    ]

    console.log('📤 Enviando para Mistral API com Document QnA...')
    console.log('📋 Estrutura da mensagem:', JSON.stringify({
      model: 'mistral-small-latest',
      messages_count: messages.length,
      last_message_has_document: messages[messages.length - 1]?.content?.some((c: any) => c.type === 'document_url'),
      document_url: documentoUrl
    }, null, 2))

    // 3. Chamar Mistral API com timeout e retry
    let mistralResponse
    let retries = 2
    let lastError
    
    while (retries > 0) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout
        
        mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mistralApiKey}`
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: messages,
            temperature: 0.5,
            max_tokens: 2000 // Aumentado para respostas mais completas
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (mistralResponse.ok) {
          break
        } else if (mistralResponse.status >= 500 && retries > 1) {
          retries--
          await new Promise(resolve => setTimeout(resolve, 3000))
          continue
        } else {
          const errorText = await mistralResponse.text()
          throw new Error(`Erro Mistral API: ${mistralResponse.status} - ${errorText}`)
        }
      } catch (error) {
        lastError = error
        if (error.name === 'AbortError') {
          throw new Error('Timeout ao processar pergunta (60s)')
        }
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
    }
    
    if (!mistralResponse || !mistralResponse.ok) {
      const errorText = lastError?.message || 'Erro desconhecido'
      throw new Error(errorText)
    }

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text()
      console.error('❌ Erro Mistral API:', errorText)
      throw new Error(`Erro Mistral API: ${mistralResponse.status} - ${errorText}`)
    }

    const mistralData = await mistralResponse.json()
    
    // Validar resposta do Mistral
    if (!mistralData.choices || !mistralData.choices[0] || !mistralData.choices[0].message) {
      throw new Error('Resposta inválida da API Mistral')
    }
    
    const resposta = mistralData.choices[0].message.content
    
    if (!resposta || resposta.trim().length === 0) {
      throw new Error('Resposta vazia da API Mistral')
    }

    console.log('✅ Resposta recebida:', resposta.substring(0, 100) + '...')
    console.log('📊 Tokens usados:', {
      prompt: mistralData.usage?.prompt_tokens || 0,
      completion: mistralData.usage?.completion_tokens || 0,
      total: mistralData.usage?.total_tokens || 0
    })

    // 4. Registrar acesso ao documento (se documentoId fornecido)
    if (documentoId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      await supabase.rpc('registrar_acesso_documento', { doc_id: documentoId })
    }

    // 5. Salvar histórico de conversa (opcional)
    // TODO: Implementar salvamento do histórico

    // 6. Retornar resposta
    return new Response(
      JSON.stringify({
        success: true,
        resposta: resposta,
        tokens: {
          prompt: mistralData.usage.prompt_tokens,
          completion: mistralData.usage.completion_tokens,
          total: mistralData.usage.total_tokens
        },
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Erro ao processar chat:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao processar chat'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

