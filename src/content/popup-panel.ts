import type { ExtractedTask, ScheduledTask, ConflictResult } from '../shared/types';
import { sendMessage } from './index';

export class PopupPanel {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private visible = false;
  private pendingTask: (ExtractedTask & { chatUrl: string }) | null = null;

  // ── Drag state ──
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panelStartX = 0;
  private panelStartY = 0;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'goofish-popup-host';
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.renderShell();

    // Listen for task extraction events
    document.addEventListener('goofish:taskExtracted', () => {
      this.pendingTask = window.__goofishPendingTask || null;
      if (this.pendingTask) {
        this.renderTask();
        this.show();
      }
    });

    // Listen for extraction failure events (e.g. missing API key)
    document.addEventListener('goofish:extractionFailed', ((e: CustomEvent) => {
      const error = e.detail?.error || 'Unknown error';
      this.renderSettings(error);
      this.show();
    }) as EventListener);

    // Listen for analyzing start — show loading state
    document.addEventListener('goofish:analyzing', () => {
      this.renderLoading();
      this.show();
    });

    // Drag-to-move via header handle
    this.setupDragHandlers();
  }

  show(): void {
    this.visible = true;
    this.host.style.display = 'block';
  }

  hide(): void {
    this.visible = false;
    this.host.style.display = 'none';
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.host);
    this.restorePosition();
  }

  // ── Drag ──

  private setupDragHandlers(): void {
    const header = this.shadow.querySelector('.header') as HTMLElement | null;
    if (!header) return;

    header.addEventListener('mousedown', this.onDragStart);
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  }

  private onDragStart = (e: MouseEvent): void => {
    // Don't start drag on the close button
    if ((e.target as HTMLElement).closest('#close-btn')) return;

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    const rect = this.host.getBoundingClientRect();
    this.panelStartX = rect.left;
    this.panelStartY = rect.top;

    // Switch from bottom/right to left/top positioning
    this.host.style.right = 'auto';
    this.host.style.bottom = 'auto';
    this.host.style.left = `${rect.left}px`;
    this.host.style.top = `${rect.top}px`;
  };

  private onDragMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    this.host.style.left = `${this.panelStartX + dx}px`;
    this.host.style.top = `${this.panelStartY + dy}px`;
  };

  private onDragEnd = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.savePosition();
  };

  private savePosition(): void {
    const rect = this.host.getBoundingClientRect();
    sessionStorage.setItem(
      'goofish-panel-pos',
      JSON.stringify({ left: rect.left, top: rect.top }),
    );
  }

  private restorePosition(): void {
    const saved = sessionStorage.getItem('goofish-panel-pos');
    if (!saved) return;
    try {
      const { left, top } = JSON.parse(saved);
      this.host.style.right = 'auto';
      this.host.style.bottom = 'auto';
      this.host.style.left = `${left}px`;
      this.host.style.top = `${top}px`;
    } catch { /* ignore */ }
  }

  // ── renderShell ──

  private renderShell(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed;
        bottom: 100px;
        right: 84px;
        width: 380px;
        max-height: 80vh;
        background: #1e1e2e;
        color: #cdd6f4;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        overflow-y: auto;
        display: none;
      }
      .header {
        padding: 16px;
        border-bottom: 1px solid #313244;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: grab;
        user-select: none;
      }
      .header:active { cursor: grabbing; }
      .header h3 { margin: 0; font-size: 16px; }
      .close-btn {
        background: none; border: none; color: #6c7086; font-size: 20px; cursor: pointer;
      }
      .body { padding: 16px; }
      .field { margin-bottom: 12px; }
      .field-label { font-size: 12px; color: #6c7086; margin-bottom: 4px; text-transform: uppercase; }
      .field-value { font-size: 14px; }
      .urgency-high { color: #f38ba8; }
      .urgency-medium { color: #f9e2af; }
      .urgency-low { color: #a6e3a1; }
      .conflict-banner {
        background: #3c1618; border: 1px solid #f38ba8; border-radius: 8px;
        padding: 12px; margin-top: 12px; color: #f38ba8;
      }
      .btn {
        padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer;
        font-size: 14px; font-weight: 600; margin-right: 8px;
      }
      .btn-primary { background: #cba6f7; color: #1e1e2e; }
      .btn-secondary { background: #313244; color: #cdd6f4; }
      .btn-full { width: 100%; margin-top: 12px; }
      .actions { margin-top: 16px; display: flex; }
      .empty-state { text-align: center; padding: 32px 16px; color: #6c7086; }
      .error-banner {
        background: #3c1618; border: 1px solid #f38ba8; border-radius: 8px;
        padding: 10px 12px; margin-bottom: 16px; color: #f38ba8; font-size: 13px;
      }
      .settings-input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #313244;
        border-radius: 8px;
        background: #11111b;
        color: #cdd6f4;
        font-size: 13px;
        outline: none;
        margin-bottom: 10px;
        box-sizing: border-box;
      }
      .settings-input:focus { border-color: #cba6f7; }
      .settings-label {
        display: block;
        font-size: 12px;
        color: #a6adc8;
        margin-bottom: 4px;
      }
      .status-msg {
        padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-top: 8px;
      }
      .status-msg.success { background: #1a3827; color: #a6e3a1; }
      .status-msg.error { background: #3c1618; color: #f38ba8; }
      .loading-spinner {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 40px 16px; gap: 16px;
      }
      .spinner {
        width: 36px; height: 36px;
        border: 3px solid #313244;
        border-top: 3px solid #cba6f7;
        border-radius: 50%;
        animation: goofish-spin 0.8s linear infinite;
      }
      @keyframes goofish-spin {
        to { transform: rotate(360deg); }
      }
      .loading-text { color: #a6adc8; font-size: 13px; }
    `;

    this.shadow.appendChild(style);

    const shell = document.createElement('div');
    shell.innerHTML = `
      <div class="header">
        <h3>🤖 Goofish Agent</h3>
        <button class="close-btn" id="close-btn">&times;</button>
      </div>
      <div class="body" id="panel-body">
        <div class="empty-state">
          <p>Click 🎣 on a Xianyu conversation to analyze it</p>
        </div>
      </div>
    `;
    this.shadow.appendChild(shell);

    this.shadow.getElementById('close-btn')?.addEventListener('click', () => this.hide());
  }

  // ── renderLoading ──

  renderLoading(): void {
    const body = this.shadow.getElementById('panel-body');
    if (!body) return;
    body.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <div class="loading-text">Analyzing conversation with AI...</div>
      </div>
    `;
  }

  // ── renderTask ──

  private renderTask(): void {
    if (!this.pendingTask) return;
    const t = this.pendingTask;
    const body = this.shadow.getElementById('panel-body');
    if (!body) return;

    const urgencyClass = `urgency-${t.urgency}`;

    body.innerHTML = `
      <div class="field">
        <div class="field-label">Buyer</div>
        <div class="field-value">${escapeHtml(t.buyerName)}</div>
      </div>
      <div class="field">
        <div class="field-label">Requirement</div>
        <div class="field-value">${escapeHtml(t.requirement)}</div>
      </div>
      <div class="field">
        <div class="field-label">Urgency</div>
        <div class="field-value ${urgencyClass}">${t.urgency.toUpperCase()} — ${escapeHtml(t.urgencyReason)}</div>
      </div>
      <div class="field">
        <div class="field-label">Price</div>
        <div class="field-value">¥${t.price ?? '—'}</div>
      </div>
      <div class="field">
        <div class="field-label">Est. Hours</div>
        <div class="field-value">${t.estimatedHours}h</div>
      </div>
      ${t.deadline ? `
      <div class="field">
        <div class="field-label">Deadline</div>
        <div class="field-value">${escapeHtml(t.deadline)}</div>
      </div>` : ''}
      ${t.specialNotes ? `
      <div class="field">
        <div class="field-label">Notes</div>
        <div class="field-value">${escapeHtml(t.specialNotes)}</div>
      </div>` : ''}
      <div class="actions">
        <button class="btn btn-primary" id="export-btn">Export to Notion →</button>
        <button class="btn btn-secondary" id="reanalyze-btn">Re-analyze</button>
      </div>
      <div id="conflict-area"></div>
    `;

    this.shadow.getElementById('export-btn')?.addEventListener('click', () => this.handleExport());
    this.shadow.getElementById('reanalyze-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new Event('goofish:reanalyze'));
    });
  }

  // ── renderSettings ──

  private renderSettings(error: string): void {
    const body = this.shadow.getElementById('panel-body');
    if (!body) return;

    body.innerHTML = `
      <div class="error-banner">⚠️ ${escapeHtml(error)}</div>
      <p style="font-size:13px;color:#a6adc8;margin-bottom:12px;">
        Configure your API keys below, then click <strong>Re-analyze</strong>.
      </p>

      <label class="settings-label" for="settings-openai-key">OpenAI API Key</label>
      <input class="settings-input" type="password" id="settings-openai-key" placeholder="sk-..." autocomplete="off" />

      <label class="settings-label" for="settings-openai-base-url">OpenAI Base URL</label>
      <input class="settings-input" type="text" id="settings-openai-base-url" placeholder="https://api.openai.com/v1" autocomplete="off" />

      <label class="settings-label" for="settings-ai-model">AI Model</label>
      <input class="settings-input" type="text" id="settings-ai-model" placeholder="gpt-4o-mini" autocomplete="off" />

      <label class="settings-label" for="settings-notion-token">Notion Integration Token</label>
      <input class="settings-input" type="password" id="settings-notion-token" placeholder="ntn-..." autocomplete="off" />

      <label class="settings-label" for="settings-notion-db-id">Notion Database ID</label>
      <input class="settings-input" type="text" id="settings-notion-db-id" placeholder="Your database ID" />

      <div id="settings-status"></div>

      <button class="btn btn-primary btn-full" id="settings-save-btn">💾 Save Settings</button>
      <button class="btn btn-secondary btn-full" id="settings-reanalyze-btn" style="margin-top:8px;">🔄 Re-analyze</button>
    `;

    // Load current settings
    this.loadSettingsIntoForm();

    // Save handler
    this.shadow.getElementById('settings-save-btn')?.addEventListener('click', () => this.handleSaveSettings());

    // Re-analyze handler
    this.shadow.getElementById('settings-reanalyze-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new Event('goofish:reanalyze'));
    });
  }

  private async loadSettingsIntoForm(): Promise<void> {
    try {
      const res = await sendMessage<Record<string, string>>('GET_SETTINGS', null);
      if (res.success && res.data) {
        const s = res.data as Record<string, string>;
        this.setInputValue('settings-openai-key', s.openaiApiKey || '');
        this.setInputValue('settings-openai-base-url', s.openaiBaseUrl || '');
        this.setInputValue('settings-ai-model', s.aiModel || '');
        this.setInputValue('settings-notion-token', s.notionToken || '');
        this.setInputValue('settings-notion-db-id', s.notionDatabaseId || '');
      }
    } catch {
      // settings will remain empty
    }
  }

  private setInputValue(id: string, value: string): void {
    const el = this.shadow.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = value;
  }

  private getInputValue(id: string): string {
    const el = this.shadow.getElementById(id) as HTMLInputElement | null;
    return el?.value?.trim() || '';
  }

  private async handleSaveSettings(): Promise<void> {
    const statusEl = this.shadow.getElementById('settings-status');
    try {
      const res = await sendMessage('SAVE_SETTINGS', {
        openaiApiKey: this.getInputValue('settings-openai-key'),
        openaiBaseUrl: this.getInputValue('settings-openai-base-url'),
        aiModel: this.getInputValue('settings-ai-model'),
        notionToken: this.getInputValue('settings-notion-token'),
        notionDatabaseId: this.getInputValue('settings-notion-db-id'),
      });
      if (res.success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">✓ Settings saved! Click Re-analyze below.</div>';
      } else {
        if (statusEl) statusEl.innerHTML = `<div class="status-msg error">✗ ${escapeHtml(res.error || 'Save failed')}</div>`;
      }
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<div class="status-msg error">✗ ${escapeHtml(String(err))}</div>`;
    }
  }

  // ── handleExport ──

  private async handleExport(): Promise<void> {
    if (!this.pendingTask) return;
    const t = this.pendingTask;

    try {
      // Step 1: Find optimal slot
      const slotRes = await sendMessage<{ start: string; end: string }>('FIND_OPTIMAL_SLOT', {
        durationHours: t.estimatedHours,
      });
      if (!slotRes.success || !slotRes.data) {
        this.showError('Failed to find available time slot');
        return;
      }

      const { start, end } = slotRes.data;
      const taskDate = new Date(start).toISOString().split('T')[0]!;

      // Step 2: Check for conflicts
      const conflictRes = await sendMessage<ConflictResult>('DETECT_CONFLICTS', {
        newTaskStart: start,
        newTaskEnd: end,
      });

      if (conflictRes.success && conflictRes.data?.hasConflict) {
        this.showConflict(conflictRes.data);
        return;
      }

      // Step 3: Build ScheduledTask and sync to Notion
      const scheduledTask: ScheduledTask = {
        id: crypto.randomUUID(),
        buyerName: t.buyerName,
        requirement: t.requirement,
        urgency: t.urgency,
        urgencyReason: t.urgencyReason,
        price: t.price,
        estimatedHours: t.estimatedHours,
        deadline: t.deadline,
        specialNotes: t.specialNotes,
        status: 'scheduled',
        scheduledStart: start,
        scheduledEnd: end,
        date: taskDate,
        chatUrl: t.chatUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const syncRes = await sendMessage<{ pageId: string }>('SYNC_TO_NOTION', { task: scheduledTask });
      if (syncRes.success) {
        this.showSuccess('Task synced to Notion!');
        this.pendingTask = null;
      } else {
        this.showError(syncRes.error || 'Sync failed');
      }
    } catch (err) {
      this.showError(String(err));
    }
  }

  private showConflict(conflict: ConflictResult): void {
    const area = this.shadow.getElementById('conflict-area');
    if (!area) return;
    const taskNames = conflict.conflictingTasks
      .map((t) => `${t.buyerName} - ${t.requirement}`)
      .join(', ');
    area.innerHTML = `
      <div class="conflict-banner">
        ⚠️ Conflict: overlaps with ${escapeHtml(taskNames)}
        <div style="margin-top: 8px;">
          <button class="btn btn-primary" id="resolve-btn">Resolve (auto-reschedule)</button>
          <button class="btn btn-secondary" id="ignore-btn">Ignore & Export Anyway</button>
        </div>
      </div>
    `;
  }

  private showSuccess(msg: string): void {
    const area = this.shadow.getElementById('conflict-area');
    if (!area) return;
    area.innerHTML = `<div style="color:#a6e3a1;padding:8px 0;">✓ ${escapeHtml(msg)}</div>`;
    setTimeout(() => this.hide(), 2000);
  }

  private showError(msg: string): void {
    const area = this.shadow.getElementById('conflict-area');
    if (!area) return;
    area.innerHTML = `<div style="color:#f38ba8;padding:8px 0;">✗ ${escapeHtml(msg)}</div>`;
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
