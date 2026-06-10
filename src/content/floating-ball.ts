import { t } from '../shared/i18n';

export class FloatingBall {
  private el: HTMLDivElement;
  private shadow: ShadowRoot;
  private badgeEl: HTMLSpanElement;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private ballStartX = 0;
  private ballStartY = 0;
  private onClickCallback: (() => void) | null = null;
  private contextMenuEl: HTMLDivElement;
  private onGenerateCallback: (() => void) | null = null;
  private onConfigCallback: (() => void) | null = null;

  constructor() {
    // Create host element
    this.el = document.createElement('div');
    this.el.id = 'goofish-floating-ball-host';

    // Attach shadow DOM
    this.shadow = this.el.attachShadow({ mode: 'closed' });

    // Badge element (created first so styles reference it)
    this.badgeEl = document.createElement('span');
    this.badgeEl.id = 'badge';

    // Build shadow DOM
    this.shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 100px;
          right: 24px;
          z-index: 2147483647;
          cursor: grab;
          user-select: none;
        }
        :host(:active) {
          cursor: grabbing;
        }
        .ball {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #D4352B;
          box-shadow: 0 2px 12px rgba(212, 53, 43, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
          transition: transform 0.2s;
          position: relative;
        }
        .ball:hover {
          transform: scale(1.08);
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        #badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #D4352B;
          color: white;
          font-size: 11px;
          font-weight: bold;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        #badge.visible {
          display: flex;
        }
        #ctx-generate:hover,
        #ctx-settings:hover {
          background: #F5F0E8;
          color: #D4352B;
        }
      </style>
      <div class="ball" title="${t('ballTitle')}">
        🎣
        ${this.badgeEl.outerHTML}
      </div>
    `;

    // Get reference to badge in shadow DOM
    const badgeInShadow = this.shadow.getElementById('badge') as HTMLSpanElement;
    if (badgeInShadow) this.badgeEl = badgeInShadow;

    // Build context menu
    this.contextMenuEl = document.createElement('div');
    this.contextMenuEl.id = 'context-menu';
    this.contextMenuEl.style.cssText =
      'display:none;position:fixed;z-index:2147483648;background:#FFFFFF;border:1px solid #E8E0D5;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);padding:4px 0;min-width:160px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;';

    const generateBtn = document.createElement('button');
    generateBtn.id = 'ctx-generate';
    generateBtn.style.cssText =
      'display:block;width:100%;padding:8px 14px;border:none;background:none;cursor:pointer;text-align:left;color:#1C1917;font-size:13px;';
    generateBtn.textContent = t('ctxMenuGenerate');

    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'ctx-settings';
    settingsBtn.style.cssText =
      'display:block;width:100%;padding:8px 14px;border:none;background:none;cursor:pointer;text-align:left;color:#1C1917;font-size:13px;';
    settingsBtn.textContent = t('ctxMenuConfig');

    // Menu button click handlers
    generateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.contextMenuEl.style.display = 'none';
      this.onGenerateCallback?.();
    });

    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.contextMenuEl.style.display = 'none';
      this.onConfigCallback?.();
    });

    this.contextMenuEl.appendChild(generateBtn);
    this.contextMenuEl.appendChild(settingsBtn);
    this.shadow.appendChild(this.contextMenuEl);

    // Event listeners
    this.el.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    this.el.addEventListener('click', this.onClick);
    this.el.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
  }

  setBadge(count: number): void {
    this.badgeEl.textContent = String(count);
    if (count > 0) {
      this.badgeEl.classList.add('visible');
    } else {
      this.badgeEl.classList.remove('visible');
    }
  }

  setLoading(loading: boolean): void {
    const ball = this.shadow.querySelector('.ball') as HTMLElement | null;
    if (!ball) return;
    if (loading) {
      ball.style.opacity = '0.6';
      ball.style.pointerEvents = 'none';
      ball.style.animation = 'pulse 1.5s ease-in-out infinite';
    } else {
      ball.style.opacity = '1';
      ball.style.pointerEvents = 'auto';
      ball.style.animation = '';
    }
  }

  onBallClick(callback: () => void): void {
    this.onClickCallback = callback;
  }

  onGenerateClick(callback: () => void): void {
    this.onGenerateCallback = callback;
  }

  onConfigClick(callback: () => void): void {
    this.onConfigCallback = callback;
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
    // Restore saved position
    const saved = sessionStorage.getItem('goofish-ball-pos');
    if (saved) {
      try {
        const { x, y } = JSON.parse(saved);
        this.el.style.right = 'auto';
        this.el.style.bottom = 'auto';
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
      } catch { /* ignore */ }
    }
  }

  private savePosition(): void {
    const rect = this.el.getBoundingClientRect();
    sessionStorage.setItem(
      'goofish-ball-pos',
      JSON.stringify({ x: rect.left, y: rect.top }),
    );
  }

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 160;
    let x = e.clientX;
    let y = e.clientY;

    // Flip to left if near right edge
    if (x + menuWidth > window.innerWidth) {
      x = e.clientX - menuWidth;
    }

    // Flip above if near bottom edge
    // Estimate menu height ~ 80px (two buttons)
    const estimatedMenuHeight = 80;
    if (y + estimatedMenuHeight > window.innerHeight) {
      y = e.clientY - estimatedMenuHeight;
    }

    this.contextMenuEl.style.left = `${x}px`;
    this.contextMenuEl.style.top = `${y}px`;
    this.contextMenuEl.style.display = 'block';
  };

  private onDocumentClick = (): void => {
    this.contextMenuEl.style.display = 'none';
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.contextMenuEl.style.display = 'none';
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    const rect = this.el.getBoundingClientRect();
    this.ballStartX = rect.left;
    this.ballStartY = rect.top;
    this.el.style.right = 'auto';
    this.el.style.bottom = 'auto';
    this.el.style.left = `${rect.left}px`;
    this.el.style.top = `${rect.top}px`;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    this.el.style.left = `${this.ballStartX + dx}px`;
    this.el.style.top = `${this.ballStartY + dy}px`;
  };

  private onMouseUp = (): void => {
    if (this.isDragging) {
      this.isDragging = false;
      this.savePosition();
    }
  };

  private onClick = (e: MouseEvent): void => {
    // Only fire click if we didn't just drag
    const dx = Math.abs(e.clientX - this.dragStartX);
    const dy = Math.abs(e.clientY - this.dragStartY);
    if (dx < 5 && dy < 5) {
      this.onClickCallback?.();
    }
  };
}
