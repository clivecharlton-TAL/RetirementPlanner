import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import Anthropic from '@anthropic-ai/sdk';

function configPath(): string {
  return path.join(app.getPath('userData'), 'ai-config.json');
}

export function loadApiKey(): string {
  try {
    const data = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    return data.apiKey ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  fs.writeFileSync(configPath(), JSON.stringify({ apiKey: key }));
}

export function hasApiKey(): boolean {
  return loadApiKey().length > 0;
}

function buildSystemPrompt(contextJson: string): string {
  return `You are a financial planning assistant embedded in RetirementPlanner, a South African retirement planning application.

You have full access to the user's current financial data below. Answer questions, analyse the plan, flag risks, and suggest improvements. Be concise and practical.

South African context:
- Currency is ZAR (R). Format large numbers as "R 1.2M" or "R 450,000".
- Retirement Annuities (RAs) have SA lump sum tax applied to 1/3 at retirement (brackets: 0% ≤R550K, 18% to R770K, 27% to R1.155M, 36% above).
- FSCA regulates living annuity drawdown: 2.5% min / 17.5% max per year.
- Drawdown income and net rental income are taxed at the user's marginal tax rate.
- "Cone of uncertainty" shows pessimistic/optimistic scenarios based on ± inputs.

CURRENT FINANCIAL DATA:
${contextJson}`;
}

export async function streamAiResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  contextJson: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> {
  const key = loadApiKey();
  if (!key) {
    onError('No API key configured. Enter your Anthropic API key in the chat panel.');
    return;
  }

  const anthropic = new Anthropic({ apiKey: key });

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: buildSystemPrompt(contextJson),
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        onChunk(event.delta.text);
      }
    }
    onDone();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    onError(`API error: ${msg}`);
  }
}
