import type { AppSettings, AppSettingsPartial, ScheduledTask } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';

export async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  const stored = result[STORAGE_KEYS.SETTINGS] as Partial<AppSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(partial: AppSettingsPartial): Promise<void> {
  const current = await getSettings();
  const merged = { ...current, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: merged });
}

export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCHEDULED_TASKS);
  return (result[STORAGE_KEYS.SCHEDULED_TASKS] as ScheduledTask[]) || [];
}

export async function addScheduledTask(task: ScheduledTask): Promise<void> {
  const tasks = await getScheduledTasks();
  tasks.push(task);
  await chrome.storage.local.set({ [STORAGE_KEYS.SCHEDULED_TASKS]: tasks });
}
