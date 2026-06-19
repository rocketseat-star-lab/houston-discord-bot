/**
 * Cache em memória para regras de moderação
 * Mantém as regras ativas sincronizadas com o backend
 */

import axios from 'axios';
import prisma from './prisma';

// Linha unica do snapshot local (ver model ModerationRuleSnapshot).
const SNAPSHOT_ID = 'default';

export interface CachedRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  triggerType: string;
  triggerConfig: Record<string, any>;
  guildIds: string[]; // IDs dos servidores onde a regra deve ser aplicada
  exemptRoleIds: string[];
  exemptChannelIds: string[];
  actions: CachedAction[];
}

export interface CachedAction {
  id: string;
  actionType: string;
  actionConfig: Record<string, any>;
  order: number;
}

export class ModerationRuleCache {
  private rules: Map<string, CachedRule> = new Map();
  private lastSyncedAt: Date | null = null;
  private backgroundIntervalId: ReturnType<typeof setInterval> | null = null;
  private inFlightFetch: Promise<void> | null = null;

  /**
   * Aquece a Vercel batendo no /api/health antes de chamar o endpoint de
   * regras. Sem isso, a primeira chamada (a "de verdade") absorve o
   * tempo do cold-start (10-30s) e estoura nosso timeout. O ping de
   * health responde em <500ms quando warm e dispara o cold-start de
   * forma "barata".
   */
  private async warmUpBackend(backendUrl: string): Promise<void> {
    try {
      await axios.get(`${backendUrl}/api/health`, { timeout: 30_000 });
    } catch (err: any) {
      // Falhar aqui nao impede a tentativa real — so loga.
      console.warn(
        '[ModerationRuleCache] Warmup ping falhou (ok, vamos tentar a fetch mesmo assim):',
        err?.message ?? err
      );
    }
  }

  /**
   * Busca regras do backend e carrega automaticamente com retry e backoff
   * exponencial. Timeout generoso (30s) por chamada pra absorver cold
   * start do Vercel — o sintoma classico de "deploy do bot e moderacao
   * para de funcionar" e exatamente esse: 5s nao basta pra acordar a
   * Vercel, todos os retries estouram, cache fica vazio.
   *
   * Cada attempt: 30s de timeout. Entre attempts, espera com backoff
   * 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s... (cap em 30s).
   */
  async fetchAndLoadRules(maxRetries: number = 10, _legacyDelayMs?: number): Promise<void> {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3001';
    const apiKey = process.env.INTERNAL_API_KEY;

    if (!apiKey) {
      console.error('[ModerationRuleCache] ❌ INTERNAL_API_KEY not configured, cannot fetch rules');
      return;
    }

    // Endpoint dedicado: retorna TODAS as regras ativas, sem paginacao.
    // Trocamos do antigo `/internal/rules` (paginado, default limit=20)
    // que historicamente cortava regras silenciosamente.
    const rulesUrl = `${backendUrl}/api/moderation/internal/rules/sync-payload`;

    await this.warmUpBackend(backendUrl);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ModerationRuleCache] Fetching rules (attempt ${attempt}/${maxRetries})...`);
        const response = await axios.get(rulesUrl, {
          headers: { 'x-api-key': apiKey },
          timeout: 30_000,
        });

        // Blindagem: so aceitamos um array `rules` de verdade. Uma
        // resposta 200 com shape inesperado (ex: Tools em cold-start
        // devolvendo HTML, ou payload sem `rules`) NAO pode zerar o
        // cache — tratamos como falha e mantemos as regras atuais. Um
        // array vazio legitimo (todas as regras desativadas) e aceito.
        const rules = response.data?.rules;
        if (!Array.isArray(rules)) {
          throw new Error(
            "Resposta inesperada do sync-payload (campo 'rules' nao e um array)"
          );
        }
        await this.loadRules(rules);

        console.log(
          `[ModerationRuleCache] ✅ Successfully fetched and loaded ${rules.length} rules`
        );
        return;
      } catch (error: any) {
        console.error(
          `[ModerationRuleCache] ❌ Attempt ${attempt}/${maxRetries} failed:`,
          {
            message: error.message,
            code: error.code,
            status: error.response?.status,
          }
        );

        if (attempt < maxRetries) {
          // Backoff exponencial: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
          console.log(`[ModerationRuleCache] ⏳ Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error('[ModerationRuleCache] ❌ Failed to fetch rules after all retries');
    console.error(
      '[ModerationRuleCache] ⚠️ Background sync continua tentando — moderacao ficara degradada ate sincronizar'
    );
  }

  /**
   * Preenche o Map em memória a partir de um array de regras. Filtra as
   * desabilitadas e ordena por prioridade (maior primeiro) e nome.
   * Nao persiste — quem decide persistir e o chamador.
   */
  private applyRules(rules: CachedRule[], syncedAt: Date): void {
    this.rules.clear();

    const sortedRules = rules
      .filter((rule) => rule.enabled)
      .sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.name.localeCompare(b.name);
      });

    for (const rule of sortedRules) {
      this.rules.set(rule.id, rule);
    }

    this.lastSyncedAt = syncedAt;
  }

  /**
   * Carrega regras vindas de um sync (push do Tools ou pull do bot):
   * aplica em memória E persiste o snapshot local, pra sobreviver a
   * restarts.
   */
  async loadRules(rules: CachedRule[]): Promise<void> {
    this.applyRules(rules, new Date());
    await this.saveSnapshot(rules);
    console.log(`[ModerationRuleCache] Loaded ${this.rules.size} active rules`);
  }

  /**
   * Persiste o array CRU de regras (incluindo desabilitadas) no banco do
   * bot. Best-effort: uma falha aqui nunca pode derrubar o sync — a
   * moderacao segue funcionando em memória, so perde a rede de seguranca
   * do snapshot ate o proximo sync.
   */
  private async saveSnapshot(rules: CachedRule[]): Promise<void> {
    try {
      await prisma.moderationRuleSnapshot.upsert({
        where: { id: SNAPSHOT_ID },
        update: { rules: rules as any, ruleCount: rules.length },
        create: { id: SNAPSHOT_ID, rules: rules as any, ruleCount: rules.length },
      });
    } catch (err: any) {
      console.error(
        '[ModerationRuleCache] ⚠️ Falha ao persistir snapshot (moderacao segue ativa):',
        err?.message ?? err
      );
    }
  }

  /**
   * Carrega as regras do snapshot local (banco do bot). Usado no boot
   * pra restaurar a moderacao IMEDIATAMENTE, sem depender de uma
   * sincronizacao com o Tools — resolve o "deploy zera a moderacao".
   * Retorna true se restaurou alguma regra.
   */
  async loadFromSnapshot(): Promise<boolean> {
    try {
      const snap = await prisma.moderationRuleSnapshot.findUnique({
        where: { id: SNAPSHOT_ID },
      });
      const rules = snap?.rules;
      if (!snap || !Array.isArray(rules) || rules.length === 0) return false;

      this.applyRules(rules as unknown as CachedRule[], snap.updatedAt);
      console.log(
        `[ModerationRuleCache] Restauradas ${this.rules.size} regras do snapshot local (sync de ${snap.updatedAt.toISOString()})`
      );
      return this.rules.size > 0;
    } catch (err: any) {
      console.error(
        '[ModerationRuleCache] Falha ao restaurar snapshot local:',
        err?.message ?? err
      );
      return false;
    }
  }

  /**
   * Retorna todas as regras ativas ordenadas por prioridade
   */
  getAllRules(): CachedRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Retorna regras de um tipo específico de trigger
   */
  getRulesByTriggerType(triggerType: string): CachedRule[] {
    return Array.from(this.rules.values()).filter(
      (rule) => rule.triggerType === triggerType
    );
  }

  /**
   * Busca uma regra específica por ID
   */
  getRuleById(id: string): CachedRule | null {
    return this.rules.get(id) || null;
  }

  /**
   * Retorna o número de regras ativas em cache
   */
  size(): number {
    return this.rules.size;
  }

  /**
   * Limpa o cache
   */
  clear(): void {
    this.rules.clear();
    this.lastSyncedAt = null;
    console.log('[ModerationRuleCache] Cache cleared');
  }

  /**
   * Background sync ADAPTATIVO:
   *  - enquanto o cache esta vazio (sincronia inicial falhou), tenta a
   *    cada `emptyIntervalMs` (default 30s) — recupera rapido depois de
   *    incidente transitorio sem precisar de sync manual;
   *  - depois que popular, espaca pra `steadyIntervalMs` (default 5min)
   *    pra nao bater no Tools sem necessidade.
   *
   * Idempotente — chamadas extras sao ignoradas.
   */
  startBackgroundSync(
    steadyIntervalMs: number = 5 * 60 * 1000,
    emptyIntervalMs: number = 30 * 1000
  ): void {
    if (this.backgroundIntervalId) return;
    console.log(
      `[ModerationRuleCache] Background sync iniciado (vazio=${emptyIntervalMs / 1000}s, populado=${steadyIntervalMs / 1000}s)`
    );

    const tick = async () => {
      try {
        const wasEmpty = this.rules.size === 0;
        await this.fetchAndLoadRules(wasEmpty ? 5 : 2);
      } catch (err) {
        console.error('[ModerationRuleCache] Background sync error:', err);
      } finally {
        // Reprograma o proximo tick conforme o estado atual do cache.
        if (this.backgroundIntervalId !== null) {
          this.backgroundIntervalId = setTimeout(
            tick,
            this.rules.size === 0 ? emptyIntervalMs : steadyIntervalMs
          );
        }
      }
    };

    // Marca como ativo antes do primeiro tick (setTimeout retorna a ref
    // mas tick e async). Usa um placeholder truthy que o tick substitui.
    this.backgroundIntervalId = setTimeout(
      tick,
      this.rules.size === 0 ? emptyIntervalMs : steadyIntervalMs
    );
  }

  stopBackgroundSync(): void {
    if (this.backgroundIntervalId) {
      clearTimeout(this.backgroundIntervalId);
      this.backgroundIntervalId = null;
    }
  }

  /**
   * Garante que o cache está populado. Se vazio, faz fetch agora.
   * Deduplica chamadas concorrentes via inFlightFetch.
   */
  async ensurePopulated(): Promise<void> {
    if (this.rules.size > 0) return;
    if (this.inFlightFetch) {
      await this.inFlightFetch;
      return;
    }
    this.inFlightFetch = this.fetchAndLoadRules(3).finally(() => {
      this.inFlightFetch = null;
    });
    await this.inFlightFetch;
  }

  /**
   * Retorna informações sobre o cache
   */
  getStatus(): {
    rulesCount: number;
    lastSyncedAt: Date | null;
    rules: Array<{ id: string; name: string; triggerType: string }>;
  } {
    return {
      rulesCount: this.rules.size,
      lastSyncedAt: this.lastSyncedAt,
      rules: Array.from(this.rules.values()).map(rule => ({
        id: rule.id,
        name: rule.name,
        triggerType: rule.triggerType,
      })),
    };
  }
}

// Singleton
export const moderationRuleCache = new ModerationRuleCache();
