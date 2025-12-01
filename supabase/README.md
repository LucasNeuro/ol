# Schema do Banco de Dados - Sistema Licitação

Este diretório contém o schema SQL para criar todas as tabelas necessárias no Supabase.

## Como Usar

1. Acesse o painel do Supabase
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo de `schema.sql`
4. Execute o script

## Tabelas Criadas

### profiles
Armazena informações adicionais dos usuários (CNPJ, razão social, cargo).

### licitacoes
Tabela principal que armazena todas as licitações/contratações do PNCP.

### licitacao_itens
Itens específicos de cada licitação.

### licitacao_documentos
Documentos e anexos relacionados às licitações.

### licitacao_resultados
Resultados das licitações (fornecedores homologados).

### licitacao_imagens
Imagens dos itens das licitações.

### alertas_usuario
Configurações de alertas personalizados por usuário.

### licitacoes_favoritas
Licitações marcadas como favoritas pelos usuários.

## Row Level Security (RLS)

O schema inclui políticas RLS:
- **Públicas**: licitacoes, licitacao_itens, licitacao_documentos, etc. (qualquer um pode ler)
- **Privadas**: alertas_usuario, licitacoes_favoritas (apenas o dono pode acessar)

## Índices

O schema cria índices otimizados para:
- Busca por número de controle PNCP
- Busca por data de publicação
- Busca por CNPJ do órgão
- Busca por UF
- Busca por modalidade


