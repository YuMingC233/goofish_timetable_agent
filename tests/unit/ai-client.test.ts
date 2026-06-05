import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractTask } from '../../src/background/ai-client';

// Mock chrome.storage.local for API key
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((keys: string | string[] | null) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        if (key === 'goofish_settings') {
          return Promise.resolve({
            goofish_settings: {
              openaiApiKey: 'sk-test-key',
              aiModel: 'gpt-4o-mini',
              aiProvider: 'openai',
            },
          });
        }
        return Promise.resolve({});
      }),
    },
  },
});

const VALID_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          buyerName: '张三',
          requirement: 'Logo设计，3稿，极简风格',
          urgency: 'high',
          urgencyReason: '买家说"周五前"',
          price: 350,
          estimatedHours: 4,
          deadline: '2026-06-06T00:00:00.000Z',
          specialNotes: null,
        }),
      },
    },
  ],
};

describe('extractTask', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts structured task from valid LLM response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    } as Response);

    const result = await extractTask('Buyer: 这个能做吗？周五前\nSeller: 可以，加急+50');
    expect(result.buyerName).toBe('张三');
    expect(result.requirement).toBe('Logo设计，3稿，极简风格');
    expect(result.urgency).toBe('high');
    expect(result.price).toBe(350);
    expect(result.estimatedHours).toBe(4);
  });

  it('strips markdown code fences from LLM response', async () => {
    const markdownResponse = {
      choices: [
        {
          message: {
            content: '```json\n' + JSON.stringify({
              buyerName: '李四',
              requirement: '海报设计',
              urgency: 'medium',
              urgencyReason: '这周内',
              price: 200,
              estimatedHours: 3,
              deadline: null,
              specialNotes: null,
            }) + '\n```',
          },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(markdownResponse),
    } as Response);

    const result = await extractTask('test conversation');
    expect(result.buyerName).toBe('李四');
  });

  it('throws error on malformed JSON response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'not valid json at all {{{' } }],
      }),
    } as Response);

    await expect(extractTask('test')).rejects.toThrow('Failed to parse AI response');
  });

  it('throws error on HTTP error response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    await expect(extractTask('test')).rejects.toThrow(/AI API error 401:/);
  });

  it('uses custom openaiBaseUrl from settings when configured', async () => {
    const customBaseUrl = 'https://my-proxy.example.com/v1';
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(() =>
            Promise.resolve({
              goofish_settings: {
                openaiApiKey: 'sk-test-key',
                aiModel: 'gpt-4o-mini',
                aiProvider: 'openai',
                openaiBaseUrl: customBaseUrl,
              },
            }),
          ),
        },
      },
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    } as Response);

    await extractTask('test conversation');

    expect(fetchSpy).toHaveBeenCalled();
    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toBe(`${customBaseUrl}/chat/completions`);
  });

  it('uses default OpenAI URL when openaiBaseUrl is not configured', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(() =>
            Promise.resolve({
              goofish_settings: {
                openaiApiKey: 'sk-test-key',
                aiModel: 'gpt-4o-mini',
                aiProvider: 'openai',
              },
            }),
          ),
        },
      },
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    } as Response);

    await extractTask('test conversation');

    expect(fetchSpy).toHaveBeenCalled();
    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toBe('https://api.openai.com/v1/chat/completions');
  });
});
