import express from 'express'
import { syncLicitacoesDiaAnterior } from '../services/syncService.js'
import { getSyncHistory, getSyncStatus } from '../services/syncService.js'

const router = express.Router()

/**
 * @swagger
 * /api/sync/manual:
 *   post:
 *     summary: Executa sincronização manual de licitações
 *     description: Busca editais do dia anterior na API do PNCP e salva no banco
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Sincronização executada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalEncontrado:
 *                       type: number
 *                     totalSalvo:
 *                       type: number
 *                     alertasVerificados:
 *                       type: number
 *                     notificacoesEnviadas:
 *                       type: number
 *       500:
 *         description: Erro na sincronização
 */
router.post('/manual', async (req, res) => {
  try {
    console.log('🔄 [API] Sincronização manual iniciada...')
    
    const resultado = await syncLicitacoesDiaAnterior()
    
    res.json({
      success: true,
      message: 'Sincronização executada com sucesso',
      data: resultado,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ [API] Erro na sincronização manual:', error)
    res.status(500).json({
      success: false,
      message: 'Erro ao executar sincronização',
      error: error.message
    })
  }
})

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     summary: Retorna status da última sincronização
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Status da sincronização
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getSyncStatus()
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status',
      error: error.message
    })
  }
})

/**
 * @swagger
 * /api/sync/history:
 *   get:
 *     summary: Retorna histórico de sincronizações
 *     tags: [Sync]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Número de registros a retornar
 *     responses:
 *       200:
 *         description: Histórico de sincronizações
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const history = await getSyncHistory(limit)
    res.json({
      success: true,
      data: history
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico',
      error: error.message
    })
  }
})

export { router as syncRoutes }

