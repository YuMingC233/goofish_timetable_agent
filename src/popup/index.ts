import type { AppSettings, BackgroundResponse } from '../shared/types';
import { t } from '../shared/i18n';

const form = document.getElementById('settings-form') as HTMLFormElement;
const openaiKeyInput = document.getElementById('openai-key') as HTMLInputElement;
const openaiBaseUrlInput = document.getElementById('openai-base-url') as HTMLInputElement;
const aiModelInput = document.getElementById('ai-model') as HTMLInputElement;
const notionTokenInput = document.getElementById('notion-token') as HTMLInputElement;
const notionDbIdInput = document.getElementById('notion-db-id') as HTMLInputElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const labelOpenAiKey = document.getElementById('label-openai-key') as HTMLLabelElement;
const labelOpenAiBaseUrl = document.getElementById('label-openai-base-url') as HTMLLabelElement;
const labelAiModel = document.getElementById('label-ai-model') as HTMLLabelElement;
const labelNotionToken = document.getElementById('label-notion-token') as HTMLLabelElement;
const labelNotionDbId = document.getElementById('label-notion-db-id') as HTMLLabelElement;
const saveBtn = document.getElementById('popup-save-btn') as HTMLButtonElement;

function localizeUI(): void {
  document.title = t('popupPageTitle');

  const heading = document.getElementById('popup-heading');
  if (heading) heading.textContent = t('popupHeading');

  const subtitle = document.getElementById('popup-subtitle');
  if (subtitle) subtitle.textContent = t('popupSubtitle');

  labelOpenAiKey.textContent = t('labelOpenAiKey');
  labelOpenAiBaseUrl.textContent = t('labelOpenAiBaseUrl');
  labelAiModel.textContent = t('labelAiModel');
  labelNotionToken.textContent = t('labelNotionToken');
  labelNotionDbId.textContent = t('labelNotionDbId');

  saveBtn.textContent = t('popupBtnSave');

  openaiKeyInput.placeholder = t('placeholderOpenAiKey');
  openaiBaseUrlInput.placeholder = t('placeholderOpenAiBaseUrl');
  aiModelInput.placeholder = t('placeholderAiModel');
  notionTokenInput.placeholder = t('placeholderNotionToken');
  notionDbIdInput.placeholder = t('placeholderNotionDbId');
}

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
      showStatus(t('popupStatusSaved'), 'success');
    } else {
      showStatus(`✗ ${bg.error || t('popupStatusSaveError')}`, 'error');
    }
  } catch (err) {
    showStatus(`✗ ${String(err)}`, 'error');
  }
});

// Load on open
localizeUI();
loadSettings();
