import type { ExtractedTask } from '../shared/types';
import { buildPrompt } from '../shared/prompts';
import { getSettings } from './storage-manager';
import { DEFAULT_OPENAI_BASE_URL, AI_TIMEOUT_MS, AI_MAX_RETRIES } from '../shared/constants';

export async function extractTask(chatMessages: string): Promise<ExtractedTask> {
  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please set it in the extension popup.');
  }

  // Normalize: strip trailing slashes, then append /chat/completions
  const baseUrl = (settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/chat/completions`;
  const prompt = buildPrompt(chatMessages);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const body = {
        model: settings.aiModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Always reply with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.openaiApiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 && attempt < AI_MAX_RETRIES) {
          // Rate limited — exponential backoff
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        // Include response body in error for easier debugging
        let errorBody = '';
        try { errorBody = await response.text(); } catch { /* ignore */ }
        throw new Error(
          `AI API error ${response.status}: ${response.statusText}${errorBody ? ' — ' + errorBody.slice(0, 300) : ''}`,
        );
      }

      const data = await response.json();
      const rawContent: string = data.choices?.[0]?.message?.content || '';
      return parseAIResponse(rawContent);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes('AI API error: 4')) {
        // Don't retry 4xx errors (except 429 handled above)
        throw lastError;
      }
      if (attempt < AI_MAX_RETRIES) {
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error('AI extraction failed after retries');
}

function parseAIResponse(raw: string): ExtractedTask {
  // Strip markdown code fences
  let jsonStr = raw.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try to extract first JSON object if there's extra text
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      buyerName: String(parsed.buyerName || ''),
      requirement: String(parsed.requirement || ''),
      urgency: validateUrgency(parsed.urgency),
      urgencyReason: String(parsed.urgencyReason || ''),
      price: typeof parsed.price === 'number' ? parsed.price : null,
      estimatedHours: Math.max(0.5, Number(parsed.estimatedHours) || 1),
      deadline: parsed.deadline || null,
      specialNotes: parsed.specialNotes || null,
    };
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${raw.slice(0, 200)}`);
  }
}

function validateUrgency(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium'; // safe default
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
