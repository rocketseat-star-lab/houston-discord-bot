import { Request, Response } from 'express';
import { Client, ChannelType } from 'discord.js';

/**
 * Lista todos os servidores (guilds) em que o bot está, incluindo seus canais.
 */
export async function listGuilds(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guildsData = await Promise.all(
      discordClient.guilds.cache.map(async guild => {
        const channels = await guild.channels.fetch();

        const channelsList = channels
          .filter(channel => channel !== null)
          .map(channel => ({
            id: channel!.id,
            name: channel!.name,
            type: channel!.type,
            typeName: ChannelType[channel!.type],
            position: channel!.position,
            parentId: channel!.parentId,
          }))
          .sort((a, b) => {
            const channelA = channels.get(a.id);
            const channelB = channels.get(b.id);
            return (channelA?.position ?? 0) - (channelB?.position ?? 0);
          });

        return {
          id: guild.id,
          name: guild.name,
          iconURL: guild.iconURL(),
          channels: channelsList,
        };
      })
    );

    res.status(200).json(guildsData);
  } catch (error) {
    console.error('Erro ao buscar servidores:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de servidores.' });
  }
}

/**
 * Lista apenas os canais de fórum de um servidor.
 */
export async function listForumChannels(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const guildId = req.params.guildId as string;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    const channels = await guild.channels.fetch();

    // Retorna apenas canais do tipo fórum
    const forumChannels: { id: string; name: string; type: number; typeName: string }[] = [];

    channels.forEach(channel => {
      if (!channel) return;
      if (channel.type !== ChannelType.GuildForum) return;

      forumChannels.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        typeName: ChannelType[channel.type],
      });
    });

    // Ordena por posição
    forumChannels.sort((a, b) => {
      const channelA = channels.get(a.id);
      const channelB = channels.get(b.id);
      return (channelA?.position ?? 0) - (channelB?.position ?? 0);
    });

    res.status(200).json({ channels: forumChannels });
  } catch (error) {
    console.error('Erro ao buscar canais de fórum:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de canais.' });
  }
}

/**
 * Lista todas as roles de um servidor
 */
export async function listGuildRoles(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const guildId = req.params.guildId as string;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    const roles = await guild.roles.fetch();

    // Roles especiais do Discord (não são roles reais, mas menções especiais)
    const specialRoles = [
      {
        id: 'everyone',
        name: 'everyone',
        color: '#99AAB5',
        position: -1,
        managed: false,
        special: true
      },
      {
        id: 'here',
        name: 'here',
        color: '#99AAB5',
        position: -2,
        managed: false,
        special: true
      }
    ];

    const rolesList = roles
      .filter(role => role !== null && role.name !== '@everyone')
      .map(role => ({
        id: role!.id,
        name: role!.name,
        color: role!.hexColor,
        position: role!.position,
        managed: role!.managed,
        special: false
      }))
      .sort((a, b) => b.position - a.position);

    // Adicionar roles especiais no início
    const allRoles = [...specialRoles, ...rolesList];

    res.status(200).json({ roles: allRoles });
  } catch (error) {
    console.error('Erro ao buscar roles:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de roles.' });
  }
}

/**
 * Lista todos os canais de um servidor (text, voice, announcement, etc.)
 */
export async function listGuildChannels(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const guildId = req.params.guildId as string;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    const channels = await guild.channels.fetch();

    const channelsList = channels
      .filter(channel => channel !== null)
      .map(channel => ({
        id: channel!.id,
        name: channel!.name,
        type: channel!.type,
        typeName: ChannelType[channel!.type],
        position: channel!.position,
        parentId: channel!.parentId,
      }))
      .sort((a, b) => a.position - b.position);

    res.status(200).json({ channels: channelsList });
  } catch (error) {
    console.error('Erro ao buscar canais:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de canais.' });
  }
}

/**
 * Lista todos os emojis disponíveis em um servidor
 */
export async function listGuildEmojis(req: Request, res: Response) {
  const discordClient = req.app.get('discordClient') as Client;
  const guildId = req.params.guildId as string;

  if (!discordClient || !discordClient.isReady()) {
    return res.status(503).json({ error: 'O cliente do Discord não está pronto ou disponível.' });
  }

  try {
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Servidor não encontrado.' });
    }

    // Buscar todos os emojis customizados do servidor
    const emojis = await guild.emojis.fetch();

    const customEmojisList = emojis
      .filter(emoji => emoji !== null)
      .map(emoji => ({
        id: emoji!.id,
        name: emoji!.name,
        animated: emoji!.animated,
        identifier: emoji!.animated ? `<a:${emoji!.name}:${emoji!.id}>` : `<:${emoji!.name}:${emoji!.id}>`,
        url: emoji!.url,
        custom: true
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Emojis Unicode padrão (lista completa sincronizada com frontend)
    const unicodeEmojis = [
      { id: 'unicode_thumbsup', name: 'thumbsup', animated: false, identifier: '👍', url: null, custom: false },
      { id: 'unicode_thumbsdown', name: 'thumbsdown', animated: false, identifier: '👎', url: null, custom: false },
      { id: 'unicode_heart', name: 'heart', animated: false, identifier: '❤️', url: null, custom: false },
      { id: 'unicode_fire', name: 'fire', animated: false, identifier: '🔥', url: null, custom: false },
      { id: 'unicode_rocket', name: 'rocket', animated: false, identifier: '🚀', url: null, custom: false },
      { id: 'unicode_star', name: 'star', animated: false, identifier: '⭐', url: null, custom: false },
      { id: 'unicode_clap', name: 'clap', animated: false, identifier: '👏', url: null, custom: false },
      { id: 'unicode_eyes', name: 'eyes', animated: false, identifier: '👀', url: null, custom: false },
      { id: 'unicode_tada', name: 'tada', animated: false, identifier: '🎉', url: null, custom: false },
      { id: 'unicode_100', name: '100', animated: false, identifier: '💯', url: null, custom: false },
      { id: 'unicode_white_check_mark', name: 'white_check_mark', animated: false, identifier: '✅', url: null, custom: false },
      { id: 'unicode_x', name: 'x', animated: false, identifier: '❌', url: null, custom: false },
      { id: 'unicode_grinning', name: 'grinning', animated: false, identifier: '😀', url: null, custom: false },
      { id: 'unicode_smiley', name: 'smiley', animated: false, identifier: '😃', url: null, custom: false },
      { id: 'unicode_smile', name: 'smile', animated: false, identifier: '😄', url: null, custom: false },
      { id: 'unicode_grin', name: 'grin', animated: false, identifier: '😁', url: null, custom: false },
      { id: 'unicode_laughing', name: 'laughing', animated: false, identifier: '😆', url: null, custom: false },
      { id: 'unicode_sweat_smile', name: 'sweat_smile', animated: false, identifier: '😅', url: null, custom: false },
      { id: 'unicode_rofl', name: 'rofl', animated: false, identifier: '🤣', url: null, custom: false },
      { id: 'unicode_joy', name: 'joy', animated: false, identifier: '😂', url: null, custom: false },
      { id: 'unicode_slightly_smiling_face', name: 'slightly_smiling_face', animated: false, identifier: '🙂', url: null, custom: false },
      { id: 'unicode_upside_down', name: 'upside_down', animated: false, identifier: '🙃', url: null, custom: false },
      { id: 'unicode_melting_face', name: 'melting_face', animated: false, identifier: '🫠', url: null, custom: false },
      { id: 'unicode_wink', name: 'wink', animated: false, identifier: '😉', url: null, custom: false },
      { id: 'unicode_blush', name: 'blush', animated: false, identifier: '😊', url: null, custom: false },
      { id: 'unicode_innocent', name: 'innocent', animated: false, identifier: '😇', url: null, custom: false },
      { id: 'unicode_smiling_face_with_3_hearts', name: 'smiling_face_with_3_hearts', animated: false, identifier: '🥰', url: null, custom: false },
      { id: 'unicode_heart_eyes', name: 'heart_eyes', animated: false, identifier: '😍', url: null, custom: false },
      { id: 'unicode_star_struck', name: 'star_struck', animated: false, identifier: '🤩', url: null, custom: false },
      { id: 'unicode_kissing_heart', name: 'kissing_heart', animated: false, identifier: '😘', url: null, custom: false },
      { id: 'unicode_kissing', name: 'kissing', animated: false, identifier: '😗', url: null, custom: false },
      { id: 'unicode_kissing_smiling_eyes', name: 'kissing_smiling_eyes', animated: false, identifier: '😙', url: null, custom: false },
      { id: 'unicode_kissing_closed_eyes', name: 'kissing_closed_eyes', animated: false, identifier: '😚', url: null, custom: false },
      { id: 'unicode_yum', name: 'yum', animated: false, identifier: '😋', url: null, custom: false },
      { id: 'unicode_stuck_out_tongue', name: 'stuck_out_tongue', animated: false, identifier: '😛', url: null, custom: false },
      { id: 'unicode_stuck_out_tongue_winking_eye', name: 'stuck_out_tongue_winking_eye', animated: false, identifier: '😜', url: null, custom: false },
      { id: 'unicode_zany_face', name: 'zany_face', animated: false, identifier: '🤪', url: null, custom: false },
      { id: 'unicode_stuck_out_tongue_closed_eyes', name: 'stuck_out_tongue_closed_eyes', animated: false, identifier: '😝', url: null, custom: false },
      { id: 'unicode_money_mouth', name: 'money_mouth', animated: false, identifier: '🤑', url: null, custom: false },
      { id: 'unicode_hugging', name: 'hugging', animated: false, identifier: '🤗', url: null, custom: false },
      { id: 'unicode_shushing_face', name: 'shushing_face', animated: false, identifier: '🤫', url: null, custom: false },
      { id: 'unicode_thinking', name: 'thinking', animated: false, identifier: '🤔', url: null, custom: false },
      { id: 'unicode_saluting_face', name: 'saluting_face', animated: false, identifier: '🫡', url: null, custom: false },
      { id: 'unicode_zipper_mouth', name: 'zipper_mouth', animated: false, identifier: '🤐', url: null, custom: false },
      { id: 'unicode_raised_eyebrow', name: 'raised_eyebrow', animated: false, identifier: '🤨', url: null, custom: false },
      { id: 'unicode_neutral_face', name: 'neutral_face', animated: false, identifier: '😐', url: null, custom: false },
      { id: 'unicode_expressionless', name: 'expressionless', animated: false, identifier: '😑', url: null, custom: false },
      { id: 'unicode_no_mouth', name: 'no_mouth', animated: false, identifier: '😶', url: null, custom: false },
      { id: 'unicode_dotted_line_face', name: 'dotted_line_face', animated: false, identifier: '🫥', url: null, custom: false },
      { id: 'unicode_smirk', name: 'smirk', animated: false, identifier: '😏', url: null, custom: false },
      { id: 'unicode_unamused', name: 'unamused', animated: false, identifier: '😒', url: null, custom: false },
      { id: 'unicode_rolling_eyes', name: 'rolling_eyes', animated: false, identifier: '🙄', url: null, custom: false },
      { id: 'unicode_grimacing', name: 'grimacing', animated: false, identifier: '😬', url: null, custom: false },
      { id: 'unicode_exhale', name: 'exhale', animated: false, identifier: '😮‍💨', url: null, custom: false },
      { id: 'unicode_lying_face', name: 'lying_face', animated: false, identifier: '🤥', url: null, custom: false },
      { id: 'unicode_relieved', name: 'relieved', animated: false, identifier: '😌', url: null, custom: false },
      { id: 'unicode_pensive', name: 'pensive', animated: false, identifier: '😔', url: null, custom: false },
      { id: 'unicode_sleepy', name: 'sleepy', animated: false, identifier: '😪', url: null, custom: false },
      { id: 'unicode_drooling_face', name: 'drooling_face', animated: false, identifier: '🤤', url: null, custom: false },
      { id: 'unicode_sleeping', name: 'sleeping', animated: false, identifier: '😴', url: null, custom: false },
      { id: 'unicode_mask', name: 'mask', animated: false, identifier: '😷', url: null, custom: false },
      { id: 'unicode_face_with_thermometer', name: 'face_with_thermometer', animated: false, identifier: '🤒', url: null, custom: false },
      { id: 'unicode_face_with_head_bandage', name: 'face_with_head_bandage', animated: false, identifier: '🤕', url: null, custom: false },
      { id: 'unicode_nauseated_face', name: 'nauseated_face', animated: false, identifier: '🤢', url: null, custom: false },
      { id: 'unicode_face_vomiting', name: 'face_vomiting', animated: false, identifier: '🤮', url: null, custom: false },
      { id: 'unicode_sneezing_face', name: 'sneezing_face', animated: false, identifier: '🤧', url: null, custom: false },
      { id: 'unicode_hot_face', name: 'hot_face', animated: false, identifier: '🥵', url: null, custom: false },
      { id: 'unicode_cold_face', name: 'cold_face', animated: false, identifier: '🥶', url: null, custom: false },
      { id: 'unicode_woozy_face', name: 'woozy_face', animated: false, identifier: '🥴', url: null, custom: false },
      { id: 'unicode_dizzy_face', name: 'dizzy_face', animated: false, identifier: '😵', url: null, custom: false },
      { id: 'unicode_exploding_head', name: 'exploding_head', animated: false, identifier: '🤯', url: null, custom: false },
      { id: 'unicode_cowboy', name: 'cowboy', animated: false, identifier: '🤠', url: null, custom: false },
      { id: 'unicode_partying_face', name: 'partying_face', animated: false, identifier: '🥳', url: null, custom: false },
      { id: 'unicode_disguised_face', name: 'disguised_face', animated: false, identifier: '🥸', url: null, custom: false },
      { id: 'unicode_sunglasses', name: 'sunglasses', animated: false, identifier: '😎', url: null, custom: false },
      { id: 'unicode_nerd', name: 'nerd', animated: false, identifier: '🤓', url: null, custom: false },
      { id: 'unicode_monocle_face', name: 'monocle_face', animated: false, identifier: '🧐', url: null, custom: false },
      { id: 'unicode_confused', name: 'confused', animated: false, identifier: '😕', url: null, custom: false },
      { id: 'unicode_worried', name: 'worried', animated: false, identifier: '😟', url: null, custom: false },
      { id: 'unicode_slightly_frowning_face', name: 'slightly_frowning_face', animated: false, identifier: '🙁', url: null, custom: false },
      { id: 'unicode_frowning', name: 'frowning', animated: false, identifier: '☹️', url: null, custom: false },
      { id: 'unicode_open_mouth', name: 'open_mouth', animated: false, identifier: '😮', url: null, custom: false },
      { id: 'unicode_hushed', name: 'hushed', animated: false, identifier: '😯', url: null, custom: false },
      { id: 'unicode_astonished', name: 'astonished', animated: false, identifier: '😲', url: null, custom: false },
      { id: 'unicode_flushed', name: 'flushed', animated: false, identifier: '😳', url: null, custom: false },
      { id: 'unicode_pleading', name: 'pleading', animated: false, identifier: '🥺', url: null, custom: false },
      { id: 'unicode_face_holding_back_tears', name: 'face_holding_back_tears', animated: false, identifier: '🥹', url: null, custom: false },
      { id: 'unicode_frowning2', name: 'frowning2', animated: false, identifier: '😦', url: null, custom: false },
      { id: 'unicode_anguished', name: 'anguished', animated: false, identifier: '😧', url: null, custom: false },
      { id: 'unicode_fearful', name: 'fearful', animated: false, identifier: '😨', url: null, custom: false },
      { id: 'unicode_cold_sweat', name: 'cold_sweat', animated: false, identifier: '😰', url: null, custom: false },
      { id: 'unicode_disappointed_relieved', name: 'disappointed_relieved', animated: false, identifier: '😥', url: null, custom: false },
      { id: 'unicode_cry', name: 'cry', animated: false, identifier: '😢', url: null, custom: false },
      { id: 'unicode_sob', name: 'sob', animated: false, identifier: '😭', url: null, custom: false },
      { id: 'unicode_scream', name: 'scream', animated: false, identifier: '😱', url: null, custom: false },
      { id: 'unicode_confounded', name: 'confounded', animated: false, identifier: '😖', url: null, custom: false },
      { id: 'unicode_persevere', name: 'persevere', animated: false, identifier: '😣', url: null, custom: false },
      { id: 'unicode_disappointed', name: 'disappointed', animated: false, identifier: '😞', url: null, custom: false },
      { id: 'unicode_sweat', name: 'sweat', animated: false, identifier: '😓', url: null, custom: false },
      { id: 'unicode_weary', name: 'weary', animated: false, identifier: '😩', url: null, custom: false },
      { id: 'unicode_tired_face', name: 'tired_face', animated: false, identifier: '😫', url: null, custom: false },
      { id: 'unicode_yawning_face', name: 'yawning_face', animated: false, identifier: '🥱', url: null, custom: false },
      { id: 'unicode_angry', name: 'angry', animated: false, identifier: '😠', url: null, custom: false },
      { id: 'unicode_rage', name: 'rage', animated: false, identifier: '😡', url: null, custom: false },
      { id: 'unicode_symbols_over_mouth', name: 'symbols_over_mouth', animated: false, identifier: '🤬', url: null, custom: false },
      { id: 'unicode_imp', name: 'imp', animated: false, identifier: '😈', url: null, custom: false },
      { id: 'unicode_smiling_imp', name: 'smiling_imp', animated: false, identifier: '😈', url: null, custom: false },
      { id: 'unicode_skull', name: 'skull', animated: false, identifier: '💀', url: null, custom: false },
      { id: 'unicode_skull_crossbones', name: 'skull_crossbones', animated: false, identifier: '☠️', url: null, custom: false },
      { id: 'unicode_clown', name: 'clown', animated: false, identifier: '🤡', url: null, custom: false },
      { id: 'unicode_japanese_ogre', name: 'japanese_ogre', animated: false, identifier: '👹', url: null, custom: false },
      { id: 'unicode_ghost', name: 'ghost', animated: false, identifier: '👻', url: null, custom: false },
      { id: 'unicode_alien', name: 'alien', animated: false, identifier: '👽', url: null, custom: false },
      { id: 'unicode_robot', name: 'robot', animated: false, identifier: '🤖', url: null, custom: false },
      { id: 'unicode_poop', name: 'poop', animated: false, identifier: '💩', url: null, custom: false },
      { id: 'unicode_wave', name: 'wave', animated: false, identifier: '👋', url: null, custom: false },
      { id: 'unicode_raised_back_of_hand', name: 'raised_back_of_hand', animated: false, identifier: '🤚', url: null, custom: false },
      { id: 'unicode_hand_splayed', name: 'hand_splayed', animated: false, identifier: '🖐️', url: null, custom: false },
      { id: 'unicode_raised_hand', name: 'raised_hand', animated: false, identifier: '✋', url: null, custom: false },
      { id: 'unicode_vulcan', name: 'vulcan', animated: false, identifier: '🖖', url: null, custom: false },
      { id: 'unicode_rightwards_hand', name: 'rightwards_hand', animated: false, identifier: '🫱', url: null, custom: false },
      { id: 'unicode_leftwards_hand', name: 'leftwards_hand', animated: false, identifier: '🫲', url: null, custom: false },
      { id: 'unicode_palm_down_hand', name: 'palm_down_hand', animated: false, identifier: '🫳', url: null, custom: false },
      { id: 'unicode_palm_up_hand', name: 'palm_up_hand', animated: false, identifier: '🫴', url: null, custom: false },
      { id: 'unicode_ok_hand', name: 'ok_hand', animated: false, identifier: '👌', url: null, custom: false },
      { id: 'unicode_pinched_fingers', name: 'pinched_fingers', animated: false, identifier: '🤌', url: null, custom: false },
      { id: 'unicode_pinching_hand', name: 'pinching_hand', animated: false, identifier: '🤏', url: null, custom: false },
      { id: 'unicode_v', name: 'v', animated: false, identifier: '✌️', url: null, custom: false },
      { id: 'unicode_crossed_fingers', name: 'crossed_fingers', animated: false, identifier: '🤞', url: null, custom: false },
      { id: 'unicode_hand_with_index_finger_and_thumb_crossed', name: 'hand_with_index_finger_and_thumb_crossed', animated: false, identifier: '🫰', url: null, custom: false },
      { id: 'unicode_love_you_gesture', name: 'love_you_gesture', animated: false, identifier: '🤟', url: null, custom: false },
      { id: 'unicode_metal', name: 'metal', animated: false, identifier: '🤘', url: null, custom: false },
      { id: 'unicode_call_me', name: 'call_me', animated: false, identifier: '🤙', url: null, custom: false },
      { id: 'unicode_point_left', name: 'point_left', animated: false, identifier: '👈', url: null, custom: false },
      { id: 'unicode_point_right', name: 'point_right', animated: false, identifier: '👉', url: null, custom: false },
      { id: 'unicode_point_up_2', name: 'point_up_2', animated: false, identifier: '👆', url: null, custom: false },
      { id: 'unicode_middle_finger', name: 'middle_finger', animated: false, identifier: '🖕', url: null, custom: false },
      { id: 'unicode_point_down', name: 'point_down', animated: false, identifier: '👇', url: null, custom: false },
      { id: 'unicode_point_up', name: 'point_up', animated: false, identifier: '☝️', url: null, custom: false },
      { id: 'unicode_index_pointing_at_the_viewer', name: 'index_pointing_at_the_viewer', animated: false, identifier: '🫵', url: null, custom: false },
      { id: 'unicode_raised_hands', name: 'raised_hands', animated: false, identifier: '🙌', url: null, custom: false },
      { id: 'unicode_open_hands', name: 'open_hands', animated: false, identifier: '👐', url: null, custom: false },
      { id: 'unicode_palms_up_together', name: 'palms_up_together', animated: false, identifier: '🤲', url: null, custom: false },
      { id: 'unicode_handshake', name: 'handshake', animated: false, identifier: '🤝', url: null, custom: false },
      { id: 'unicode_pray', name: 'pray', animated: false, identifier: '🙏', url: null, custom: false },
      { id: 'unicode_writing_hand', name: 'writing_hand', animated: false, identifier: '✍️', url: null, custom: false },
      { id: 'unicode_nail_care', name: 'nail_care', animated: false, identifier: '💅', url: null, custom: false },
      { id: 'unicode_selfie', name: 'selfie', animated: false, identifier: '🤳', url: null, custom: false },
      { id: 'unicode_muscle', name: 'muscle', animated: false, identifier: '💪', url: null, custom: false },
      { id: 'unicode_leg', name: 'leg', animated: false, identifier: '🦵', url: null, custom: false },
      { id: 'unicode_foot', name: 'foot', animated: false, identifier: '🦶', url: null, custom: false },
      { id: 'unicode_ear', name: 'ear', animated: false, identifier: '👂', url: null, custom: false },
      { id: 'unicode_nose', name: 'nose', animated: false, identifier: '👃', url: null, custom: false },
      { id: 'unicode_brain', name: 'brain', animated: false, identifier: '🧠', url: null, custom: false },
      { id: 'unicode_tooth', name: 'tooth', animated: false, identifier: '🦷', url: null, custom: false },
      { id: 'unicode_bone', name: 'bone', animated: false, identifier: '🦴', url: null, custom: false },
      { id: 'unicode_heart_hands', name: 'heart_hands', animated: false, identifier: '🫶', url: null, custom: false },
      { id: 'unicode_fist', name: 'fist', animated: false, identifier: '✊', url: null, custom: false },
      { id: 'unicode_punch', name: 'punch', animated: false, identifier: '👊', url: null, custom: false },
      { id: 'unicode_left_facing_fist', name: 'left_facing_fist', animated: false, identifier: '🤛', url: null, custom: false },
      { id: 'unicode_right_facing_fist', name: 'right_facing_fist', animated: false, identifier: '🤜', url: null, custom: false },
      { id: 'unicode_baby', name: 'baby', animated: false, identifier: '👶', url: null, custom: false },
      { id: 'unicode_child', name: 'child', animated: false, identifier: '🧒', url: null, custom: false },
      { id: 'unicode_boy', name: 'boy', animated: false, identifier: '👦', url: null, custom: false },
      { id: 'unicode_girl', name: 'girl', animated: false, identifier: '👧', url: null, custom: false },
      { id: 'unicode_adult', name: 'adult', animated: false, identifier: '🧑', url: null, custom: false },
      { id: 'unicode_man', name: 'man', animated: false, identifier: '👨', url: null, custom: false },
      { id: 'unicode_woman', name: 'woman', animated: false, identifier: '👩', url: null, custom: false },
      { id: 'unicode_older_adult', name: 'older_adult', animated: false, identifier: '🧓', url: null, custom: false },
      { id: 'unicode_older_man', name: 'older_man', animated: false, identifier: '👴', url: null, custom: false },
      { id: 'unicode_older_woman', name: 'older_woman', animated: false, identifier: '👵', url: null, custom: false },
      { id: 'unicode_ninja', name: 'ninja', animated: false, identifier: '🥷', url: null, custom: false },
      { id: 'unicode_construction_worker', name: 'construction_worker', animated: false, identifier: '👷', url: null, custom: false },
      { id: 'unicode_guard', name: 'guard', animated: false, identifier: '💂', url: null, custom: false },
      { id: 'unicode_detective', name: 'detective', animated: false, identifier: '🕵️', url: null, custom: false },
      { id: 'unicode_health_worker', name: 'health_worker', animated: false, identifier: '🧑‍⚕️', url: null, custom: false },
      { id: 'unicode_student', name: 'student', animated: false, identifier: '🧑‍🎓', url: null, custom: false },
      { id: 'unicode_teacher', name: 'teacher', animated: false, identifier: '🧑‍🏫', url: null, custom: false },
      { id: 'unicode_technologist', name: 'technologist', animated: false, identifier: '🧑‍💻', url: null, custom: false },
      { id: 'unicode_artist', name: 'artist', animated: false, identifier: '🧑‍🎨', url: null, custom: false },
      { id: 'unicode_astronaut', name: 'astronaut', animated: false, identifier: '🧑‍🚀', url: null, custom: false },
      { id: 'unicode_firefighter', name: 'firefighter', animated: false, identifier: '🧑‍🚒', url: null, custom: false },
      { id: 'unicode_superhero', name: 'superhero', animated: false, identifier: '🦸', url: null, custom: false },
      { id: 'unicode_supervillain', name: 'supervillain', animated: false, identifier: '🦹', url: null, custom: false },
      { id: 'unicode_mage', name: 'mage', animated: false, identifier: '🧙', url: null, custom: false },
      { id: 'unicode_fairy', name: 'fairy', animated: false, identifier: '🧚', url: null, custom: false },
      { id: 'unicode_zombie', name: 'zombie', animated: false, identifier: '🧟', url: null, custom: false },
      { id: 'unicode_purple_heart', name: 'purple_heart', animated: false, identifier: '💜', url: null, custom: false },
      { id: 'unicode_red_heart', name: 'red_heart', animated: false, identifier: '❤️', url: null, custom: false },
      { id: 'unicode_orange_heart', name: 'orange_heart', animated: false, identifier: '🧡', url: null, custom: false },
      { id: 'unicode_yellow_heart', name: 'yellow_heart', animated: false, identifier: '💛', url: null, custom: false },
      { id: 'unicode_green_heart', name: 'green_heart', animated: false, identifier: '💚', url: null, custom: false },
      { id: 'unicode_blue_heart', name: 'blue_heart', animated: false, identifier: '💙', url: null, custom: false },
      { id: 'unicode_brown_heart', name: 'brown_heart', animated: false, identifier: '🤎', url: null, custom: false },
      { id: 'unicode_black_heart', name: 'black_heart', animated: false, identifier: '🖤', url: null, custom: false },
      { id: 'unicode_white_heart', name: 'white_heart', animated: false, identifier: '🤍', url: null, custom: false },
      { id: 'unicode_pink_heart', name: 'pink_heart', animated: false, identifier: '🩷', url: null, custom: false },
      { id: 'unicode_light_blue_heart', name: 'light_blue_heart', animated: false, identifier: '🩵', url: null, custom: false },
      { id: 'unicode_grey_heart', name: 'grey_heart', animated: false, identifier: '🩶', url: null, custom: false },
      { id: 'unicode_sparkling_heart', name: 'sparkling_heart', animated: false, identifier: '💖', url: null, custom: false },
      { id: 'unicode_heartpulse', name: 'heartpulse', animated: false, identifier: '💗', url: null, custom: false },
      { id: 'unicode_heartbeat', name: 'heartbeat', animated: false, identifier: '💓', url: null, custom: false },
      { id: 'unicode_revolving_hearts', name: 'revolving_hearts', animated: false, identifier: '💞', url: null, custom: false },
      { id: 'unicode_two_hearts', name: 'two_hearts', animated: false, identifier: '💕', url: null, custom: false },
      { id: 'unicode_heart_decoration', name: 'heart_decoration', animated: false, identifier: '💟', url: null, custom: false },
      { id: 'unicode_heart_exclamation', name: 'heart_exclamation', animated: false, identifier: '❣️', url: null, custom: false },
      { id: 'unicode_broken_heart', name: 'broken_heart', animated: false, identifier: '💔', url: null, custom: false },
      { id: 'unicode_heart_on_fire', name: 'heart_on_fire', animated: false, identifier: '❤️‍🔥', url: null, custom: false },
      { id: 'unicode_mending_heart', name: 'mending_heart', animated: false, identifier: '❤️‍🩹', url: null, custom: false },
      { id: 'unicode_cupid', name: 'cupid', animated: false, identifier: '💘', url: null, custom: false },
      { id: 'unicode_gift_heart', name: 'gift_heart', animated: false, identifier: '💝', url: null, custom: false },
      { id: 'unicode_kiss', name: 'kiss', animated: false, identifier: '💋', url: null, custom: false },
      { id: 'unicode_love_letter', name: 'love_letter', animated: false, identifier: '💌', url: null, custom: false },
      { id: 'unicode_dog', name: 'dog', animated: false, identifier: '🐶', url: null, custom: false },
      { id: 'unicode_cat', name: 'cat', animated: false, identifier: '🐱', url: null, custom: false },
      { id: 'unicode_mouse', name: 'mouse', animated: false, identifier: '🐭', url: null, custom: false },
      { id: 'unicode_hamster', name: 'hamster', animated: false, identifier: '🐹', url: null, custom: false },
      { id: 'unicode_rabbit', name: 'rabbit', animated: false, identifier: '🐰', url: null, custom: false },
      { id: 'unicode_fox', name: 'fox', animated: false, identifier: '🦊', url: null, custom: false },
      { id: 'unicode_bear', name: 'bear', animated: false, identifier: '🐻', url: null, custom: false },
      { id: 'unicode_panda_face', name: 'panda_face', animated: false, identifier: '🐼', url: null, custom: false },
      { id: 'unicode_koala', name: 'koala', animated: false, identifier: '🐨', url: null, custom: false },
      { id: 'unicode_tiger', name: 'tiger', animated: false, identifier: '🐯', url: null, custom: false },
      { id: 'unicode_lion', name: 'lion', animated: false, identifier: '🦁', url: null, custom: false },
      { id: 'unicode_cow', name: 'cow', animated: false, identifier: '🐮', url: null, custom: false },
      { id: 'unicode_pig', name: 'pig', animated: false, identifier: '🐷', url: null, custom: false },
      { id: 'unicode_frog', name: 'frog', animated: false, identifier: '🐸', url: null, custom: false },
      { id: 'unicode_monkey_face', name: 'monkey_face', animated: false, identifier: '🐵', url: null, custom: false },
      { id: 'unicode_see_no_evil', name: 'see_no_evil', animated: false, identifier: '🙈', url: null, custom: false },
      { id: 'unicode_hear_no_evil', name: 'hear_no_evil', animated: false, identifier: '🙉', url: null, custom: false },
      { id: 'unicode_speak_no_evil', name: 'speak_no_evil', animated: false, identifier: '🙊', url: null, custom: false },
      { id: 'unicode_chicken', name: 'chicken', animated: false, identifier: '🐔', url: null, custom: false },
      { id: 'unicode_penguin', name: 'penguin', animated: false, identifier: '🐧', url: null, custom: false },
      { id: 'unicode_bird', name: 'bird', animated: false, identifier: '🐦', url: null, custom: false },
      { id: 'unicode_eagle', name: 'eagle', animated: false, identifier: '🦅', url: null, custom: false },
      { id: 'unicode_owl', name: 'owl', animated: false, identifier: '🦉', url: null, custom: false },
      { id: 'unicode_bat', name: 'bat', animated: false, identifier: '🦇', url: null, custom: false },
      { id: 'unicode_wolf', name: 'wolf', animated: false, identifier: '🐺', url: null, custom: false },
      { id: 'unicode_unicorn', name: 'unicorn', animated: false, identifier: '🦄', url: null, custom: false },
      { id: 'unicode_bee', name: 'bee', animated: false, identifier: '🐝', url: null, custom: false },
      { id: 'unicode_butterfly', name: 'butterfly', animated: false, identifier: '🦋', url: null, custom: false },
      { id: 'unicode_snail', name: 'snail', animated: false, identifier: '🐌', url: null, custom: false },
      { id: 'unicode_bug', name: 'bug', animated: false, identifier: '🐛', url: null, custom: false },
      { id: 'unicode_ant', name: 'ant', animated: false, identifier: '🐜', url: null, custom: false },
      { id: 'unicode_spider', name: 'spider', animated: false, identifier: '🕷️', url: null, custom: false },
      { id: 'unicode_turtle', name: 'turtle', animated: false, identifier: '🐢', url: null, custom: false },
      { id: 'unicode_snake', name: 'snake', animated: false, identifier: '🐍', url: null, custom: false },
      { id: 'unicode_dragon_face', name: 'dragon_face', animated: false, identifier: '🐲', url: null, custom: false },
      { id: 'unicode_dragon', name: 'dragon', animated: false, identifier: '🐉', url: null, custom: false },
      { id: 'unicode_octopus', name: 'octopus', animated: false, identifier: '🐙', url: null, custom: false },
      { id: 'unicode_shark', name: 'shark', animated: false, identifier: '🦈', url: null, custom: false },
      { id: 'unicode_whale', name: 'whale', animated: false, identifier: '🐳', url: null, custom: false },
      { id: 'unicode_dolphin', name: 'dolphin', animated: false, identifier: '🐬', url: null, custom: false },
      { id: 'unicode_sunflower', name: 'sunflower', animated: false, identifier: '🌻', url: null, custom: false },
      { id: 'unicode_rose', name: 'rose', animated: false, identifier: '🌹', url: null, custom: false },
      { id: 'unicode_tulip', name: 'tulip', animated: false, identifier: '🌷', url: null, custom: false },
      { id: 'unicode_cherry_blossom', name: 'cherry_blossom', animated: false, identifier: '🌸', url: null, custom: false },
      { id: 'unicode_hibiscus', name: 'hibiscus', animated: false, identifier: '🌺', url: null, custom: false },
      { id: 'unicode_bouquet', name: 'bouquet', animated: false, identifier: '💐', url: null, custom: false },
      { id: 'unicode_seedling', name: 'seedling', animated: false, identifier: '🌱', url: null, custom: false },
      { id: 'unicode_herb', name: 'herb', animated: false, identifier: '🌿', url: null, custom: false },
      { id: 'unicode_shamrock', name: 'shamrock', animated: false, identifier: '☘️', url: null, custom: false },
      { id: 'unicode_four_leaf_clover', name: 'four_leaf_clover', animated: false, identifier: '🍀', url: null, custom: false },
      { id: 'unicode_fallen_leaf', name: 'fallen_leaf', animated: false, identifier: '🍂', url: null, custom: false },
      { id: 'unicode_maple_leaf', name: 'maple_leaf', animated: false, identifier: '🍁', url: null, custom: false },
      { id: 'unicode_cactus', name: 'cactus', animated: false, identifier: '🌵', url: null, custom: false },
      { id: 'unicode_palm_tree', name: 'palm_tree', animated: false, identifier: '🌴', url: null, custom: false },
      { id: 'unicode_evergreen_tree', name: 'evergreen_tree', animated: false, identifier: '🌲', url: null, custom: false },
      { id: 'unicode_deciduous_tree', name: 'deciduous_tree', animated: false, identifier: '🌳', url: null, custom: false },
      { id: 'unicode_mushroom', name: 'mushroom', animated: false, identifier: '🍄', url: null, custom: false },
      { id: 'unicode_earth_americas', name: 'earth_americas', animated: false, identifier: '🌎', url: null, custom: false },
      { id: 'unicode_earth_africa', name: 'earth_africa', animated: false, identifier: '🌍', url: null, custom: false },
      { id: 'unicode_earth_asia', name: 'earth_asia', animated: false, identifier: '🌏', url: null, custom: false },
      { id: 'unicode_rainbow', name: 'rainbow', animated: false, identifier: '🌈', url: null, custom: false },
      { id: 'unicode_sunny', name: 'sunny', animated: false, identifier: '☀️', url: null, custom: false },
      { id: 'unicode_cloud', name: 'cloud', animated: false, identifier: '☁️', url: null, custom: false },
      { id: 'unicode_snowflake', name: 'snowflake', animated: false, identifier: '❄️', url: null, custom: false },
      { id: 'unicode_umbrella', name: 'umbrella', animated: false, identifier: '☂️', url: null, custom: false },
      { id: 'unicode_ocean', name: 'ocean', animated: false, identifier: '🌊', url: null, custom: false },
      { id: 'unicode_apple', name: 'apple', animated: false, identifier: '🍎', url: null, custom: false },
      { id: 'unicode_green_apple', name: 'green_apple', animated: false, identifier: '🍏', url: null, custom: false },
      { id: 'unicode_pear', name: 'pear', animated: false, identifier: '🍐', url: null, custom: false },
      { id: 'unicode_tangerine', name: 'tangerine', animated: false, identifier: '🍊', url: null, custom: false },
      { id: 'unicode_lemon', name: 'lemon', animated: false, identifier: '🍋', url: null, custom: false },
      { id: 'unicode_banana', name: 'banana', animated: false, identifier: '🍌', url: null, custom: false },
      { id: 'unicode_watermelon', name: 'watermelon', animated: false, identifier: '🍉', url: null, custom: false },
      { id: 'unicode_grapes', name: 'grapes', animated: false, identifier: '🍇', url: null, custom: false },
      { id: 'unicode_strawberry', name: 'strawberry', animated: false, identifier: '🍓', url: null, custom: false },
      { id: 'unicode_blueberries', name: 'blueberries', animated: false, identifier: '🫐', url: null, custom: false },
      { id: 'unicode_peach', name: 'peach', animated: false, identifier: '🍑', url: null, custom: false },
      { id: 'unicode_mango', name: 'mango', animated: false, identifier: '🥭', url: null, custom: false },
      { id: 'unicode_pineapple', name: 'pineapple', animated: false, identifier: '🍍', url: null, custom: false },
      { id: 'unicode_coconut', name: 'coconut', animated: false, identifier: '🥥', url: null, custom: false },
      { id: 'unicode_avocado', name: 'avocado', animated: false, identifier: '🥑', url: null, custom: false },
      { id: 'unicode_hot_pepper', name: 'hot_pepper', animated: false, identifier: '🌶️', url: null, custom: false },
      { id: 'unicode_pizza', name: 'pizza', animated: false, identifier: '🍕', url: null, custom: false },
      { id: 'unicode_hamburger', name: 'hamburger', animated: false, identifier: '🍔', url: null, custom: false },
      { id: 'unicode_fries', name: 'fries', animated: false, identifier: '🍟', url: null, custom: false },
      { id: 'unicode_hotdog', name: 'hotdog', animated: false, identifier: '🌭', url: null, custom: false },
      { id: 'unicode_taco', name: 'taco', animated: false, identifier: '🌮', url: null, custom: false },
      { id: 'unicode_sushi', name: 'sushi', animated: false, identifier: '🍣', url: null, custom: false },
      { id: 'unicode_ramen', name: 'ramen', animated: false, identifier: '🍜', url: null, custom: false },
      { id: 'unicode_cookie', name: 'cookie', animated: false, identifier: '🍪', url: null, custom: false },
      { id: 'unicode_cake', name: 'cake', animated: false, identifier: '🎂', url: null, custom: false },
      { id: 'unicode_ice_cream', name: 'ice_cream', animated: false, identifier: '🍨', url: null, custom: false },
      { id: 'unicode_doughnut', name: 'doughnut', animated: false, identifier: '🍩', url: null, custom: false },
      { id: 'unicode_chocolate_bar', name: 'chocolate_bar', animated: false, identifier: '🍫', url: null, custom: false },
      { id: 'unicode_candy', name: 'candy', animated: false, identifier: '🍬', url: null, custom: false },
      { id: 'unicode_popcorn', name: 'popcorn', animated: false, identifier: '🍿', url: null, custom: false },
      { id: 'unicode_coffee', name: 'coffee', animated: false, identifier: '☕', url: null, custom: false },
      { id: 'unicode_tea', name: 'tea', animated: false, identifier: '🍵', url: null, custom: false },
      { id: 'unicode_beer', name: 'beer', animated: false, identifier: '🍺', url: null, custom: false },
      { id: 'unicode_wine_glass', name: 'wine_glass', animated: false, identifier: '🍷', url: null, custom: false },
      { id: 'unicode_tropical_drink', name: 'tropical_drink', animated: false, identifier: '🍹', url: null, custom: false },
      { id: 'unicode_champagne', name: 'champagne', animated: false, identifier: '🍾', url: null, custom: false },
      { id: 'unicode_sparkles', name: 'sparkles', animated: false, identifier: '✨', url: null, custom: false },
      { id: 'unicode_boom', name: 'boom', animated: false, identifier: '💥', url: null, custom: false },
      { id: 'unicode_zap', name: 'zap', animated: false, identifier: '⚡', url: null, custom: false },
      { id: 'unicode_dizzy', name: 'dizzy', animated: false, identifier: '💫', url: null, custom: false },
      { id: 'unicode_dart', name: 'dart', animated: false, identifier: '🎯', url: null, custom: false },
      { id: 'unicode_pushpin', name: 'pushpin', animated: false, identifier: '📌', url: null, custom: false },
      { id: 'unicode_bell', name: 'bell', animated: false, identifier: '🔔', url: null, custom: false },
      { id: 'unicode_mega', name: 'mega', animated: false, identifier: '📣', url: null, custom: false },
      { id: 'unicode_loudspeaker', name: 'loudspeaker', animated: false, identifier: '📢', url: null, custom: false },
      { id: 'unicode_bulb', name: 'bulb', animated: false, identifier: '💡', url: null, custom: false },
      { id: 'unicode_moneybag', name: 'moneybag', animated: false, identifier: '💰', url: null, custom: false },
      { id: 'unicode_money_with_wings', name: 'money_with_wings', animated: false, identifier: '💸', url: null, custom: false },
      { id: 'unicode_gem', name: 'gem', animated: false, identifier: '💎', url: null, custom: false },
      { id: 'unicode_crown', name: 'crown', animated: false, identifier: '👑', url: null, custom: false },
      { id: 'unicode_trophy', name: 'trophy', animated: false, identifier: '🏆', url: null, custom: false },
      { id: 'unicode_medal', name: 'medal', animated: false, identifier: '🏅', url: null, custom: false },
      { id: 'unicode_first_place', name: 'first_place', animated: false, identifier: '🥇', url: null, custom: false },
      { id: 'unicode_second_place', name: 'second_place', animated: false, identifier: '🥈', url: null, custom: false },
      { id: 'unicode_third_place', name: 'third_place', animated: false, identifier: '🥉', url: null, custom: false },
      { id: 'unicode_soccer', name: 'soccer', animated: false, identifier: '⚽', url: null, custom: false },
      { id: 'unicode_basketball', name: 'basketball', animated: false, identifier: '🏀', url: null, custom: false },
      { id: 'unicode_football', name: 'football', animated: false, identifier: '🏈', url: null, custom: false },
      { id: 'unicode_video_game', name: 'video_game', animated: false, identifier: '🎮', url: null, custom: false },
      { id: 'unicode_joystick', name: 'joystick', animated: false, identifier: '🕹️', url: null, custom: false },
      { id: 'unicode_musical_note', name: 'musical_note', animated: false, identifier: '🎵', url: null, custom: false },
      { id: 'unicode_notes', name: 'notes', animated: false, identifier: '🎶', url: null, custom: false },
      { id: 'unicode_microphone', name: 'microphone', animated: false, identifier: '🎤', url: null, custom: false },
      { id: 'unicode_headphones', name: 'headphones', animated: false, identifier: '🎧', url: null, custom: false },
      { id: 'unicode_guitar', name: 'guitar', animated: false, identifier: '🎸', url: null, custom: false },
      { id: 'unicode_camera', name: 'camera', animated: false, identifier: '📷', url: null, custom: false },
      { id: 'unicode_movie_camera', name: 'movie_camera', animated: false, identifier: '🎥', url: null, custom: false },
      { id: 'unicode_tv', name: 'tv', animated: false, identifier: '📺', url: null, custom: false },
      { id: 'unicode_computer', name: 'computer', animated: false, identifier: '💻', url: null, custom: false },
      { id: 'unicode_keyboard', name: 'keyboard', animated: false, identifier: '⌨️', url: null, custom: false },
      { id: 'unicode_iphone', name: 'iphone', animated: false, identifier: '📱', url: null, custom: false },
      { id: 'unicode_telephone', name: 'telephone', animated: false, identifier: '☎️', url: null, custom: false },
      { id: 'unicode_envelope', name: 'envelope', animated: false, identifier: '✉️', url: null, custom: false },
      { id: 'unicode_email', name: 'email', animated: false, identifier: '📧', url: null, custom: false },
      { id: 'unicode_mailbox', name: 'mailbox', animated: false, identifier: '📫', url: null, custom: false },
      { id: 'unicode_calendar', name: 'calendar', animated: false, identifier: '📅', url: null, custom: false },
      { id: 'unicode_clipboard', name: 'clipboard', animated: false, identifier: '📋', url: null, custom: false },
      { id: 'unicode_memo', name: 'memo', animated: false, identifier: '📝', url: null, custom: false },
      { id: 'unicode_pencil2', name: 'pencil2', animated: false, identifier: '✏️', url: null, custom: false },
      { id: 'unicode_pen_ballpoint', name: 'pen_ballpoint', animated: false, identifier: '🖊️', url: null, custom: false },
      { id: 'unicode_book', name: 'book', animated: false, identifier: '📖', url: null, custom: false },
      { id: 'unicode_books', name: 'books', animated: false, identifier: '📚', url: null, custom: false },
      { id: 'unicode_link', name: 'link', animated: false, identifier: '🔗', url: null, custom: false },
      { id: 'unicode_paperclip', name: 'paperclip', animated: false, identifier: '📎', url: null, custom: false },
      { id: 'unicode_scissors', name: 'scissors', animated: false, identifier: '✂️', url: null, custom: false },
      { id: 'unicode_lock', name: 'lock', animated: false, identifier: '🔒', url: null, custom: false },
      { id: 'unicode_unlock', name: 'unlock', animated: false, identifier: '🔓', url: null, custom: false },
      { id: 'unicode_key', name: 'key', animated: false, identifier: '🔑', url: null, custom: false },
      { id: 'unicode_hammer', name: 'hammer', animated: false, identifier: '🔨', url: null, custom: false },
      { id: 'unicode_wrench', name: 'wrench', animated: false, identifier: '🔧', url: null, custom: false },
      { id: 'unicode_gear', name: 'gear', animated: false, identifier: '⚙️', url: null, custom: false },
      { id: 'unicode_shield', name: 'shield', animated: false, identifier: '🛡️', url: null, custom: false },
      { id: 'unicode_bomb', name: 'bomb', animated: false, identifier: '💣', url: null, custom: false },
      { id: 'unicode_mag', name: 'mag', animated: false, identifier: '🔍', url: null, custom: false },
      { id: 'unicode_mag_right', name: 'mag_right', animated: false, identifier: '🔎', url: null, custom: false },
      { id: 'unicode_microscope', name: 'microscope', animated: false, identifier: '🔬', url: null, custom: false },
      { id: 'unicode_telescope', name: 'telescope', animated: false, identifier: '🔭', url: null, custom: false },
      { id: 'unicode_package', name: 'package', animated: false, identifier: '📦', url: null, custom: false },
      { id: 'unicode_gift', name: 'gift', animated: false, identifier: '🎁', url: null, custom: false },
      { id: 'unicode_ribbon', name: 'ribbon', animated: false, identifier: '🎀', url: null, custom: false },
      { id: 'unicode_balloon', name: 'balloon', animated: false, identifier: '🎈', url: null, custom: false },
      { id: 'unicode_confetti_ball', name: 'confetti_ball', animated: false, identifier: '🎊', url: null, custom: false },
      { id: 'unicode_crystal_ball', name: 'crystal_ball', animated: false, identifier: '🔮', url: null, custom: false },
      { id: 'unicode_hourglass', name: 'hourglass', animated: false, identifier: '⌛', url: null, custom: false },
      { id: 'unicode_alarm_clock', name: 'alarm_clock', animated: false, identifier: '⏰', url: null, custom: false },
      { id: 'unicode_stopwatch', name: 'stopwatch', animated: false, identifier: '⏱️', url: null, custom: false },
      { id: 'unicode_timer', name: 'timer', animated: false, identifier: '⏲️', url: null, custom: false },
      { id: 'unicode_car', name: 'car', animated: false, identifier: '🚗', url: null, custom: false },
      { id: 'unicode_taxi', name: 'taxi', animated: false, identifier: '🚕', url: null, custom: false },
      { id: 'unicode_bus', name: 'bus', animated: false, identifier: '🚌', url: null, custom: false },
      { id: 'unicode_ambulance', name: 'ambulance', animated: false, identifier: '🚑', url: null, custom: false },
      { id: 'unicode_fire_engine', name: 'fire_engine', animated: false, identifier: '🚒', url: null, custom: false },
      { id: 'unicode_police_car', name: 'police_car', animated: false, identifier: '🚓', url: null, custom: false },
      { id: 'unicode_motorcycle', name: 'motorcycle', animated: false, identifier: '🏍️', url: null, custom: false },
      { id: 'unicode_bicycle', name: 'bicycle', animated: false, identifier: '🚲', url: null, custom: false },
      { id: 'unicode_airplane', name: 'airplane', animated: false, identifier: '✈️', url: null, custom: false },
      { id: 'unicode_helicopter', name: 'helicopter', animated: false, identifier: '🚁', url: null, custom: false },
      { id: 'unicode_ship', name: 'ship', animated: false, identifier: '🚢', url: null, custom: false },
      { id: 'unicode_sailboat', name: 'sailboat', animated: false, identifier: '⛵', url: null, custom: false },
      { id: 'unicode_train', name: 'train', animated: false, identifier: '🚆', url: null, custom: false },
      { id: 'unicode_house', name: 'house', animated: false, identifier: '🏠', url: null, custom: false },
      { id: 'unicode_office', name: 'office', animated: false, identifier: '🏢', url: null, custom: false },
      { id: 'unicode_hospital', name: 'hospital', animated: false, identifier: '🏥', url: null, custom: false },
      { id: 'unicode_school', name: 'school', animated: false, identifier: '🏫', url: null, custom: false },
      { id: 'unicode_stadium', name: 'stadium', animated: false, identifier: '🏟️', url: null, custom: false },
      { id: 'unicode_tent', name: 'tent', animated: false, identifier: '⛺', url: null, custom: false },
      { id: 'unicode_camping', name: 'camping', animated: false, identifier: '🏕️', url: null, custom: false },
      { id: 'unicode_mountain', name: 'mountain', animated: false, identifier: '⛰️', url: null, custom: false },
      { id: 'unicode_volcano', name: 'volcano', animated: false, identifier: '🌋', url: null, custom: false },
      { id: 'unicode_beach', name: 'beach', animated: false, identifier: '🏖️', url: null, custom: false },
      { id: 'unicode_desert_island', name: 'desert_island', animated: false, identifier: '🏝️', url: null, custom: false },
      { id: 'unicode_statue_of_liberty', name: 'statue_of_liberty', animated: false, identifier: '🗽', url: null, custom: false },
      { id: 'unicode_tokyo_tower', name: 'tokyo_tower', animated: false, identifier: '🗼', url: null, custom: false },
      { id: 'unicode_check', name: 'check', animated: false, identifier: '✅', url: null, custom: false },
      { id: 'unicode_warning', name: 'warning', animated: false, identifier: '⚠️', url: null, custom: false },
      { id: 'unicode_no_entry', name: 'no_entry', animated: false, identifier: '⛔', url: null, custom: false },
      { id: 'unicode_prohibited', name: 'prohibited', animated: false, identifier: '🚫', url: null, custom: false },
      { id: 'unicode_question', name: 'question', animated: false, identifier: '❓', url: null, custom: false },
      { id: 'unicode_grey_question', name: 'grey_question', animated: false, identifier: '❔', url: null, custom: false },
      { id: 'unicode_exclamation', name: 'exclamation', animated: false, identifier: '❗', url: null, custom: false },
      { id: 'unicode_grey_exclamation', name: 'grey_exclamation', animated: false, identifier: '❕', url: null, custom: false },
      { id: 'unicode_bangbang', name: 'bangbang', animated: false, identifier: '‼️', url: null, custom: false },
      { id: 'unicode_interrobang', name: 'interrobang', animated: false, identifier: '⁉️', url: null, custom: false },
      { id: 'unicode_recycle', name: 'recycle', animated: false, identifier: '♻️', url: null, custom: false },
      { id: 'unicode_infinity', name: 'infinity', animated: false, identifier: '♾️', url: null, custom: false },
      { id: 'unicode_peace', name: 'peace', animated: false, identifier: '☮️', url: null, custom: false },
      { id: 'unicode_yin_yang', name: 'yin_yang', animated: false, identifier: '☯️', url: null, custom: false },
      { id: 'unicode_radioactive', name: 'radioactive', animated: false, identifier: '☢️', url: null, custom: false },
      { id: 'unicode_biohazard', name: 'biohazard', animated: false, identifier: '☣️', url: null, custom: false },
      { id: 'unicode_heavy_plus_sign', name: 'heavy_plus_sign', animated: false, identifier: '➕', url: null, custom: false },
      { id: 'unicode_heavy_minus_sign', name: 'heavy_minus_sign', animated: false, identifier: '➖', url: null, custom: false },
      { id: 'unicode_heavy_multiplication_x', name: 'heavy_multiplication_x', animated: false, identifier: '✖️', url: null, custom: false },
      { id: 'unicode_heavy_division_sign', name: 'heavy_division_sign', animated: false, identifier: '➗', url: null, custom: false },
      { id: 'unicode_heavy_check_mark', name: 'heavy_check_mark', animated: false, identifier: '✔️', url: null, custom: false },
      { id: 'unicode_ballot_box_with_check', name: 'ballot_box_with_check', animated: false, identifier: '☑️', url: null, custom: false },
      { id: 'unicode_arrow_right', name: 'arrow_right', animated: false, identifier: '➡️', url: null, custom: false },
      { id: 'unicode_arrow_left', name: 'arrow_left', animated: false, identifier: '⬅️', url: null, custom: false },
      { id: 'unicode_arrow_up', name: 'arrow_up', animated: false, identifier: '⬆️', url: null, custom: false },
      { id: 'unicode_arrow_down', name: 'arrow_down', animated: false, identifier: '⬇️', url: null, custom: false },
      { id: 'unicode_arrow_upper_right', name: 'arrow_upper_right', animated: false, identifier: '↗️', url: null, custom: false },
      { id: 'unicode_arrow_lower_right', name: 'arrow_lower_right', animated: false, identifier: '↘️', url: null, custom: false },
      { id: 'unicode_arrows_counterclockwise', name: 'arrows_counterclockwise', animated: false, identifier: '🔄', url: null, custom: false },
      { id: 'unicode_new', name: 'new', animated: false, identifier: '🆕', url: null, custom: false },
      { id: 'unicode_free', name: 'free', animated: false, identifier: '🆓', url: null, custom: false },
      { id: 'unicode_up', name: 'up', animated: false, identifier: '🆙', url: null, custom: false },
      { id: 'unicode_cool', name: 'cool', animated: false, identifier: '🆒', url: null, custom: false },
      { id: 'unicode_ok', name: 'ok', animated: false, identifier: '🆗', url: null, custom: false },
      { id: 'unicode_sos', name: 'sos', animated: false, identifier: '🆘', url: null, custom: false },
      { id: 'unicode_no_entry_sign', name: 'no_entry_sign', animated: false, identifier: '🚫', url: null, custom: false },
      { id: 'unicode_underage', name: 'underage', animated: false, identifier: '🔞', url: null, custom: false },
      { id: 'unicode_red_circle', name: 'red_circle', animated: false, identifier: '🔴', url: null, custom: false },
      { id: 'unicode_orange_circle', name: 'orange_circle', animated: false, identifier: '🟠', url: null, custom: false },
      { id: 'unicode_yellow_circle', name: 'yellow_circle', animated: false, identifier: '🟡', url: null, custom: false },
      { id: 'unicode_green_circle', name: 'green_circle', animated: false, identifier: '🟢', url: null, custom: false },
      { id: 'unicode_blue_circle', name: 'blue_circle', animated: false, identifier: '🔵', url: null, custom: false },
      { id: 'unicode_purple_circle', name: 'purple_circle', animated: false, identifier: '🟣', url: null, custom: false },
      { id: 'unicode_black_circle', name: 'black_circle', animated: false, identifier: '⚫', url: null, custom: false },
      { id: 'unicode_white_circle', name: 'white_circle', animated: false, identifier: '⚪', url: null, custom: false },
      { id: 'unicode_red_square', name: 'red_square', animated: false, identifier: '🟥', url: null, custom: false },
      { id: 'unicode_blue_square', name: 'blue_square', animated: false, identifier: '🟦', url: null, custom: false },
      { id: 'unicode_green_square', name: 'green_square', animated: false, identifier: '🟩', url: null, custom: false },
      { id: 'unicode_yellow_square', name: 'yellow_square', animated: false, identifier: '🟨', url: null, custom: false },
      { id: 'unicode_orange_square', name: 'orange_square', animated: false, identifier: '🟧', url: null, custom: false },
      { id: 'unicode_purple_square', name: 'purple_square', animated: false, identifier: '🟪', url: null, custom: false },
      { id: 'unicode_black_large_square', name: 'black_large_square', animated: false, identifier: '⬛', url: null, custom: false },
      { id: 'unicode_white_large_square', name: 'white_large_square', animated: false, identifier: '⬜', url: null, custom: false },
      { id: 'unicode_star_of_david', name: 'star_of_david', animated: false, identifier: '✡️', url: null, custom: false },
      { id: 'unicode_cross', name: 'cross', animated: false, identifier: '✝️', url: null, custom: false },
      { id: 'unicode_flag_br', name: 'flag_br', animated: false, identifier: '🇧🇷', url: null, custom: false },
      { id: 'unicode_flag_us', name: 'flag_us', animated: false, identifier: '🇺🇸', url: null, custom: false },
      { id: 'unicode_flag_gb', name: 'flag_gb', animated: false, identifier: '🇬🇧', url: null, custom: false },
      { id: 'unicode_flag_fr', name: 'flag_fr', animated: false, identifier: '🇫🇷', url: null, custom: false },
      { id: 'unicode_flag_de', name: 'flag_de', animated: false, identifier: '🇩🇪', url: null, custom: false },
      { id: 'unicode_flag_es', name: 'flag_es', animated: false, identifier: '🇪🇸', url: null, custom: false },
      { id: 'unicode_flag_it', name: 'flag_it', animated: false, identifier: '🇮🇹', url: null, custom: false },
      { id: 'unicode_flag_pt', name: 'flag_pt', animated: false, identifier: '🇵🇹', url: null, custom: false },
      { id: 'unicode_flag_jp', name: 'flag_jp', animated: false, identifier: '🇯🇵', url: null, custom: false },
      { id: 'unicode_flag_kr', name: 'flag_kr', animated: false, identifier: '🇰🇷', url: null, custom: false },
      { id: 'unicode_flag_cn', name: 'flag_cn', animated: false, identifier: '🇨🇳', url: null, custom: false },
      { id: 'unicode_flag_in', name: 'flag_in', animated: false, identifier: '🇮🇳', url: null, custom: false },
      { id: 'unicode_flag_ar', name: 'flag_ar', animated: false, identifier: '🇦🇷', url: null, custom: false },
      { id: 'unicode_flag_mx', name: 'flag_mx', animated: false, identifier: '🇲🇽', url: null, custom: false },
      { id: 'unicode_flag_ca', name: 'flag_ca', animated: false, identifier: '🇨🇦', url: null, custom: false },
      { id: 'unicode_flag_au', name: 'flag_au', animated: false, identifier: '🇦🇺', url: null, custom: false },
      { id: 'unicode_pirate_flag', name: 'pirate_flag', animated: false, identifier: '🏴‍☠️', url: null, custom: false },
      { id: 'unicode_checkered_flag', name: 'checkered_flag', animated: false, identifier: '🏁', url: null, custom: false },
      { id: 'unicode_triangular_flag_on_post', name: 'triangular_flag_on_post', animated: false, identifier: '🚩', url: null, custom: false },
      { id: 'unicode_rainbow_flag', name: 'rainbow_flag', animated: false, identifier: '🏳️‍🌈', url: null, custom: false },
      { id: 'unicode_white_flag', name: 'white_flag', animated: false, identifier: '🏳️', url: null, custom: false },
      { id: 'unicode_black_flag', name: 'black_flag', animated: false, identifier: '🏴', url: null, custom: false },
    ];

    // Combinar emojis Unicode primeiro, depois os custom do servidor
    const allEmojis = [...unicodeEmojis, ...customEmojisList];

    res.status(200).json({
      emojis: allEmojis,
      total: allEmojis.length
    });
  } catch (error) {
    console.error('Erro ao buscar emojis:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar a lista de emojis.' });
  }
}