# Mini-Backend - Sistema Licitação

Servidor Node.js para sincronização automática de licitações do PNCP.

## Funcionalidades

- 🔄 Sincronização automática diária (23:00 horário de Brasília)
- 🔧 Sincronização manual via API
- 📚 Swagger UI para documentação e testes
- 🔔 Verificação de alertas e notificações
- 📊 Histórico de execuções

## Configuração

1. **Instalar dependências:**
```bash
cd server
npm install
```

2. **Configurar variáveis de ambiente:**
Crie um arquivo `.env` na pasta `server/`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
SERVER_PORT=3001
```

3. **Executar:**
```bash
# Desenvolvimento (com watch)
npm run dev

# Produção
npm start

# Sincronização manual
npm run sync:manual
```

## Endpoints

### Swagger UI
- **URL:** http://localhost:3001/api-docs
- Documentação interativa da API

### API Endpoints

#### `POST /api/sync/manual`
Executa sincronização manual de licitações do dia anterior.

#### `GET /api/sync/status`
Retorna status da última sincronização.

#### `GET /api/sync/history?limit=10`
Retorna histórico de sincronizações.

#### `GET /api/health`
Health check do servidor.

## Scheduler

O scheduler executa automaticamente às **23:00 (horário de Brasília)** todos os dias:

1. Busca editais do dia anterior na API do PNCP
2. Salva no banco de dados (com itens e documentos)
3. Verifica alertas dos usuários
4. Envia notificações para matches encontrados

## Integração com Frontend

O frontend pode buscar dados diretamente do banco (rápido) ou chamar a API do backend para sincronização manual.

