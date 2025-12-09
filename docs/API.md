# Houston Discord Bot - Documentação da API

## Sumário

1. [Autenticação](#autenticação)
2. [Health Check](#health-check)
3. [Guilds (Servidores)](#guilds-servidores)
4. [Forum Threads](#forum-threads)
5. [Direct Messages (DM)](#direct-messages-dm)
6. [Mensagens Agendadas](#mensagens-agendadas)
7. [Webhooks](#webhooks)
8. [Códigos de Erro](#códigos-de-erro)

---

## Autenticação

Todas as rotas (exceto health check) requerem autenticação via header `Authorization`.

**Header:**
```
Authorization: ApiKey <INTERNAL_API_KEY>
Content-Type: application/json
```

**Exemplo:**
```bash
curl -X GET "https://api.exemplo.com/api/v1/guilds" \
  -H "Authorization: ApiKey sua_chave_aqui" \
  -H "Content-Type: application/json"
```

**Erro de autenticação (403):**
```json
{
  "error": "Acesso proibido: chave de API inválida."
}
```

---

## Health Check

### GET `/api/v1/health`

Verifica o status da aplicação, conexão com Discord e banco de dados.

**Autenticação:** Não requerida

**Response (200 - Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": {
    "seconds": 86400,
    "formatted": "1d 0h 0m 0s"
  },
  "services": {
    "discord": {
      "status": "connected",
      "guilds": 5,
      "ping": 45
    },
    "database": {
      "status": "connected"
    }
  },
  "version": "1.0.0",
  "environment": "production"
}
```

**Response (503 - Unhealthy):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "error": "Failed to check health status"
}
```

### GET `/status` (Legado)

**Autenticação:** Não requerida

**Response (200):**
```json
{
  "status": "API está online"
}
```

### GET `/healthcheck` (Legado)

**Autenticação:** Não requerida

**Response (200):**
```json
{
  "status": "ok"
}
```

---

## Guilds (Servidores)

### GET `/api/v1/guilds`

Lista todos os servidores onde o bot está presente.

**Autenticação:** Requerida

**Response (200):**
```json
[
  {
    "id": "327861810768117763",
    "name": "Rocketseat",
    "iconURL": "https://cdn.discordapp.com/icons/327861810768117763/abc123.png"
  },
  {
    "id": "123456789012345678",
    "name": "Outro Servidor",
    "iconURL": null
  }
]
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 503 | Cliente Discord não disponível |
| 500 | Erro interno do servidor |

---

### GET `/api/v1/guilds/:guildId/forum-channels`

Lista todos os canais de fórum de um servidor específico.

**Autenticação:** Requerida

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| guildId | string | ID do servidor Discord |

**Exemplo:**
```
GET /api/v1/guilds/327861810768117763/forum-channels
```

**Response (200):**
```json
{
  "channels": [
    {
      "id": "1181004381261398188",
      "name": "vagas",
      "type": 15
    },
    {
      "id": "1234567890123456789",
      "name": "duvidas",
      "type": 15
    }
  ]
}
```

> **Nota:** `type: 15` representa um canal de fórum no Discord.

**Erros:**
| Status | Descrição |
|--------|-----------|
| 404 | Servidor não encontrado |
| 503 | Cliente Discord não disponível |
| 500 | Erro interno do servidor |

---

## Forum Threads

### POST `/api/v1/forum-threads`

Cria uma nova thread em um canal de fórum.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "channelId": "1181004381261398188",
  "threadName": "Vaga: Desenvolvedor Full Stack - Empresa XYZ",
  "messageContent": "Descrição completa da vaga...",
  "mentionUserId": "987654321098765432"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| channelId | string | Sim | ID do canal de fórum |
| threadName | string | Sim | Título da thread |
| messageContent | string | Sim | Conteúdo da mensagem inicial |
| mentionUserId | string | Não | ID do usuário a ser mencionado |

**Response (201):**
```json
{
  "threadId": "1234567890123456789",
  "messageId": "1234567890123456790",
  "messageUrl": "https://discord.com/channels/327861810768117763/1234567890123456789/1234567890123456790"
}
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | Parâmetros obrigatórios faltando ou canal não é fórum |
| 404 | Canal não encontrado |
| 503 | Cliente Discord não disponível |
| 500 | Erro interno do servidor |

---

### POST `/api/v1/forum-threads/:threadId/close`

Fecha uma thread de fórum (vaga de emprego).

**Ações realizadas:**
1. Envia mensagem de fechamento na thread
2. Renomeia a thread adicionando prefixo "✅ " ao título
3. Tranca a thread (lock) para impedir novas mensagens

**Autenticação:** Requerida

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| threadId | string | ID da thread a ser fechada |

**Request Body:**
```json
{
  "title": "Desenvolvedor Full Stack - TechCorp",
  "closingMessage": "🔒 Esta vaga foi encerrada pelo autor e não está mais aceitando candidatos."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| title | string | Não | Título para renomear (se não fornecido, usa o título atual) |
| closingMessage | string | Não | Mensagem enviada antes de fechar |

**Exemplo:**
```
POST /api/v1/forum-threads/1234567890123456789/close
```

**Response (200):**
```json
{
  "success": true,
  "threadId": "1234567890123456789",
  "locked": true,
  "newTitle": "✅ Desenvolvedor Full Stack - TechCorp"
}
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | Canal especificado não é uma thread |
| 404 | Thread não encontrada |
| 503 | Cliente Discord não disponível |
| 500 | Erro interno do servidor |

---

## Direct Messages (DM)

### POST `/api/v1/dm`

Envia uma mensagem direta (DM) para um usuário do Discord.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "userId": "987654321098765432",
  "content": "Olá! Sua vaga foi publicada com sucesso no servidor."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| userId | string | Sim | ID do usuário Discord |
| content | string | Sim | Conteúdo da mensagem |

**Response (200):**
```json
{
  "success": true,
  "messageId": "1234567890123456789"
}
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | Parâmetros obrigatórios faltando |
| 403 | Usuário tem DMs desabilitadas |
| 404 | Usuário não encontrado |
| 503 | Cliente Discord não disponível |
| 500 | Erro interno do servidor |

**Erro 403 (DMs bloqueadas):**
```json
{
  "error": "Não foi possível enviar a mensagem. O usuário pode ter DMs desabilitadas."
}
```

---

## Mensagens Agendadas

### POST `/api/v1/messages/scheduled`

Cria uma nova mensagem agendada.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "channelId": "1234567890123456789",
  "messageContent": "Conteúdo da mensagem a ser enviada",
  "scheduleTime": "2024-12-25T10:00:00.000Z",
  "title": "Título opcional",
  "imageUrl": "https://exemplo.com/imagem.png"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| channelId | string | Sim | ID do canal de texto |
| messageContent | string | Sim | Conteúdo da mensagem |
| scheduleTime | string (ISO 8601) | Sim | Data/hora do envio |
| title | string | Não | Título (máx. 30 caracteres) |
| imageUrl | string | Não | URL de imagem para embed |

**Response (201):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Conteúdo da mensagem",
  "scheduleTime": "2024-12-25T10:00:00.000Z",
  "title": "Título opcional",
  "imageUrl": "https://exemplo.com/imagem.png",
  "status": "PENDING",
  "messageUrl": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | Dados ausentes, título > 30 chars, ou data inválida |
| 404 | Canal não encontrado |
| 500 | Erro interno do servidor |

---

### GET `/api/v1/messages/scheduled`

Lista mensagens agendadas com paginação e filtros.

**Autenticação:** Requerida

**Query Parameters:**
| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| page | number | 1 | Página atual |
| limit | number | 20 | Itens por página |
| status | string | - | Filtro: PENDING, SENT, ERROR_SENDING, ERROR_CHANNEL_NOT_FOUND |
| guildId | string | - | Filtro por servidor |
| startDate | string | - | Data inicial (ISO 8601) |
| endDate | string | - | Data final (ISO 8601) |

**Exemplo:**
```
GET /api/v1/messages/scheduled?page=1&limit=10&status=PENDING&guildId=327861810768117763
```

**Response (200):**
```json
{
  "messages": [
    {
      "id": 1,
      "guildId": "327861810768117763",
      "guildName": "Rocketseat",
      "channelId": "1234567890123456789",
      "messageContent": "Conteúdo da mensagem",
      "scheduleTime": "2024-12-25T10:00:00.000Z",
      "title": "Título",
      "imageUrl": null,
      "status": "PENDING",
      "messageUrl": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 50
}
```

---

### PUT `/api/v1/messages/scheduled/:id`

Atualiza uma mensagem agendada pendente.

**Autenticação:** Requerida

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | number | ID da mensagem agendada |

**Request Body (todos opcionais):**
```json
{
  "channelId": "1234567890123456789",
  "messageContent": "Novo conteúdo",
  "scheduleTime": "2024-12-26T10:00:00.000Z",
  "title": "Novo título",
  "imageUrl": "https://exemplo.com/nova-imagem.png"
}
```

**Response (200):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Novo conteúdo",
  "scheduleTime": "2024-12-26T10:00:00.000Z",
  "title": "Novo título",
  "imageUrl": "https://exemplo.com/nova-imagem.png",
  "status": "PENDING",
  "messageUrl": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | ID inválido, título > 30 chars, data no passado, ou nenhum dado fornecido |
| 404 | Mensagem pendente não encontrada |
| 500 | Erro interno do servidor |

> **Nota:** Apenas mensagens com status `PENDING` podem ser editadas.

---

### DELETE `/api/v1/messages/scheduled/:id`

Deleta uma mensagem agendada.

**Autenticação:** Requerida

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | number | ID da mensagem agendada |

**Response (204):** Sem conteúdo

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | ID inválido |
| 404 | Mensagem não encontrada |
| 500 | Erro interno do servidor |

---

### POST `/api/v1/messages/send-now`

Envia uma mensagem imediatamente para um canal.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "channelId": "1234567890123456789",
  "messageContent": "Conteúdo da mensagem",
  "title": "Título opcional",
  "imageUrl": "https://exemplo.com/imagem.png"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| channelId | string | Sim | ID do canal de texto |
| messageContent | string | Sim | Conteúdo da mensagem |
| title | string | Não | Título (máx. 30 caracteres) |
| imageUrl | string | Não | URL de imagem para embed |

**Response (201):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Conteúdo da mensagem",
  "scheduleTime": "2024-01-15T10:30:00.000Z",
  "title": "Título",
  "imageUrl": "https://exemplo.com/imagem.png",
  "status": "SENT",
  "messageUrl": "https://discord.com/channels/327861810768117763/1234567890123456789/9876543210987654321",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### PATCH `/api/v1/messages/sent/:id`

Edita uma mensagem já enviada no Discord.

**Autenticação:** Requerida

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | number | ID do registro da mensagem |

**Request Body (pelo menos um campo):**
```json
{
  "messageContent": "Conteúdo atualizado",
  "title": "Novo título",
  "imageUrl": "https://exemplo.com/nova-imagem.png"
}
```

**Response (200):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Conteúdo atualizado",
  "scheduleTime": "2024-01-15T10:30:00.000Z",
  "title": "Novo título",
  "imageUrl": "https://exemplo.com/nova-imagem.png",
  "status": "SENT",
  "messageUrl": "https://discord.com/channels/...",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | ID inválido, título > 30 chars, nenhum dado fornecido, ou mensagem ainda pendente |
| 404 | Registro ou canal não encontrado |
| 500 | Erro interno do servidor |

> **Nota:** Não pode ser usado para mensagens com status `PENDING`. Use `PUT /api/v1/messages/scheduled/:id`.

---

### DELETE `/api/v1/messages/sent/:id`

Deleta uma mensagem enviada do Discord e do banco de dados.

**Autenticação:** Requerida

**Parâmetros de URL:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | number | ID do registro da mensagem |

**Response (204):** Sem conteúdo

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | ID inválido |
| 404 | Registro não encontrado |
| 500 | Erro interno do servidor |

> **Nota:** Se a mensagem já foi deletada do Discord, apenas o registro do banco é removido.

---

## Webhooks

### POST `/api/v1/webhooks`

Cria um novo webhook em um canal de texto.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "channel_id": "1234567890123456789",
  "user_profile": {
    "name": "Houston Bot",
    "avatar_url": "https://exemplo.com/avatar.png"
  }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| channel_id | string | Sim | ID do canal de texto |
| user_profile.name | string | Sim | Nome do webhook |
| user_profile.avatar_url | string | Sim | URL do avatar |

**Response (201):**
```json
{
  "webhookUrl": "https://discord.com/api/webhooks/1234567890/abcdefghijk..."
}
```

**Erros:**
| Status | Descrição |
|--------|-----------|
| 400 | Payload incompleto ou canal inválido |
| 500 | Erro ao criar webhook (falta de permissão ou URL de avatar inválida) |

---

## Códigos de Erro

### Respostas de Erro Padrão

```json
{
  "error": "Descrição do erro"
}
```

### Tabela de Códigos HTTP

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 201 | Recurso criado com sucesso |
| 204 | Sucesso sem conteúdo (deleção) |
| 400 | Requisição inválida (parâmetros faltando ou inválidos) |
| 403 | Acesso negado (API key inválida ou ação bloqueada) |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |
| 503 | Serviço indisponível (Discord desconectado) |

---

## Resumo das Rotas

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/api/v1/health` | ❌ | Health check completo |
| GET | `/status` | ❌ | Status simples (legado) |
| GET | `/healthcheck` | ❌ | Health check simples (legado) |
| GET | `/api/v1/guilds` | ✅ | Lista servidores |
| GET | `/api/v1/guilds/:guildId/forum-channels` | ✅ | Lista canais de fórum |
| POST | `/api/v1/forum-threads` | ✅ | Cria thread no fórum |
| POST | `/api/v1/forum-threads/:threadId/close` | ✅ | Fecha thread |
| POST | `/api/v1/dm` | ✅ | Envia DM |
| GET | `/api/v1/messages/scheduled` | ✅ | Lista mensagens agendadas |
| POST | `/api/v1/messages/scheduled` | ✅ | Cria agendamento |
| PUT | `/api/v1/messages/scheduled/:id` | ✅ | Atualiza agendamento |
| DELETE | `/api/v1/messages/scheduled/:id` | ✅ | Deleta agendamento |
| POST | `/api/v1/messages/send-now` | ✅ | Envia mensagem imediata |
| PATCH | `/api/v1/messages/sent/:id` | ✅ | Edita mensagem enviada |
| DELETE | `/api/v1/messages/sent/:id` | ✅ | Deleta mensagem enviada |
| POST | `/api/v1/webhooks` | ✅ | Cria webhook |
