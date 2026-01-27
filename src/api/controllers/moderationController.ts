import { Request, Response } from 'express';
import { moderationRuleCache } from '../../services/moderationRuleCache';
import { moderationService } from '../../services/moderationService';

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

/**
 * Retorna informações de debug sobre comunicação com o backend
 */
export const getDebugInfo = async (req: Request, res: Response) => {
  try {
    const debugInfo = moderationService.getDebugInfo();

    return res.status(200).json({
      success: true,
      ...debugInfo,
    });
  } catch (error) {
    console.error('[ModerationController] Error getting debug info:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get debug info',
    });
  }
};

/**
 * Revoga um timeout no Discord
 */
export const revokeTimeout = async (req: Request, res: Response) => {
  try {
    const { guildId, userId } = req.params;

    if (!guildId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID and User ID are required',
      });
    }

    const client = req.app.get('discordClient');
    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Discord client not available',
      });
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found',
      });
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    // Remove timeout (passa null para remover)
    await member.timeout(null, 'Timeout revogado via dashboard');

    console.log(`[ModerationController] Timeout revogado: ${userId} no servidor ${guildId}`);

    return res.status(200).json({
      success: true,
      message: 'Timeout revogado com sucesso',
    });
  } catch (error) {
    console.error('[ModerationController] Error revoking timeout:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke timeout',
    });
  }
};

/**
 * Revoga um ban no Discord
 */
export const revokeBan = async (req: Request, res: Response) => {
  try {
    const { guildId, userId } = req.params;

    if (!guildId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID and User ID are required',
      });
    }

    const client = req.app.get('discordClient');
    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Discord client not available',
      });
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found',
      });
    }

    // Remove o ban
    await guild.members.unban(userId, 'Ban revogado via dashboard');

    console.log(`[ModerationController] Ban revogado: ${userId} no servidor ${guildId}`);

    return res.status(200).json({
      success: true,
      message: 'Ban revogado com sucesso',
    });
  } catch (error) {
    console.error('[ModerationController] Error revoking ban:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke ban',
    });
  }
};
