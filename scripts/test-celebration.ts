/**
 * Script de teste isolado pro modulo celebrations.
 *
 * Envia uma celebracao de teste como DM pra um usuario do Slack que voce
 * escolher. Nao depende de nenhuma env do bot em prod — voce passa o token
 * e o user ID na linha de comando.
 *
 * Uso:
 *   pnpm tsx scripts/test-celebration.ts \
 *     --token=xoxb-... \
 *     --to=U01ABC2DEF \
 *     [--type=birthday|anniversary] \
 *     [--name="Seu Nome"] \
 *     [--years=3] \
 *     [--image-generator=https://image-generator-gold.vercel.app]
 *
 * Defaults:
 *   --type=birthday
 *   --name=fetched de users.info do destinatario
 *   --image-generator=https://image-generator-gold.vercel.app
 *
 * Scopes necessarios no app Slack:
 *   chat:write, users:read
 *   (im:write nao e estritamente obrigatorio em workspaces recentes —
 *    chat.postMessage com user ID como channel abre o DM automaticamente)
 */

import { WebClient } from '@slack/web-api';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const PT_MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

async function main() {
  const token = arg('token');
  const to = arg('to');
  const type = (arg('type') || 'birthday') as 'birthday' | 'anniversary';
  const customName = arg('name');
  const yearsRaw = arg('years');
  const imageGenerator = arg('image-generator') || 'https://image-generator-gold.vercel.app';

  if (!token) {
    console.error('Faltou --token=xoxb-...');
    process.exit(1);
  }
  if (!to) {
    console.error('Faltou --to=U... (seu Slack user ID).');
    console.error('Pra pegar: clique no seu nome no Slack > "Copy member ID".');
    process.exit(1);
  }
  if (type !== 'birthday' && type !== 'anniversary') {
    console.error('--type tem que ser "birthday" ou "anniversary".');
    process.exit(1);
  }

  const slack = new WebClient(token);

  // 1. Buscar perfil do usuario alvo (nome e avatar)
  console.log(`Buscando perfil do usuario ${to}...`);
  const info = await slack.users.info({ user: to });
  const profile = (info.user as { profile?: Record<string, string | undefined>; real_name?: string } | undefined);
  const displayName = customName || profile?.real_name || 'Booster Teste';
  const avatarUrl =
    profile?.profile?.image_original ||
    profile?.profile?.image_512 ||
    profile?.profile?.image_192;
  if (!avatarUrl) {
    console.error('Usuario nao tem foto de perfil no Slack.');
    process.exit(1);
  }

  // 2. Montar URL da imagem
  const today = new Date();
  let imageUrl: string;
  let text: string;

  if (type === 'birthday') {
    const url = new URL('/api/images/birthday', imageGenerator);
    url.searchParams.set('name', displayName);
    url.searchParams.set('avatar_url', avatarUrl);
    url.searchParams.set('day', String(today.getDate()).padStart(2, '0'));
    url.searchParams.set('month', PT_MONTH_ABBR[today.getMonth()]);
    imageUrl = url.toString();
    text = [
      `🎉 (TESTE) Vamos celebrar o aniversariante do dia: <@${to}>!`,
      'Que este novo ciclo seja cheio de realizações e alegrias.',
      'Parabéns e feliz aniversário! 💜🚀',
    ].join('\n');
  } else {
    const years = parseInt(yearsRaw || '3') || 3;
    const url = new URL('/api/images/company-anniversary', imageGenerator);
    url.searchParams.set('name', displayName);
    url.searchParams.set('avatar_url', avatarUrl);
    const adm = new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
    url.searchParams.set(
      'date',
      `${String(adm.getDate()).padStart(2, '0')}/${String(adm.getMonth() + 1).padStart(2, '0')}/${adm.getFullYear()}`
    );
    url.searchParams.set('years', String(years));
    imageUrl = url.toString();
    text = [
      `🚀 (TESTE) Hoje o <@${to}> completa ${years} ${years === 1 ? 'ano' : 'anos'} de Rocketseat!`,
      'Parabéns! É uma alegria poder contar com um profissional como você.',
      '#JuntosNoPróximoNível 💜',
    ].join('\n');
  }

  console.log('Imagem gerada:', imageUrl);

  // 3. Postar como DM (channel = user ID abre IM automatico)
  console.log(`Enviando DM pro usuario ${to}...`);

  // Mensagem com URL anexada — Slack faz unfurl async (mais tolerante a
  // cold starts do image-generator que o block image, que tem timeout curto).
  const textWithLink = `${text}\n${imageUrl}`;

  const result = await slack.chat.postMessage({
    channel: to,
    text: textWithLink,
    unfurl_links: true,
    unfurl_media: true,
  });

  console.log('Enviado!', { channel: result.channel, ts: result.ts });
}

main().catch((err) => {
  console.error('Erro:', err?.data || err);
  process.exit(1);
});
