/**
 * Deduplica chamadas de processamento de thread no Slack.
 *
 * Cenario: o usuario abre uma thread postando uma mensagem-pai e em
 * seguida varias replies em sequencia. Cada reply chega como um evento
 * `message` separado. Sem debounce, o bot processaria a thread toda
 * vez que uma reply chegasse, gastando chamadas pra Slack e OpenAI.
 *
 * Solucao: na primeira reply, agenda um timer pra processar dali a N
 * segundos. Replies subsequentes durante a janela so estendem (ou
 * mantem) esse timer. Quando o timer dispara, processa uma vez so.
 *
 * Tambem garante idempotencia: depois de processar a thread, marca
 * como ja-vista numa janela curta — assim eventos atrasados que
 * vierem depois nao re-disparam.
 */
export class ThreadDebouncer {
  private pending = new Map<string, NodeJS.Timeout>();
  private recentlyProcessed = new Map<string, number>();
  private readonly RECENT_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly delayMs: number,
    private readonly onFire: (key: string) => Promise<void>
  ) {}

  /** Chave canonica: `channel:threadTs`. */
  static keyFor(channel: string, threadTs: string): string {
    return `${channel}:${threadTs}`;
  }

  schedule(channel: string, threadTs: string): void {
    const key = ThreadDebouncer.keyFor(channel, threadTs);

    // Ja processou agora ha pouco? Nao reprocessa.
    const lastAt = this.recentlyProcessed.get(key);
    if (lastAt && Date.now() - lastAt < this.RECENT_TTL_MS) return;

    // Ja tem timer agendado? Mantem (nao reseta — primeiro evento ganha).
    if (this.pending.has(key)) return;

    const timer = setTimeout(async () => {
      this.pending.delete(key);
      try {
        await this.onFire(key);
      } catch (err) {
        console.error('[ThreadDebouncer] onFire error:', err);
      } finally {
        this.recentlyProcessed.set(key, Date.now());
        this.gcRecent();
      }
    }, this.delayMs);

    // setTimeout em Node retorna um Timeout, mas no tipo declarado o
    // unref e opcional. Soltar a ref permite o processo encerrar mesmo
    // com timers pendentes (graceful shutdown).
    timer.unref?.();
    this.pending.set(key, timer);
  }

  private gcRecent(): void {
    const cutoff = Date.now() - this.RECENT_TTL_MS;
    for (const [k, v] of this.recentlyProcessed) {
      if (v < cutoff) this.recentlyProcessed.delete(k);
    }
  }

  shutdown(): void {
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
  }
}
