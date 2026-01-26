/**
 * Cache em memória para regras de moderação
 * Mantém as regras ativas sincronizadas com o backend
 */

import axios from 'axios';

export interface CachedRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  triggerType: string;
  triggerConfig: Record<string, any>;
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

  /**
   * Busca regras do backend e carrega automaticamente com retry
   */
  async fetchAndLoadRules(maxRetries: number = 3, delayMs: number = 2000): Promise<void> {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3001';
    const apiKey = process.env.INTERNAL_API_KEY;

    if (!apiKey) {
      console.error('[ModerationRuleCache] ❌ INTERNAL_API_KEY not configured, cannot fetch rules');
      return;
    }

    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ModerationRuleCache] Fetching rules from backend (attempt ${attempt}/${maxRetries})...`);

        const response = await axios.get(`${backendUrl}/api/moderation/internal/rules?enabled=true`, {
          headers: {
            'x-api-key': apiKey,
          },
          timeout: 5000,
        });

        const rules = response.data.rules || [];
        await this.loadRules(rules);

        console.log(`[ModerationRuleCache] ✅ Successfully fetched and loaded ${rules.length} rules`);
        return; // Success - exit
      } catch (error: any) {
        lastError = error;
        console.error(`[ModerationRuleCache] ❌ Attempt ${attempt}/${maxRetries} failed:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: `${backendUrl}/api/moderation/internal/rules`,
        });

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          console.log(`[ModerationRuleCache] ⏳ Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed
    console.error('[ModerationRuleCache] ❌ Failed to fetch rules after all retries');
    console.error('[ModerationRuleCache] ⚠️ Auto-moderation will NOT work until rules are synced manually');
  }

  /**
   * Carrega regras do backend e armazena em memória
   */
  async loadRules(rules: CachedRule[]): Promise<void> {
    this.rules.clear();

    // Ordena por prioridade (maior primeiro) e depois por nome
    const sortedRules = rules
      .filter((rule) => rule.enabled)
      .sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.name.localeCompare(b.name);
      });

    // Armazena no Map
    for (const rule of sortedRules) {
      this.rules.set(rule.id, rule);
    }

    this.lastSyncedAt = new Date();

    console.log(`[ModerationRuleCache] Loaded ${this.rules.size} active rules`);
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
