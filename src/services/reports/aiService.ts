import { embed, generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export interface ThreadAnalysis {
  problem: string;
  solution: string;
  category: "bug" | "config" | "other";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });

  return embedding;
}

export async function analyzeThreadForSolution(
  threadMessages: string
): Promise<ThreadAnalysis> {
  const prompt = `Analyze this Discord support thread and extract the following information:

1. **Problem**: What issue was reported? (2-3 sentences max)
2. **Solution**: How was it resolved? If not resolved, state "Not resolved" (2-3 sentences max)
3. **Category**: Classify as one of: "bug", "config", or "other"

Thread messages:
${threadMessages}

Respond ONLY with a JSON object in this exact format:
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
  const prompt = `Create a concise summary of this Discord support thread FOCUSING ONLY on the PROBLEM DESCRIPTION (what did the user describe?) in 2-3 sentences.

Do NOT mention solution specifics like database, API, connection pool, cache, code changes, deployment details, or other technical implementation details. Focus on the functional issue from the user's perspective without technical jargon.

Thread messages:
${threadMessages}

Respond ONLY with the summary text focusing on PROBLEM/ISSUE not solution.`;

  const { text } = await generateText({
    model: openai("gpt-4-turbo-preview"),
    temperature: 0.3,
    prompt,
  });

  return text.trim();
}
