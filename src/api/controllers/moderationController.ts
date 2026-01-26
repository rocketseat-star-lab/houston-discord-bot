import { Request, Response } from 'express';
import { moderationRuleCache } from '../../services/moderationRuleCache';

/**
 * Sincroniza regras de moderação recebidas do backend
 */
export const syncRules = async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: 'Rules must be an array',
      });
    }

    // Valida estrutura básica das regras
    for (const rule of rules) {
      if (!rule.id || !rule.name || !rule.triggerType || !Array.isArray(rule.actions)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid rule structure',
        });
      }
    }

    // Carrega regras no cache em memória
    await moderationRuleCache.loadRules(rules);

    console.log(`[ModerationController] Synced ${rules.length} rules from backend`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${rules.length} rules`,
      rulesCount: moderationRuleCache.size(),
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ModerationController] Error syncing rules:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync rules',
    });
  }
};

/**
 * Retorna o status do cache de regras
 */
export const getCacheStatus = async (req: Request, res: Response) => {
  try {
    const status = moderationRuleCache.getStatus();

    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[ModerationController] Error getting cache status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get cache status',
    });
  }
};
