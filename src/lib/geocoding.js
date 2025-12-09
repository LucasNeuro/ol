''// ============================================
// UTILITÁRIOS DE GEOCODIFICAÇÃO E DISTÂNCIA
// ============================================

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine
 * @param {number} lat1 - Latitude do primeiro ponto
 * @param {number} lon1 - Longitude do primeiro ponto
 * @param {number} lat2 - Latitude do segundo ponto
 * @param {number} lon2 - Longitude do segundo ponto
 * @returns {number} Distância em quilômetros
 */
export function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371 // Raio da Terra em quilômetros
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distância em quilômetros
}

/**
 * Geocodifica um endereço usando a API do ViaCEP e OpenStreetMap
 * @param {string} cep - CEP do endereço
 * @param {string} logradouro - Logradouro
 * @param {string} numero - Número
 * @param {string} municipio - Município
 * @param {string} uf - UF
 * @returns {Promise<{lat: number, lon: number} | null>} Coordenadas ou null
 */
export async function geocodificarEndereco(cep, logradouro, numero, municipio, uf) {
  try {
    // Primeiro, buscar dados do CEP via ViaCEP
    if (cep) {
      const cepLimpo = cep.replace(/\D/g, '')
      if (cepLimpo.length === 8) {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
        if (response.ok) {
          const dados = await response.json()
          if (!dados.erro) {
            logradouro = dados.logradouro || logradouro
            municipio = dados.localidade || municipio
            uf = dados.uf || uf
          }
        }
      }
    }

    // Montar endereço completo
    const enderecoCompleto = [
      logradouro,
      numero,
      municipio,
      uf,
      'Brasil'
    ].filter(Boolean).join(', ')

    // Geocodificar usando Nominatim (OpenStreetMap)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoCompleto)}&limit=1`,
      {
        headers: {
          'User-Agent': 'Focus-Licitacoes/1.0'
        }
      }
    )

    if (response.ok) {
      const data = await response.json()
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        }
      }
    }
  } catch (error) {
    console.warn('Erro ao geocodificar endereço:', error)
  }

  return null
}

/**
 * Geocodifica endereço da empresa a partir do perfil do usuário
 * @param {object} user - Objeto do usuário com dados de endereço
 * @returns {Promise<{lat: number, lon: number} | null>} Coordenadas ou null
 */
export async function geocodificarEnderecoEmpresa(user) {
  if (!user) return null

  return await geocodificarEndereco(
    user.cep,
    user.logradouro,
    user.numero,
    user.municipio,
    user.uf
  )
}

/**
 * Geocodifica município a partir de código IBGE ou nome
 * @param {string} codigoIbge - Código IBGE do município
 * @param {string} municipioNome - Nome do município
 * @param {string} uf - UF
 * @returns {Promise<{lat: number, lon: number} | null>} Coordenadas ou null
 */
export async function geocodificarMunicipio(codigoIbge, municipioNome, uf) {
  try {
    // Tentar buscar coordenadas do município via API do IBGE
    if (codigoIbge) {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigoIbge}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.latitude && data.longitude) {
          return {
            lat: parseFloat(data.latitude),
            lon: parseFloat(data.longitude)
          }
        }
      }
    }

    // Fallback: geocodificar por nome
    if (municipioNome && uf) {
      return await geocodificarEndereco(null, null, null, municipioNome, uf)
    }
  } catch (error) {
    console.warn('Erro ao geocodificar município:', error)
  }

  return null
}

