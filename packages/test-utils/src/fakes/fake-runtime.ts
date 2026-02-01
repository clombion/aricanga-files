/**
 * FakeRuntime - Test double for InkRuntime
 *
 * Implements the interface used by systems without requiring inkjs.
 * Stores captured state for test assertions.
 */
export class FakeRuntime {
  public variables = new Map<string, unknown>();
  public capturedDelay = 0;
  public capturedAlerts: Array<{ chatId: string; preview: string }> = [];
  public awaitingData = false;

  // Story-like properties
  public canContinue = false;
  public currentChoices: Array<{ text: string; index: number }> = [];
  public currentTags: string[] = [];

  /**
   * Get a variable value
   */
  getVariable(name: string): unknown {
    return this.variables.get(name);
  }

  /**
   * Set a variable value (test helper)
   */
  setVariable(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  /**
   * Set captured delay (called by delay_next external function)
   */
  setCapturedDelay(ms: number): void {
    this.capturedDelay = ms;
  }

  /**
   * Get and clear captured delay
   */
  getCapturedDelay(): number {
    const delay = this.capturedDelay;
    this.capturedDelay = 0;
    return delay;
  }

  /**
   * Add captured alert
   */
  addCapturedAlert(alert: { chatId: string; preview: string }): void {
    this.capturedAlerts.push(alert);
  }

  /**
   * Get and clear captured alerts
   */
  getCapturedAlerts(): Array<{ chatId: string; preview: string }> {
    const alerts = [...this.capturedAlerts];
    this.capturedAlerts = [];
    return alerts;
  }

  /**
   * Get current knot name (stub)
   */
  getCurrentKnot(): string | null {
    return null;
  }

  /**
   * Get current path (stub)
   */
  getCurrentPath(): string | null {
    return null;
  }

  /**
   * Clear all state (useful between tests)
   */
  clear(): void {
    this.variables.clear();
    this.capturedDelay = 0;
    this.capturedAlerts = [];
    this.awaitingData = false;
    this.canContinue = false;
    this.currentChoices = [];
    this.currentTags = [];
  }
}
