import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import path from 'path'
import { fileURLToPath } from 'url'
import { syncRoutes } from './routes/sync.js'
import { startScheduler } from './scheduler/index.js'

// Carregar variáveis de ambiente do arquivo .env na pasta server
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Verificar se as variáveis foram carregadas
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas!')
  console.error('   Verifique se o arquivo server/.env existe e contém:')
  console.error('   - VITE_SUPABASE_URL')
  console.error('   - VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

console.log('✅ Variáveis de ambiente carregadas com sucesso!')

const app = express()
const PORT = process.env.SERVER_PORT || 3001

// Middlewares
app.use(cors())
app.use(express.json())

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sistema Licitação API',
      version: '1.0.0',
      description: 'API para sincronização de licitações do PNCP',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de desenvolvimento',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

// Routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use('/api/sync', syncRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
  console.log(`📚 Swagger UI disponível em http://localhost:${PORT}/api-docs`)
  
  // Iniciar scheduler
  startScheduler()
  console.log(`⏰ Scheduler iniciado (executa às 23:00 horário de Brasília)`)
})

