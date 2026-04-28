import type { FeatureModule } from '../../core/module';
import { onMessage } from './handlers/onMessage';
import { onReactionAdd } from './handlers/onReactionAdd';
import { onVoiceState } from './handlers/onVoiceState';
import { onInteraction } from './handlers/onInteraction';
import { registerReputationSlashCommands } from './commands/register';

export const reputationModule: FeatureModule = {
  name: 'reputation',
  description: 'Discord member reputation events forwarding and slash commands',

  handlers: {
    messageCreate: onMessage,
    messageReactionAdd: onReactionAdd,
    voiceStateUpdate: onVoiceState,
    interactionCreate: onInteraction,
  },

  async initialize(client) {
    const clientId = client.user?.id;
    if (clientId) {
      await registerReputationSlashCommands(clientId);
    }
  },
};
