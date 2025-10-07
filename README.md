# Bot de Mensagens e IA da Rocketseat

Este projeto contém o código do bot do Discord que serve como um agente de IA e também expõe uma API para agendamento e envio de mensagens.

## Configuração do Ambiente.

1.  **Clone o repositório:**
    ```bash
    git clone <url-do-repositorio>
    cd rocketseat-bot
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as variáveis de ambiente:**
    Copie o arquivo `.env.example` para um novo arquivo chamado `.env` e preencha todas as variáveis necessárias, incluindo o `DATABASE_URL` do Supabase e o `DISCORD_BOT_TOKEN`.

4.  **Execute as migrações do banco de dados:**
    ```bash
    npx prisma migrate dev
    ```

5.  **Inicie o bot em modo de desenvolvimento:**
    ```bash
    npm run dev
    ```

---

## Referência da API

A URL base para a API é `http://localhost:3000` (ou a URL de produção).

### Autenticação

Todas as requisições para a API devem incluir um cabeçalho de autorização com a chave da API interna.

-   **Header**: `Authorization`
-   **Valor**: `ApiKey SUA_CHAVE_SECRETA_AQUI`

### Endpoints

#### Recurso: Webhooks

**1. Criar um novo webhook**

Cria um novo webhook em um canal de texto específico com um nome e avatar personalizados.

-   **Endpoint**: `POST /api/v1/webhooks`
-   **Corpo da Requisição (JSON)**:
    ```json
    {
      "channel_id": "123456789012345678",
      "user_profile": {
        "name": "Houston - Deploys",
        "avatar_url": "[https://site.com/avatar.png](https://site.com/avatar.png)"
      }
    }
    ```
-   **Exemplo de Resposta (201 Created)**:
    ```json
    {
      "webhookUrl": "[https://discord.com/api/webhooks/](https://discord.com/api/webhooks/)..."
    }
    ```

#### Recurso: Servidores (Guilds)

**1. Listar servidores e canais disponíveis**

Retorna uma lista de todos os servidores em que o bot está, junto com uma lista de seus canais de texto e de anúncio.

-   **Endpoint**: `GET /api/v1/guilds`
-   **Exemplo de Resposta (200 OK)**:
    ```json
    [
        {
            "id": "111111111111111111",
            "name": "Servidor da Rocketseat",
            "iconURL": "[https://cdn.discordapp.com/icons/](https://cdn.discordapp.com/icons/)...",
            "channels": [
                {
                    "id": "222222222222222222",
                    "name": "anuncios-gerais"
                }
            ]
        }
    ]
    ```

#### Recurso: Mensagens Agendadas

**1. Listar mensagens agendadas**

Retorna uma lista paginada de mensagens, com suporte a filtros avançados.

-   **Endpoint**: `GET /api/v1/messages/scheduled`
-   **Query Params (opcional)**:
    -   `page`: Número da página (padrão: `1`).
    -   `limit`: Itens por página (padrão: `20`).
    -   `status`: Filtra por status (`PENDING`, `SENT`, `ERROR_SENDING`, `ERROR_CHANNEL_NOT_FOUND`).
    -   `guildId`: Filtra por ID do servidor.
    -   `startDate`: Filtra mensagens agendadas a partir desta data (formato ISO 8601).
    -   `endDate`: Filtra mensagens agendadas até esta data (formato ISO 8601).
-   **Exemplo de Resposta (200 OK)**:
    ```json
    {
        "messages": [
            {
                "id": "1",
                "createdAt": "2025-07-30T20:15:00.000Z",
                "guildId": "111111111111111111",
                "channelId": "222222222222222222",
                "messageContent": "Lembrete da nossa daily amanhã às 09:00! 🚀",
                "scheduleTime": "2025-07-31T12:00:00.000Z",
                "status": "PENDING",
                "guildName": "Servidor da Rocketseat"
            }
        ],
        "total": 150
    }
    ```

**2. Criar (agendar) uma nova mensagem**

Agenda uma nova mensagem para ser enviada em uma data futura.

-   **Endpoint**: `POST /api/v1/messages/scheduled`
-   **Corpo da Requisição (JSON)**:
    ```json
    {
        "channelId": "222222222222222222",
        "messageContent": "Não se esqueçam de preencher o forms de feedback da semana!",
        "scheduleTime": "2025-08-01T21:00:00.000Z"
    }
    ```
-   **Exemplo de Resposta (201 Created)**: Retorna o objeto da mensagem criada.

**3. Atualizar uma mensagem agendada**

Altera os detalhes de uma mensagem que ainda está pendente.

-   **Endpoint**: `PUT /api/v1/messages/scheduled/:id`
-   **Corpo da Requisição (JSON, envie apenas os campos a serem alterados)**:
    ```json
    {
        "messageContent": "Lembrete da nossa daily amanhã às 09:30!",
        "scheduleTime": "2025-07-31T12:30:00.000Z"
    }
    ```
-   **Exemplo de Resposta (200 OK)**: Retorna o objeto completo da mensagem atualizada.

**4. Deletar uma mensagem agendada**

Remove uma mensagem agendada.

-   **Endpoint**: `DELETE /api/v1/messages/scheduled/:id`
-   **Exemplo de Resposta (204 No Content)**: Resposta vazia, indicando sucesso.

#### Recurso: Ações Imediatas

**1. Enviar uma mensagem imediatamente**

Envia uma mensagem para um canal sem agendamento.

-   **Endpoint**: `POST /api/v1/messages/send-now`
-   **Corpo da Requisição (JSON)**:
    ```json
    {
        "channelId": "222222222222222222",
        "messageContent": "Aviso importante: A plataforma ficará instável nos próximos 15 minutos."
    }
    ```
-   **Exemplo de Resposta (200 OK)**:
    ```json
    {
        "success": true,
        "message": "Mensagem enviada com sucesso."
    }
    ```
