// Debug Panel - Development tool for inspecting and manipulating ink state
// Only visible when ?debug=true or window.DEBUG_MODE is set

export class DebugPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._controller = null;
    this._expanded = false;
    this._updateInterval = null;
  }

  connectedCallback() {
    // Only show in debug mode
    if (!this.isDebugMode()) {
      this.style.display = 'none';
      return;
    }

    this.render();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  disconnectedCallback() {
    this.stopAutoRefresh();
  }

  isDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('debug') || window.DEBUG_MODE === true; // allowed
  }

  /**
   * Set the game controller reference
   * @param {object} controller - GameController instance
   */
  setController(controller) {
    this._controller = controller;
    this.refresh();
  }

  startAutoRefresh() {
    // Refresh state display every 500ms when expanded
    this._updateInterval = setInterval(() => {
      if (this._expanded) {
        this.refreshVariablesDisplay();
      }
    }, 500);
  }

  stopAutoRefresh() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  setupEventListeners() {
    // Toggle panel
    this.shadowRoot
      .querySelector('.toggle-btn')
      ?.addEventListener('click', () => {
        this._expanded = !this._expanded;
        this.render();
      });
  }

  refresh() {
    if (this._expanded) {
      this.render();
    }
  }

  refreshVariablesDisplay() {
    const container = this.shadowRoot.querySelector('.variables-list');
    if (!container || !this._controller) return;

    const vars = this._controller.getVariables();
    const varList = this.getInterestingVariables(vars);

    container.innerHTML = varList
      .map(
        ([name, value]) => `
      <div class="var-row">
        <span class="var-name">${name}</span>
        <span class="var-value ${typeof value}">${this.formatValue(value)}</span>
        ${
          typeof value === 'boolean'
            ? `
          <button class="toggle-var" data-var="${name}" data-value="${!value}">
            ${value ? 'OFF' : 'ON'}
          </button>
        `
            : ''
        }
      </div>
    `,
      )
      .join('');

    // Wire toggle buttons
    container.querySelectorAll('.toggle-var').forEach((btn) => {
      btn.addEventListener('click', () => {
        const varName = btn.dataset.var;
        const newValue = btn.dataset.value === 'true';
        this.setVariable(varName, newValue);
      });
    });
  }

  getInterestingVariables(vars) {
    const interesting = [
      'current_chat',
      'game_phase',
      'seen_announcement',
      'player_agreed',
      'draft_sent',
      'article_published',
      'research_started',
      'research_complete',
      'spectre_contacted',
      'agreed_to_meet',
    ];

    const result = [];
    for (const name of interesting) {
      try {
        const value = vars[name];
        if (value !== undefined) {
          result.push([name, value]);
        }
      } catch (_e) {
        /* ignore */
      }
    }
    return result;
  }

  formatValue(value) {
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return String(value);
  }

  setVariable(name, value) {
    if (!this._controller) return;
    try {
      this._controller.setVariable(name, value);
      this.refreshVariablesDisplay();
    } catch (e) {
      console.error(`Failed to set ${name}:`, e);
    }
  }

  /**
   * Quick actions for testing specific states
   */
  getQuickActions() {
    return [
      {
        label: 'Skip to Draft',
        action: () => {
          this.setVariable('seen_announcement', true);
          this.setVariable('player_agreed', true);
          this.setVariable('research_complete', true);
        },
      },
      {
        label: 'Skip to Publish',
        action: () => {
          this.setVariable('seen_announcement', true);
          this.setVariable('player_agreed', true);
          this.setVariable('draft_sent', true);
          this.setVariable('article_published', true);
        },
      },
      {
        label: 'Reset All',
        action: () => {
          const flags = [
            'seen_announcement',
            'player_agreed',
            'draft_sent',
            'article_published',
            'research_started',
            'research_complete',
            'spectre_contacted',
            'agreed_to_meet',
          ];
          for (const f of flags) {
            this.setVariable(f, false);
          }
        },
      },
    ];
  }

  render() {
    const isExpanded = this._expanded;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 10px;
          right: 10px;
          z-index: 99999;
          font-family: monospace;
          font-size: 11px;
        }

        .toggle-btn {
          background: rgba(0, 0, 0, 0.8);
          color: #0f0;
          border: 1px solid #0f0;
          padding: 6px 10px;
          cursor: pointer;
          border-radius: 4px;
        }

        .toggle-btn:hover {
          background: rgba(0, 50, 0, 0.9);
        }

        .panel {
          display: ${isExpanded ? 'block' : 'none'};
          background: rgba(0, 0, 0, 0.95);
          border: 1px solid #0f0;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 5px;
          max-width: 300px;
          max-height: 400px;
          overflow-y: auto;
          color: #0f0;
        }

        .panel-header {
          font-weight: bold;
          margin-bottom: 8px;
          padding-bottom: 5px;
          border-bottom: 1px solid #0a0;
        }

        .section {
          margin-bottom: 10px;
        }

        .section-title {
          color: #0a0;
          margin-bottom: 4px;
        }

        .variables-list {
          max-height: 150px;
          overflow-y: auto;
        }

        .var-row {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 2px 0;
        }

        .var-name {
          color: #0f0;
          flex: 1;
        }

        .var-value {
          color: #ff0;
        }

        .var-value.boolean {
          color: ${isExpanded ? '#0ff' : '#ff0'};
        }

        .var-value.string {
          color: #f90;
        }

        .toggle-var {
          background: #030;
          color: #0f0;
          border: 1px solid #0f0;
          padding: 1px 4px;
          cursor: pointer;
          font-size: 9px;
        }

        .toggle-var:hover {
          background: #050;
        }

        .quick-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .quick-btn {
          background: #030;
          color: #0f0;
          border: 1px solid #0f0;
          padding: 3px 6px;
          cursor: pointer;
          font-size: 9px;
        }

        .quick-btn:hover {
          background: #050;
        }

        .no-controller {
          color: #f00;
          font-style: italic;
        }
      </style>

      <div class="panel">
        <div class="panel-header">Debug Panel</div>

        ${
          this._controller
            ? `
          <div class="section">
            <div class="section-title">Variables</div>
            <div class="variables-list"></div>
          </div>

          <div class="section">
            <div class="section-title">Quick Actions</div>
            <div class="quick-actions">
              ${this.getQuickActions()
                .map(
                  (a, i) => `
                <button class="quick-btn" data-action="${i}">${a.label}</button>
              `,
                )
                .join('')}
            </div>
          </div>
        `
            : `
          <div class="no-controller">Controller not set</div>
        `
        }
      </div>

      <button class="toggle-btn">
        ${isExpanded ? 'Hide Debug' : 'Debug'}
      </button>
    `;

    // Setup event listeners after render
    this.shadowRoot
      .querySelector('.toggle-btn')
      ?.addEventListener('click', () => {
        this._expanded = !this._expanded;
        this.render();
      });

    // Wire quick action buttons
    this.shadowRoot.querySelectorAll('.quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const actionIndex = parseInt(btn.dataset.action, 10);
        this.getQuickActions()[actionIndex]?.action();
      });
    });

    // Initial variable display
    if (isExpanded) {
      this.refreshVariablesDisplay();
    }
  }
}

customElements.define('debug-panel', DebugPanel);
