# Feature Modules

*Ultima atualizacao: 2026-03-30*

## Visao Geral

O Houston e um bot Discord compartilhado por 3 times (moderacao, comunidade, produto). Para evitar que mudancas de um time quebrem funcionalidades de outro, usamos o padrao **Feature Modules**: cada dominio de negocio vive isolado em seu proprio modulo, com handlers, rotas, schedulers e ciclo de vida independentes.

O dispatcher central (`src/core/dispatcher.ts`) orquestra tudo. Nenhum modulo conhece ou depende de outro.

## Interface FeatureModule

Definida em `src/core/module.ts`:

```typescript
interface FeatureModule {
  name: string;            // Identificador unico (usado em logs e rotas API)
  description: string;     // Descricao curta do proposito

  handlers?: Record<string, (...args: any[]) => Promise<void>>;
  // Chave = nome do evento discord.js (ex: "messageCreate", "guildBanAdd")
  // Valor = handler async

  routes?: Router;
  // Sub-router Express, montado em /api/v1/<name>

  schedulers?: Array<{
    name: string;          // Nome do job (para logs)
    cron: string;          // Expressao cron (node-cron)
    timezone?: string;     // Timezone opcional
    handler: () => Promise<void>;
  }>;

  initialize?: (client: Client) => Promise<void>;
  // Executado uma vez apos o bot estar ready
  // Uso: carregar caches, limpar estado orfao, validar config

  shutdown?: () => Promise<void>;
  // Executado no graceful shutdown (SIGINT/SIGTERM)
  // Uso: fechar sessoes ativas, flush de buffers
}
```

## Como Funciona

### Event Dispatcher

O dispatcher cria **um unico listener** por evento Discord. Quando o evento dispara, todos os handlers interessados rodam via `Promise.allSettled`:

```
guildMemberAdd event
  -> Promise.allSettled([
       metrics.onMemberAdd(),
       // outros modulos que escutam o mesmo evento
     ])
```

Se um handler falha, os outros continuam normalmente. Erros sao logados com o nome do modulo.

### Rotas API

Cada modulo que exporta `routes` tem seu router montado em:

```
/api/v1/<module-name>/
```

Todas as rotas de modulo passam pelo middleware `apiKeyAuth`. Exemplos:
- `/api/v1/metrics/...`
- `/api/v1/moderation/...`
- `/api/v1/scheduler/...`

### Schedulers

Jobs cron declarados no array `schedulers` sao registrados automaticamente via `node-cron`. Cada job roda dentro de um try/catch -- falhas sao logadas mas nao derrubam o bot.

### Ciclo de Vida

```
1. Bot faz login no Discord
2. Express comeca a escutar
3. client.once('ready') dispara
4. initializeModules() -> chama initialize() de cada modulo (sequencial, na ordem do array)
5. Bot operacional (handlers + schedulers + rotas ativos)
6. SIGINT/SIGTERM recebido
7. shutdownModules() -> chama shutdown() de cada modulo (ordem reversa)
8. client.destroy()
9. process.exit(0)
```

A ordem do array `modules` em `src/index.ts` importa: `initialize` roda na ordem declarada, `shutdown` roda na ordem inversa.

## Criando um Novo Modulo

### 1. Criar diretorio

```
src/modules/meu-modulo/
```

### 2. Criar index.ts

```typescript
import type { FeatureModule } from '../../core/module';
import { onMessage } from './handlers/onMessage';
import meuModuloRoutes from './api/routes';

export const meuModuloModule: FeatureModule = {
  name: 'meu-modulo',
  description: 'Descricao curta do que faz',

  handlers: {
    messageCreate: onMessage,
  },

  routes: meuModuloRoutes,

  schedulers: [
    {
      name: 'daily-cleanup',
      cron: '0 3 * * *',
      timezone: 'America/Sao_Paulo',
      handler: async () => { /* ... */ },
    },
  ],

  async initialize(client) {
    // Carregar cache, validar config, etc.
  },

  async shutdown() {
    // Fechar conexoes, flush de dados, etc.
  },
};
```

### 3. Criar handlers, services, api conforme necessario

Cada handler e uma funcao async que recebe os argumentos do evento discord.js:

```typescript
// src/modules/meu-modulo/handlers/onMessage.ts
import { Message } from 'discord.js';

export async function onMessage(message: Message): Promise<void> {
  try {
    // logica aqui
  } catch (error) {
    console.error('[meu-modulo] Error in onMessage:', error);
  }
}
```

### 4. Registrar em src/index.ts

```typescript
import { meuModuloModule } from './modules/meu-modulo/index';

const modules: FeatureModule[] = [
  moderationModule,
  aiAgentModule,
  reportsModule,
  schedulerModule,
  metricsModule,
  meuModuloModule,  // adicionar aqui
];
```

## Estrutura de Diretorio Padrao

Usando o modulo `metrics` como referencia:

```
src/modules/metrics/
  index.ts              # Exporta o FeatureModule
  config.ts             # Constantes e configuracao do modulo
  handlers/             # Um arquivo por evento Discord
    onMemberAdd.ts
    onMemberRemove.ts
    onMessage.ts
    onReactionAdd.ts
    onReactionRemove.ts
    onVoiceState.ts
    onInteraction.ts
  services/             # Logica de negocio
    voiceService.ts
    memberService.ts
  scheduler/            # Jobs agendados
    reportScheduler.ts
  api/                  # Rotas Express do modulo
    routes.ts
  __tests__/            # Testes do modulo
```

Modulos simples (como `ai-agent`) podem ter tudo no `index.ts`. A estrutura cresce conforme a complexidade.

## Regras

### Banco de Dados
- Tabelas Prisma de cada modulo devem usar prefixo (ex: `metrics_*`, `moderation_*`)
- **Sem foreign keys entre tabelas de modulos diferentes** -- a isolacao e fundamental
- Se precisa de dados de outro modulo, use a API interna ou o Prisma diretamente (sem FK)

### Handlers
- Devem ser `async` e capturar seus proprios erros com try/catch
- Nunca lance excecoes nao tratadas -- isso aparece como `rejected` no `Promise.allSettled` e polui os logs
- Sempre logue com prefixo do modulo: `[meu-modulo] mensagem`

### Services
- Use `withRetry` para operacoes de escrita no banco
- Mantenha logica de negocio nos services, nao nos handlers
- Handlers sao finos: validam input e delegam para services

### Testes
- Cada modulo tem seu proprio diretorio `__tests__/`
- Testes de um modulo nao devem depender de outro modulo

## Modulos Existentes

| Modulo | name | O que faz |
|--------|------|-----------|
| **Moderation** | `moderation` | Auto-moderacao por regras, tracking de bans e timeouts, push de eventos para o backend Tools |
| **AI Agent** | `ai-agent` | Responde mencoes ao bot usando servico de IA externo |
| **Reports** | `reports` | Sistema RAG para bug reports: busca por similaridade, documentacao automatica quando thread e resolvida |
| **Scheduler** | `scheduler` | Envio de mensagens agendadas (poll a cada minuto por mensagens pendentes) |
| **Metrics** | `metrics` | Coleta de metricas do Discord (membros, mensagens, reacoes, voz), geracao de relatorios diarios/semanais/mensais |
