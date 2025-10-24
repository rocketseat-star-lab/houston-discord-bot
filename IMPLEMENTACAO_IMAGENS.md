# Implementação de Suporte a Imagens no Bot Houston

## Resumo das Mudanças

Foi adicionado suporte para envio de imagens via URL nos endpoints de agendamento e envio de mensagens do Discord.

## Mudanças Implementadas

### 1. Schema do Banco de Dados (Prisma)

Adicionado novo campo opcional `imageUrl` na tabela `houston_bot_scheduled_messages`:

```prisma
model ScheduledMessage {
  // ... campos existentes
  imageUrl       String?       @map("image_url")
}
```

### 2. Migration SQL

Criada migration em: `prisma/migrations/20251024200000_add_image_url_to_scheduled_messages/migration.sql`

Para aplicar a migration no banco de dados:
```bash
npx prisma migrate deploy
```

### 3. Endpoints Atualizados

Todos os endpoints foram atualizados para aceitar o campo opcional `imageUrl`:

#### POST /api/v1/messages/scheduled
Criar mensagem agendada com imagem:
```json
{
  "channelId": "1234567890",
  "messageContent": "Confira esta imagem!",
  "scheduleTime": "2025-10-25T14:00:00Z",
  "title": "Título opcional",
  "imageUrl": "https://seusupabase.co/storage/v1/object/public/bucket/imagem.png"
}
```

#### PUT /api/v1/messages/scheduled/:id
Atualizar mensagem agendada (PENDING):
```json
{
  "messageContent": "Novo conteúdo",
  "imageUrl": "https://nova-url-imagem.png"
}
```

#### POST /api/v1/messages/send-now
Enviar mensagem imediata com imagem:
```json
{
  "channelId": "1234567890",
  "messageContent": "Mensagem com imagem agora!",
  "title": "Título",
  "imageUrl": "https://url-da-imagem.png"
}
```

#### PATCH /api/v1/messages/sent/:id
Editar mensagem já enviada (incluindo imagem):
```json
{
  "messageContent": "Conteúdo atualizado",
  "imageUrl": "https://nova-imagem.png"
}
```

Para remover uma imagem existente, envie `imageUrl` como `null` ou string vazia.

## Como Funciona

### Envio com Imagem

Quando uma `imageUrl` é fornecida, o bot cria um **Embed do Discord** com a imagem:

```typescript
const embed = new EmbedBuilder().setImage(imageUrl);
await channel.send({
  content: messageContent,
  embeds: [embed]
});
```

### Mensagens Agendadas

O scheduler verifica mensagens pendentes a cada minuto e envia automaticamente com a imagem, se configurada.

## Formato da URL da Imagem

A URL deve ser:
- ✅ Pública e acessível via HTTPS
- ✅ Link direto para arquivo de imagem (PNG, JPG, GIF, etc.)
- ✅ Exemplo Supabase: `https://xxxxx.supabase.co/storage/v1/object/public/bucket-name/image.png`

## Exemplo de Integração com a Outra API

```javascript
// Na API externa, após fazer upload da imagem no Supabase:

const { data: uploadData } = await supabase.storage
  .from('imagens-bot')
  .upload('caminho/imagem.png', file);

// Obter URL pública
const { data: urlData } = supabase.storage
  .from('imagens-bot')
  .getPublicUrl('caminho/imagem.png');

const imageUrl = urlData.publicUrl;

// Enviar para a API do Houston Bot
await fetch('https://api-houston-bot/api/v1/messages/scheduled', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'sua-api-key'
  },
  body: JSON.stringify({
    channelId: '1234567890',
    messageContent: 'Confira a imagem!',
    scheduleTime: '2025-10-25T14:00:00Z',
    imageUrl: imageUrl  // ← URL da imagem do Supabase
  })
});
```

## Arquivos Modificados

1. ✅ `prisma/schema.prisma` - Adicionado campo `imageUrl`
2. ✅ `src/api/controllers/messageController.ts` - Suporte a imagem em todos os endpoints
3. ✅ `src/scheduler/messageScheduler.ts` - Envio de imagens em mensagens agendadas
4. ✅ `prisma/migrations/20251024200000_add_image_url_to_scheduled_messages/migration.sql` - Migration SQL

## Próximos Passos

1. Aplicar a migration no banco de dados de produção:
   ```bash
   npx prisma migrate deploy
   ```

2. Testar o envio de imagens em desenvolvimento

3. Atualizar a documentação da API (se houver Swagger/OpenAPI)

4. Notificar a equipe da outra API sobre o novo campo `imageUrl`
