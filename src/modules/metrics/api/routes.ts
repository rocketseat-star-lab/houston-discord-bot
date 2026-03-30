import { Router } from 'express';
import * as controller from './controller';

const router = Router();

router.get('/overview/:guildId', controller.getOverview);
router.get('/members/:guildId', controller.getMembers);
router.get('/members/:guildId/activity', controller.getMembersActivity);
router.get('/messages/:guildId', controller.getMessages);
router.get('/reactions/:guildId', controller.getReactions);
router.get('/voice/:guildId', controller.getVoice);
router.get('/reports/:guildId', controller.getReport);
router.post('/reports/:guildId/generate', controller.generateReport);
router.get('/snapshots/:guildId', controller.getSnapshots);
router.get('/timeseries/:guildId/:metric', controller.getTimeseries);
router.get('/channels/:guildId', controller.getChannelRanking);
router.get('/voice-channels/:guildId', controller.getVoiceChannelRanking);
router.get('/retention/:guildId', controller.getRetentionDistribution);
router.get('/total-members/:guildId', controller.getTotalMembers);
router.get('/top-senders/:guildId', controller.getTopSenders);
router.get('/top-reactors/:guildId', controller.getTopReactors);
router.get('/top-voice-users/:guildId', controller.getTopVoiceUsersByRange);

export default router;
