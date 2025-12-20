/**
 * Validação de correspondência usando Edge Function com IA
 * Usa Mistral AI para validar se licitação corresponde às atividades da empresa
 */

/**
 * Valida correspondência usando Edge Function com IA (Mistral)
 * @param {string} objetoLicitacao - Objeto completo da licitação
 * @param {Array} atividadesEmpresa - Array de atividades do perfil do usuário
 * @param {string} userId - ID do usuário (opcional, para cache)
 * @returns {Promise<boolean|null>} - true se corresponde, false se não corresponde, null se erro/indisponível
 */
export async function validarCorrespondenciaIAEdgeFunction(
  objetoLicitacao,
  atividadesEmpresa,
  userId = null
) {
  if (!objetoLicitacao || !atividadesEmpresa || atividadesEmpresa.length === 0) {
    return null
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      console.warn('⚠️ [IA] VITE_SUPABASE_URL não configurado')
      return null
    }

    const { supabase } = await import('@/lib/supabase')
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

    const response = await fetch(
      `${supabaseUrl}/functions/v1/validar-correspondencia-ia`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          objetoLicitacao,
          atividadesEmpresa,
          userId,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      console.warn('⚠️ [IA] Erro na Edge Function:', errorData.error || response.status)
      return null // Retornar null para usar filtro semântico como fallback
    }

    const result = await response.json()

    // Se IA não está disponível ou retornou null, usar filtro semântico
    if (result.resultado === null) {
      return null
    }

    return result.resultado === true
  } catch (error) {
    console.warn('⚠️ [IA] Erro ao validar com IA, usando filtro semântico:', error.message)
    return null // Retornar null para usar filtro semântico como fallback
  }
}

/**
 * Filtro híbrido: combina filtro semântico + IA para máxima precisão e cobertura
 * 
 * Estratégia:
 * 1. Filtro semântico rápido para casos claros (aceita/rejeita diretamente)
 * 2. IA apenas para casos duvidosos (pontuação média) para aumentar cobertura
 * 
 * @param {Object} licitacao - Objeto da licitação
 * @param {Object} palavrasChave - Palavras-chave extraídas dos setores
 * @param {Object} sinonimosPersonalizados - Sinônimos personalizados
 * @param {Object} sinonimosBanco - Sinônimos do banco
 * @param {Array} setoresAtividades - Atividades completas da empresa
 * @param {Function} correspondeAtividades - Função do filtro semântico
 * @param {boolean} usarIA - Se true, usa IA para casos duvidosos
 * @returns {Promise<boolean>} - true se deve mostrar, false se não deve
 */
export async function correspondeAtividadesHibrido(
  licitacao,
  palavrasChave,
  sinonimosPersonalizados,
  sinonimosBanco,
  setoresAtividades,
  correspondeAtividades,
  usarIA = false
) {
  // Se não tem palavras-chave, mostrar tudo
  if (!palavrasChave || palavrasChave.todas?.length === 0) {
    return true
  }

  const { obterObjetoCompleto } = await import('@/lib/filtroSemantico')
  const objetoCompleto = obterObjetoCompleto(licitacao)
  if (!objetoCompleto) {
    return false // Sem objeto, não mostrar
  }

  // PASSO 1: Aplicar filtro semântico primeiro (rápido)
  const resultadoSemantico = correspondeAtividades(
    licitacao,
    palavrasChave,
    sinonimosPersonalizados,
    sinonimosBanco,
    setoresAtividades
  )

  // Se resultado é claro (true), aceitar diretamente
  if (resultadoSemantico === true) {
    return true
  }

  // Se resultado é claro (false) e não queremos usar IA, rejeitar
  if (resultadoSemantico === false && !usarIA) {
    return false
  }

  // PASSO 2: Se resultado é duvidoso (false mas queremos validar com IA)
  // OU se queremos usar IA para aumentar cobertura
  if (usarIA && setoresAtividades && setoresAtividades.length > 0) {
    try {
      // Validar com IA apenas para casos que o filtro semântico rejeitou
      // mas que podem ser relevantes (aumentar cobertura)
      const validacaoIA = await validarCorrespondenciaIAEdgeFunction(
        objetoCompleto,
        setoresAtividades,
        null // userId opcional
      )

      // Se IA confirmou, aceitar mesmo que filtro semântico tenha rejeitado
      if (validacaoIA === true) {
        console.log('✅ [IA] Licitação aceita por IA (filtro semântico havia rejeitado):', {
          objeto: objetoCompleto.substring(0, 100)
        })
        return true
      }

      // Se IA rejeitou, manter rejeição
      if (validacaoIA === false) {
        return false
      }

      // Se IA retornou null (erro/indisponível), usar resultado do filtro semântico
      return resultadoSemantico
    } catch (error) {
      console.warn('⚠️ [IA] Erro ao validar com IA, usando filtro semântico:', error)
      return resultadoSemantico
    }
  }

  // Se não usar IA, retornar resultado do filtro semântico
  return resultadoSemantico
}

