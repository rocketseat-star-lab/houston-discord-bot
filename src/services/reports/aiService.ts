import { embed, generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export interface ThreadAnalysis {
  problem: string;
  solution: string;
  category: "bug" | "config" | "other";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-large"),
    value: text,
  });

  return embedding;
}

export async function analyzeThreadForSolution(
  threadMessages: string
): Promise<ThreadAnalysis> {
  const prompt = `Analise esta thread de suporte do Discord e extraia as seguintes informações EM PORTUGUÊS:

1. **Problem**: Qual problema foi relatado? (2-3 frases no máximo, em português)
2. **Solution**: Como foi resolvido? Se não foi resolvido, escreva "Não resolvido" (2-3 frases no máximo, em português)
3. **Category**: Classifique como: "bug", "config", ou "other"

Mensagens da thread:
${threadMessages}

Responda APENAS com um objeto JSON neste formato exato (com os textos em português):
{
  "problem": "...",
  "solution": "...",
  "category": "bug" | "config" | "other"
}`;

  const { text } = await generateText({
    model: openai("gpt-4-turbo-preview"),
    temperature: 0.3,
    prompt,
  });

  const cleaned = text.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
  const parsed = JSON.parse(cleaned);

  if (!parsed.problem || !parsed.solution || !parsed.category) {
    throw new Error("Invalid AI response: missing required fields");
  }

  const validCategories = ["bug", "config", "other"];
  if (!validCategories.includes(parsed.category)) {
    parsed.category = "other";
  }

  return parsed as ThreadAnalysis;
}

export async function summarizeThread(threadMessages: string): Promise<string> {
  const prompt = `Crie um resumo conciso desta thread de suporte do Discord focando APENAS na DESCRIÇÃO DO PROBLEMA (o que o usuário descreveu?) em 2-3 frases, EM PORTUGUÊS.

IMPORTANTE: Inclua detalhes técnicos específicos que ajudam a identificar o problema:
- Nomes de features, telas, ou áreas do produto afetadas
- Códigos de erro, mensagens de erro, ou sintomas específicos
- Termos técnicos relevantes ao problema (APIs, serviços, componentes, etc.)
- Contexto sobre o que o usuário estava tentando fazer

NÃO mencione detalhes da solução como o problema foi corrigido, mudanças de código, ou detalhes de deploy. Foque em O QUE deu errado, não em COMO foi resolvido.

Mensagens da thread:
${threadMessages}

Responda APENAS com o texto do resumo focando no PROBLEMA/ISSUE, não na solução. Resposta em português.`;

  const { text } = await generateText({
    model: openai("gpt-4-turbo-preview"),
    temperature: 0.3,
    prompt,
  });

  return text.trim();
}

export async function summarizeQuery(queryText: string): Promise<string> {
  const prompt = `Extraia a descrição central do problema deste report do usuário em 1-2 frases, EM PORTUGUÊS.

Foque em:
- Qual issue ou erro específico está sendo reportado
- Inclua quaisquer termos técnicos, nomes de features, mensagens de erro mencionadas
- Remova saudações, formalidades e contexto irrelevante

Texto do usuário:
${queryText}

Responda APENAS com a descrição do problema extraída. Resposta em português.`;

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    temperature: 0.2,
    prompt,
  });

  return text.trim();
}
