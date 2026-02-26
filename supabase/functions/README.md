# Edge Functions – Sistema Licitação

Cada pasta aqui é uma **Edge Function** deployada no Supabase.  
A pasta deve ter o mesmo nome da função na URL: `/functions/v1/<nome-da-pasta>`.

---

## Por tema

### Alertas (e-mail + WhatsApp)
| Função | Descrição |
|--------|-----------|
| **alerta-diario** | Principal. Chamada pelo cron a cada 5 min. Envia e-mail e, se `enviar_whatsapp=true`, também WhatsApp. |
| alerta-email-diario | Apenas e-mail (legado; o cron usa `alerta-diario`). |
| alerta-whatsapp-diario | Apenas WhatsApp por horário (legado; o cron usa `alerta-diario`). |
| alerta-email-webhook | Webhook para eventos de e-mail (Resend, etc.). |
| alerta-lembrete-prazo-favoritos | Lembrete de prazo para licitações favoritas. |
| processar-fila-alertas | Processamento em fila de alertas. |
| verificar-alertas-periodicos | Verificação de alertas periódicos. |

### WhatsApp (UAZAPI)
| Função | Descrição |
|--------|-----------|
| **enviar-whatsapp-uazapi** | Envia mensagem/card com botões para um número. |
| **whatsapp-webhook-uazapi** | Webhook UAZAPI: cliques em botões e envio de documentos. |
| webhook-whatsapp | Webhook genérico WhatsApp. |
| recuperar-senha-whatsapp | Fluxo de recuperação de senha via WhatsApp. |

### Documentos
| Função | Descrição |
|--------|-----------|
| processar-documento | Processamento de documento (extração, etc.). |
| baixar-documentos-zip | Gera e disponibiliza ZIP de documentos. |
| descompactar-zip | Descompacta ZIP no storage. |

### E-mail e notificações
| Função | Descrição |
|--------|-----------|
| enviar-email-recuperacao | E-mail de recuperação de senha. |
| enviar-feedback | Envio de feedback por e-mail. |
| enviar-alerta-webhook | Disparo de alerta para webhook externo. |

### IA e busca
| Função | Descrição |
|--------|-----------|
| filtrar-licitacoes-ia | Filtro semântico de licitações (IA). |
| validar-correspondencia-ia | Validação de correspondência (IA). |
| tavily-search | Busca externa (Tavily). |

### Chat e usuário
| Função | Descrição |
|--------|-----------|
| chat-documento | Chat sobre documento (IA). |
| create-user | Criação de usuário (trigger/auth). |
| login | Fluxo de login customizado. |

### Outros
| Função | Descrição |
|--------|-----------|
| resumo-semanal | Geração/envio de resumo semanal. |

---

## Deploy manual

No Dashboard: **Edge Functions → [nome da função] → Code** → colar o conteúdo de `supabase/functions/<nome-da-pasta>/index.ts` e fazer deploy.

Ou com CLI (quando configurada):

```bash
supabase functions deploy alerta-diario
supabase functions deploy enviar-whatsapp-uazapi
# etc.
```

---

## Secrets necessárias (Settings → Edge Functions → Secrets)

- `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` – alertas por e-mail  
- `UAZAPI_TOKEN`, `UAZAPI_BASE_URL`, `UAZAPI_INSTANCE_ID` – WhatsApp
