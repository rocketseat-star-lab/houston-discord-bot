# ADR-001: Arquitetura do Sistema de Métricas do Discord

**Status:** Aceito
**Data:** 2026-02-08
**Decisores:** Equipe Técnica Rocketseat

## Contexto

Precisávamos implementar um sistema completo de métricas e analytics para a comunidade Discord da Rocketseat, capturando eventos de membros (joins/leaves), mensagens, atividade de voz, reações e moderação (bans/timeouts). O objetivo era fornecer visibilidade sobre:

- Crescimento e retenção de membros
- Métricas de engajamento (mensagens, voz, reações)
- Perfis de atividade individuais com histórico completo
- Insights para tomada de decisões sobre a comunidade

## Decisão

Optamos por uma **arquitetura híbrida PUSH + PULL** com dual storage seletivo para eventos de moderação:

### Bot Houston (Fonte Única da Verdade)
- **Papel:** Armazena TODOS os eventos granulares no PostgreSQL do bot
- **Responsabilidade:** Mantém histórico completo de tudo relacionado ao Discord
- **Interface:** Expõe 7 endpoints REST protegidos por API key para consumo do backend

**Modelos implementados (8):**
- MemberJoinLog, MemberLeaveLog
- MessageLog, VoiceActivityLog, ReactionLog
- MemberCountSnapshot
- ModerationBan, ModerationTimeout

### Backend Tools (Agregador e Servidor)
- **PUSH (tempo real):** Recebe bans/timeouts do bot imediatamente via POST
- **PULL (batch 30min):** Consulta bot via GET para agregações de mensagens/voz/reações
- **GET (sob demanda):** Consulta perfis granulares de usuários quando frontend solicita

**Modelos implementados (5):**
- DiscordMemberJoinLog, DiscordMemberLeaveLog (eventos individuais)
- DiscordChannelDailyMetrics, DiscordUserDailyMetrics (agregados)
- DiscordMemberCountSnapshot (snapshots diários)

### Frontend (Consumidor Final)
- **Papel:** Consome APENAS endpoints do backend Tools
- **Isolamento:** Não tem conhecimento da existência do bot
- **Performance:** Recebe dados já processados e otimizados para dashboards

## Razões

### Por que PUSH para bans/timeouts?

✅ **Baixo volume:** Poucos eventos por dia (~5-20)
✅ **Criticidade:** Auditoria requer visibilidade em tempo real
✅ **Impacto mínimo:** Não sobrecarrega o backend
✅ **Dual storage justificado:** Perfis de usuário precisam de histórico completo de moderação

### Por que PULL para mensagens/voz/reações?

✅ **Alto volume:** Milhares de eventos por dia
✅ **Não-crítico:** Delay de 30min é aceitável para métricas agregadas
✅ **Performance:** Evita sobrecarga do backend com POSTs contínuos
✅ **Batch eficiente:** Agrega dados antes de transferir

### Por que Dual Storage de bans/timeouts?

✅ **Perfis completos:** Frontend precisa mostrar histórico granular de moderação
✅ **Bot como fonte:** Mantém consistência - bot tem tudo sobre Discord
✅ **Auditoria em tempo real:** Tools precisa de acesso rápido para dashboards de moderação
✅ **Trade-off consciente:** Pequena duplicação de dados (baixo volume) em troca de performance e funcionalidade

### Por que Bot como Fonte Única da Verdade?

✅ **Separação de responsabilidades:** Bot é especialista em Discord
✅ **Granularidade preservada:** Dados completos sempre disponíveis
✅ **Flexibilidade futura:** Fácil adicionar novos tipos de métricas
✅ **Backend desacoplado:** Tools não depende de eventos em tempo real para funcionar

## Consequências

### Positivas

✅ Bot é fonte única da verdade para tudo relacionado ao Discord
✅ Backend não sobrecarregado com milhares de POSTs por dia
✅ Perfis de usuário completos possíveis (bot mantém tudo granular)
✅ Auditoria em tempo real para eventos críticos (bans/timeouts)
✅ Escalável (fácil adicionar mais métricas sem alterar arquitetura)
✅ Frontend performático (consome dados agregados do Tools)
✅ Resiliência (se sync falhar, dados não são perdidos - estão no bot)

### Negativas

❌ Mais complexidade do que PUSH ou PULL puro
❌ Necessário sincronizar relógios entre serviços (timestamping)
❌ Dual storage de bans/timeouts (trade-off consciente - baixo custo)
❌ Latência de até 30min para métricas não-críticas aparecerem no dashboard
❌ Dependência de conectividade bot ↔ Tools para sync

### Trade-offs Aceitos

**Latência vs Performance:**
- Aceito: Delay de até 30min para métricas agregadas
- Ganho: Backend não sobrecarregado, queries otimizadas

**Duplicação vs Funcionalidade:**
- Aceito: Dual storage de bans/timeouts (~50-100 registros/mês)
- Ganho: Perfis completos + auditoria em tempo real

**Complexidade vs Escalabilidade:**
- Aceito: Sistema híbrido (PUSH + PULL)
- Ganho: Sistema escala sem degradação de performance

## Alternativas Consideradas

### 1. **Tudo PUSH:** Bot envia tudo para Tools em tempo real

❌ **Rejeitado por:**
- Sobrecarga: Milhares de POSTs por dia (mensagens, reações, voz)
- Network overhead: Latência e potencial perda de eventos
- Acoplamento: Tools depende de bot estar sempre disponível

### 2. **Tudo PULL:** Tools consulta bot para tudo

❌ **Rejeitado por:**
- Latência: Frontend espera bot responder (queries complexas)
- Mais complexo para auditoria tempo real
- Sobrecarga no bot com queries frequentes

### 3. **Tudo no Tools:** Bot não armazena, só envia

❌ **Rejeitado por:**
- Bot perde granularidade (não é mais fonte da verdade)
- Perfis de usuário incompletos
- Violação do princípio de separação de responsabilidades

### 4. **Event Sourcing Puro:** Fila de eventos (Kafka/RabbitMQ)

❌ **Rejeitado por:**
- Over-engineering para o volume atual
- Adiciona dependência externa crítica
- Complexidade operacional aumentada
- Custo adicional de infraestrutura

## Implementação

### Fluxo de Dados (PUSH - Tempo Real)

```
Discord → Bot (evento ban/timeout)
       → Bot DB (ModerationBan/Timeout)
       → POST para Tools API (/api/moderation/internal/bans)
       → Tools DB (mesma estrutura)
       → Frontend GET /api/moderation/* (auditoria em tempo real)
```

### Fluxo de Dados (PULL - Batch 30min)

```
Discord → Bot (eventos mensagens/voz/reações)
       → Bot DB (MessageLog/VoiceActivityLog/ReactionLog)

[A cada 30min via cron:]
Tools Job → GET /api/v1/discord-data/messages/aggregate
         → GET /api/v1/discord-data/voice/aggregate
         → GET /api/v1/discord-data/reactions/aggregate
         → Agrega dados
         → Tools DB (DiscordChannelDailyMetrics/DiscordUserDailyMetrics)

Frontend → GET /api/discord/metrics/overview (dados agregados)
```

### Fluxo de Dados (GET sob demanda - Perfis)

```
Frontend → GET /api/discord/metrics/members/:userId/profile
        → Backend Tools (proxy)
        → GET /api/v1/discord-data/users/:userId/profile (bot)
        → Bot retorna dados granulares (mensagens, voz, reações, moderação)
        → Backend Tools cacheia (opcional)
        → Frontend renderiza perfil completo
```

## Métricas de Sucesso

- ✅ Sistema captura 100% dos eventos do Discord
- ✅ Latência <30s para eventos PUSH (bans/timeouts)
- ✅ Latência <30min para eventos PULL (métricas)
- ✅ Backend suporta 10k+ eventos/dia sem degradação
- ✅ Frontend carrega dashboard em <2s
- ✅ Zero perda de dados (bot mantém tudo)

## Referências

- **Implementação Bot:** `/houston-discord-bot/src/bot/events/`, `/houston-discord-bot/src/api/controllers/discordDataController.ts`
- **Implementação Tools Backend:** `/rocketseat-tools/apps/backend/src/jobs/discordMetricsSync.ts`
- **Implementação Tools Frontend:** `/rocketseat-tools/apps/frontend/src/pages/DiscordMetrics.tsx`
- **Modelos de Dados:** Schemas Prisma em ambos os projetos

## Revisões

Nenhuma até o momento.
