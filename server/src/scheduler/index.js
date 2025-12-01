import cron from 'node-cron'
import { syncLicitacoesDiaAnterior } from '../services/syncService.js'

/**
 * Inicia o scheduler para executar sincronização às 23:00 (horário de Brasília)
 * 
 * Horário de Brasília: UTC-3 (ou UTC-2 no horário de verão)
 * 23:00 Brasília = 02:00 UTC (ou 01:00 UTC no horário de verão)
 * 
 * Usando 02:00 UTC para garantir que sempre será 23:00 em Brasília
 */
export function startScheduler() {
  console.log('⏰ [Scheduler] Configurando job agendado...')
  
  // Executar às 23:00 horário de Brasília (02:00 UTC)
  // Formato: segundo minuto hora dia mês dia-semana
  // '0 2 * * *' = Todo dia às 02:00 UTC (23:00 Brasília)
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ [Scheduler] Executando sincronização agendada...')
    console.log(`📅 [Scheduler] Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
    
    try {
      await syncLicitacoesDiaAnterior()
      console.log('✅ [Scheduler] Sincronização agendada concluída com sucesso!')
    } catch (error) {
      console.error('❌ [Scheduler] Erro na sincronização agendada:', error)
    }
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo' // Horário de Brasília
  })
  
  console.log('✅ [Scheduler] Job agendado configurado para executar diariamente às 23:00 (horário de Brasília)')
}

