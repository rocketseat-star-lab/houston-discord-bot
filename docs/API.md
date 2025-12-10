# Houston Discord Bot - Documentacao da API

## Sumario

1. [Autenticacao](#autenticacao)
2. [Health Check](#health-check)
3. [Guilds (Servidores)](#guilds-servidores)
4. [Forum Threads](#forum-threads)
5. [Direct Messages (DM)](#direct-messages-dm)
6. [Mensagens Agendadas](#mensagens-agendadas)
7. [Webhooks](#webhooks)
8. [Codigos de Erro](#codigos-de-erro)

---

## Autenticacao

Todas as rotas (exceto health check) requerem autenticacao via header `Authorization`.

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

**Erro de autenticacao (403):**
```json
{
  "error": "Acesso proibido: chave de API invalida."
}
```

---

## Health Check

### GET `/api/v1/health`

Verifica o status da aplicacao, conexao com Discord e banco de dados.

**Autenticacao:** Nao requerida

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

**Autenticacao:** Nao requerida

**Response (200):**
```json
{
  "status": "API esta online"
}
```

### GET `/healthcheck` (Legado)

**Autenticacao:** Nao requerida

**Response (200):**
```json
{
  "status": "ok"
}
```

---

## Guilds (Servidores)

### GET `/api/v1/guilds`

Lista todos os servidores onde o bot esta presente, incluindo todos os canais de cada servidor.

**Autenticacao:** Requerida

**Response (200):**
```json
[
  {
    "id": "327861810768117763",
    "name": "Rocketseat",
    "iconURL": "https://cdn.discordapp.com/icons/327861810768117763/abc123.png",
    "channels": [
      {
        "id": "1181004381261398188",
        "name": "vagas",
        "type": 15,
        "typeName": "GuildForum"
      },
      {
        "id": "327861810768117764",
        "name": "geral",
        "type": 0,
        "typeName": "GuildText"
      },
      {
        "id": "327861810768117765",
        "name": "anuncios",
        "type": 5,
        "typeName": "GuildAnnouncement"
      }
    ]
  }
]
```

**Tipos de canal:**
| type | typeName | Descricao |
|------|----------|-----------|
| 0 | GuildText | Canal de texto |
| 2 | GuildVoice | Canal de voz |
| 4 | GuildCategory | Categoria |
| 5 | GuildAnnouncement | Canal de anuncios |
| 15 | GuildForum | Canal de forum |

**Erros:**
| Status | Descricao |
|--------|-----------|
| 503 | Cliente Discord nao disponivel |
| 500 | Erro interno do servidor |

---

### GET `/api/v1/guilds/:guildId/forum-channels`

Lista apenas os canais de forum de um servidor especifico.

**Autenticacao:** Requerida

**Parametros de URL:**
| Parametro | Tipo | Descricao |
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
      "type": 15,
      "typeName": "GuildForum"
    }
  ]
}
```

> **Nota:** Este endpoint retorna apenas canais do tipo forum (type: 15).

**Erros:**
| Status | Descricao |
|--------|-----------|
| 404 | Servidor nao encontrado |
| 503 | Cliente Discord nao disponivel |
| 500 | Erro interno do servidor |

---

## Forum Threads

### POST `/api/v1/forum-threads`

Cria uma nova thread em um canal de forum.

**Autenticacao:** Requerida

**Request Body:**
```json
{
  "channelId": "1181004381261398188",
  "threadName": "Vaga: Desenvolvedor Full Stack - Empresa XYZ",
  "messageContent": "Descricao completa da vaga...",
  "mentionUserId": "987654321098765432"
}
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| channelId | string | Sim | ID do canal de forum |
| threadName | string | Sim | Titulo da thread |
| messageContent | string | Sim | Conteudo da mensagem inicial |
| mentionUserId | string | Nao | ID do usuario a ser mencionado |

**Response (201):**
```json
{
  "success": true,
  "threadId": "1234567890123456789",
  "messageId": "1234567890123456790",
  "messageUrl": "https://discord.com/channels/327861810768117763/1234567890123456789/1234567890123456790"
}
```

**Erros:**
| Status | Response | Descricao |
|--------|----------|-----------|
| 400 | `{ "error": "...", "code": "MISSING_FIELDS" }` | Parametros obrigatorios faltando |
| 400 | `{ "error": "...", "code": "NOT_A_FORUM" }` | Canal nao e um forum |
| 404 | `{ "error": "...", "code": "CHANNEL_NOT_FOUND" }` | Canal nao encontrado |
| 503 | `{ "error": "...", "code": "CLIENT_NOT_READY" }` | Cliente Discord nao disponivel |
| 500 | `{ "error": "...", "code": "INTERNAL_ERROR" }` | Erro interno do servidor |

> **Nota:** Os embeds de links sao automaticamente suprimidos na mensagem inicial.

---

### POST `/api/v1/forum-threads/:threadId/close`

Fecha uma thread de forum (vaga de emprego).

**Acoes realizadas:**
1. Envia mensagem de fechamento na thread (se fornecida)
2. Renomeia a thread adicionando prefixo `[FECHADA]` ao titulo
3. Arquiva a thread (archived: true)
4. Tranca a thread (locked: true)

**Autenticacao:** Requerida

**Parametros de URL:**
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| threadId | string | ID da thread a ser fechada |

**Request Body:**
```json
{
  "title": "Desenvolvedor Full Stack - TechCorp",
  "closingMessage": "Esta vaga foi encerrada pelo autor e nao esta mais aceitando candidatos."
}
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| title | string | Nao | Titulo para renomear (se nao fornecido, usa o titulo atual) |
| closingMessage | string | Nao | Mensagem enviada antes de fechar |

**Exemplo:**
```
POST /api/v1/forum-threads/1234567890123456789/close
```

**Response (200):**
```json
{
  "success": true,
  "threadId": "1234567890123456789"
}
```

**Erros:**
| Status | Response | Descricao |
|--------|----------|-----------|
| 400 | `{ "error": "...", "code": "NOT_A_THREAD" }` | Canal nao e uma thread |
| 404 | `{ "error": "...", "code": "THREAD_NOT_FOUND" }` | Thread nao encontrada |
| 503 | `{ "error": "...", "code": "CLIENT_NOT_READY" }` | Cliente Discord nao disponivel |
| 500 | `{ "error": "...", "code": "INTERNAL_ERROR" }` | Erro interno do servidor |

---

## Direct Messages (DM)

### POST `/api/v1/dm`

Envia uma mensagem direta (DM) para um usuario do Discord.

**Autenticacao:** Requerida

**Request Body:**
```json
{
  "userId": "987654321098765432",
  "content": "Ola! Sua vaga foi publicada com sucesso no servidor."
}
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| userId | string | Sim | ID do usuario Discord |
| content | string | Sim | Conteudo da mensagem |

**Response (200):**
```json
{
  "success": true,
  "messageId": "1234567890123456789"
}
```

**Erros:**
| Status | Descricao |
|--------|-----------|
| 400 | Parametros obrigatorios faltando |
| 403 | Usuario tem DMs desabilitadas |
| 404 | Usuario nao encontrado |
| 503 | Cliente Discord nao disponivel |
| 500 | Erro interno do servidor |

**Erro 403 (DMs bloqueadas):**
```json
{
  "error": "Nao foi possivel enviar a mensagem. O usuario pode ter DMs desabilitadas."
}
```

---

## Mensagens Agendadas

### POST `/api/v1/messages/scheduled`

Cria uma nova mensagem agendada.

**Autenticacao:** Requerida

**Request Body:**
```json
{
  "channelId": "1234567890123456789",
  "messageContent": "Conteudo da mensagem a ser enviada",
  "scheduleTime": "2024-12-25T10:00:00.000Z",
  "title": "Titulo opcional",
  "imageUrl": "https://exemplo.com/imagem.png"
}
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| channelId | string | Sim | ID do canal de texto |
| messageContent | string | Sim | Conteudo da mensagem |
| scheduleTime | string (ISO 8601) | Sim | Data/hora do envio |
| title | string | Nao | Titulo (max. 30 caracteres) |
| imageUrl | string | Nao | URL de imagem para embed |

**Response (201):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Conteudo da mensagem",
  "scheduleTime": "2024-12-25T10:00:00.000Z",
  "title": "Titulo opcional",
  "imageUrl": "https://exemplo.com/imagem.png",
  "status": "PENDING",
  "messageUrl": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Erros:**
| Status | Descricao |
|--------|-----------|
| 400 | Dados ausentes, titulo > 30 chars, ou data invalida |
| 404 | Canal nao encontrado |
| 500 | Erro interno do servidor |

---

### GET `/api/v1/messages/scheduled`

Lista mensagens agendadas com paginacao e filtros.

**Autenticacao:** Requerida

**Query Parameters:**
| Parametro | Tipo | Padrao | Descricao |
|-----------|------|--------|-----------|
| page | number | 1 | Pagina atual |
| limit | number | 20 | Itens por pagina |
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
      "messageContent": "Conteudo da mensagem",
      "scheduleTime": "2024-12-25T10:00:00.000Z",
      "title": "Titulo",
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

**Autenticacao:** Requerida

**Parametros de URL:**
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| id | number | ID da mensagem agendada |

**Request Body (todos opcionais):**
```json
{
  "channelId": "1234567890123456789",
  "messageContent": "Novo conteudo",
  "scheduleTime": "2024-12-26T10:00:00.000Z",
  "title": "Novo titulo",
  "imageUrl": "https://exemplo.com/nova-imagem.png"
}
```

**Response (200):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Novo conteudo",
  "scheduleTime": "2024-12-26T10:00:00.000Z",
  "title": "Novo titulo",
  "imageUrl": "https://exemplo.com/nova-imagem.png",
  "status": "PENDING",
  "messageUrl": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

**Erros:**
| Status | Descricao |
|--------|-----------|
| 400 | ID invalido, titulo > 30 chars, data no passado, ou nenhum dado fornecido |
| 404 | Mensagem pendente nao encontrada |
| 500 | Erro interno do servidor |

> **Nota:** Apenas mensagens com status `PENDING` podem ser editadas.

---

### DELETE `/api/v1/messages/scheduled/:id`

Deleta uma mensagem agendada.

**Autenticacao:** Requerida

**Parametros de URL:**
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| id | number | ID da mensagem agendada |

**Response (204):** Sem conteudo

**Erros:**
| Status | Descricao |
|--------|-----------|
| 400 | ID invalido |
| 404 | Mensagem nao encontrada |
| 500 | Erro interno do servidor |

---

### POST `/api/v1/messages/send-now`

Envia uma mensagem imediatamente para um canal.

**Autenticacao:** Requerida

**Request Body:**
```json
{
  "channelId": "1234567890123456789",
  "messageContent": "Conteudo da mensagem",
  "title": "Titulo opcional",
  "imageUrl": "https://exemplo.com/imagem.png"
}
```

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| channelId | string | Sim | ID do canal de texto |
| messageContent | string | Sim | Conteudo da mensagem |
| title | string | Nao | Titulo (max. 30 caracteres) |
| imageUrl | string | Nao | URL de imagem para embed |

**Response (201):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Conteudo da mensagem",
  "scheduleTime": "2024-01-15T10:30:00.000Z",
  "title": "Titulo",
  "imageUrl": "https://exemplo.com/imagem.png",
  "status": "SENT",
  "messageUrl": "https://discord.com/channels/327861810768117763/1234567890123456789/9876543210987654321",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### PATCH `/api/v1/messages/sent/:id`

Edita uma mensagem ja enviada no Discord.

**Autenticacao:** Requerida

**Parametros de URL:**
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| id | number | ID do registro da mensagem |

**Request Body (pelo menos um campo):**
```json
{
  "messageContent": "Conteudo atualizado",
  "title": "Novo titulo",
  "imageUrl": "https://exemplo.com/nova-imagem.png"
}
```

**Response (200):**
```json
{
  "id": 1,
  "guildId": "327861810768117763",
  "channelId": "1234567890123456789",
  "messageContent": "Conteudo atualizado",
  "scheduleTime": "2024-01-15T10:30:00.000Z",
  "title": "Novo titulo",
  "imageUrl": "https://exemplo.com/nova-imagem.png",
  "status": "SENT",
  "messageUrl": "https://discord.com/channels/...",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

**Erros:**
| Status | Descricao |
|--------|-----------|
| 400 | ID invalido, titulo > 30 chars, nenhum dado fornecido, ou mensagem ainda pendente |
| 404 | Registro ou canal nao encontrado |
| 500 | Erro interno do servidor |

> **Nota:** Nao pode ser usado para mensagens com status `PENDING`. Use `PUT /api/v1/messages/scheduled/:id`.

---

### DELETE `/api/v1/messages/sent/:id`

Deleta uma mensagem enviada do Discord e do banco de dados.

**Autenticacao:** Requerida

**Parametros de URL:**
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| id | number | ID do registro da mensagem |

**Response (204):** Sem conteudo

**Erros:**
| Status | Descricao |
|--------|-----------|
| 400 | ID invalido |
| 404 | Registro nao encontrado |
| 500 | Erro interno do servidor |

> **Nota:** Se a mensagem ja foi deletada do Discord, apenas o registro do banco e removido.

---

## Webhooks

### POST `/api/v1/webhooks`

Cria um novo webhook em um canal de texto.

**Autenticacao:** Requerida

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

| Campo | Tipo | Obrigatorio | Descricao |
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
| Status | Descricao |
|--------|-----------|
| 400 | Payload incompleto ou canal invalido |
| 500 | Erro ao criar webhook (falta de permissao ou URL de avatar invalida) |

---

## Codigos de Erro

### Respostas de Erro Padrao

```json
{
  "error": "Descricao do erro",
  "code": "ERROR_CODE"
}
```

### Tabela de Codigos HTTP

| Codigo | Significado |
|--------|-------------|
| 200 | Sucesso |
| 201 | Recurso criado com sucesso |
| 204 | Sucesso sem conteudo (delecao) |
| 400 | Requisicao invalida (parametros faltando ou invalidos) |
| 403 | Acesso negado (API key invalida ou acao bloqueada) |
| 404 | Recurso nao encontrado |
| 500 | Erro interno do servidor |
| 503 | Servico indisponivel (Discord desconectado) |

### Codigos de Erro (code)

| Code | Descricao |
|------|-----------|
| CLIENT_NOT_READY | Cliente Discord nao esta pronto |
| MISSING_FIELDS | Campos obrigatorios faltando |
| CHANNEL_NOT_FOUND | Canal nao encontrado |
| NOT_A_FORUM | Canal nao e um forum |
| THREAD_NOT_FOUND | Thread nao encontrada |
| NOT_A_THREAD | Canal nao e uma thread |
| INTERNAL_ERROR | Erro interno do servidor |

---

## Resumo das Rotas

| Metodo | Endpoint | Auth | Descricao |
|--------|----------|------|-----------|
| GET | `/api/v1/health` | Nao | Health check completo |
| GET | `/status` | Nao | Status simples (legado) |
| GET | `/healthcheck` | Nao | Health check simples (legado) |
| GET | `/api/v1/guilds` | Sim | Lista servidores com todos os canais |
| GET | `/api/v1/guilds/:guildId/forum-channels` | Sim | Lista apenas canais de forum |
| POST | `/api/v1/forum-threads` | Sim | Cria thread no forum |
| POST | `/api/v1/forum-threads/:threadId/close` | Sim | Fecha thread |
| POST | `/api/v1/dm` | Sim | Envia DM |
| GET | `/api/v1/messages/scheduled` | Sim | Lista mensagens agendadas |
| POST | `/api/v1/messages/scheduled` | Sim | Cria agendamento |
| PUT | `/api/v1/messages/scheduled/:id` | Sim | Atualiza agendamento |
| DELETE | `/api/v1/messages/scheduled/:id` | Sim | Deleta agendamento |
| POST | `/api/v1/messages/send-now` | Sim | Envia mensagem imediata |
| PATCH | `/api/v1/messages/sent/:id` | Sim | Edita mensagem enviada |
| DELETE | `/api/v1/messages/sent/:id` | Sim | Deleta mensagem enviada |
| POST | `/api/v1/webhooks` | Sim | Cria webhook |
