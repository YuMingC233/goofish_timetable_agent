import type { AppSettings, BackgroundResponse } from '../shared/types';

const form = document.getElementById('settings-form') as HTMLFormElement;
const openaiKeyInput = document.getElementById('openai-key') as HTMLInputElement;
const openaiBaseUrlInput = document.getElementById('openai-base-url') as HTMLInputElement;
const aiModelInput = document.getElementById('ai-model') as HTMLInputElement;
const notionTokenInput = document.getElementById('notion-token') as HTMLInputElement;
const notionDbIdInput = document.getElementById('notion-db-id') as HTMLInputElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

async function loadSettings(): Promise<void> {
  try {
    const bg = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS', payload: null });
    if (bg.success && bg.data) {
      const settings = bg.data as AppSettings;
      openaiKeyInput.value = settings.openaiApiKey || '';
      openaiBaseUrlInput.value = settings.openaiBaseUrl || '';
      aiModelInput.value = settings.aiModel || '';
      notionTokenInput.value = settings.notionToken || '';
      notionDbIdInput.value = settings.notionDatabaseId || '';
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function showStatus(message: string, type: 'success' | 'error'): void {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = 'status hidden';
  }, 3000);
}

form.addEventListener('submit', async (e: Event) => {
  e.preventDefault();

  try {
    const bg: BackgroundResponse = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: {
        openaiApiKey: openaiKeyInput.value.trim(),
        openaiBaseUrl: openaiBaseUrlInput.value.trim(),
        aiModel: aiModelInput.value.trim(),
        notionToken: notionTokenInput.value.trim(),
        notionDatabaseId: notionDbIdInput.value.trim(),
      },
    });

    if (bg.success) {
      showStatus('✓ Settings saved!', 'success');
    } else {
      showStatus(`✗ ${bg.error || 'Failed to save'}`, 'error');
    }
  } catch (err) {
    showStatus(`✗ ${String(err)}`, 'error');
  }
});

// Load on open
loadSettings();
