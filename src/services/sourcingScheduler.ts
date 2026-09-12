import { getSourcingService } from './productSourcingService';

class SourcingScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private nextRunAt: string | null = null;
  private lastRunAt: string | null = null;
  private lastVerifyAt: string | null = null;

  async start(): Promise<void> {
    if (process.env.AUTOPILOT_LEGACY_SOURCING_ENABLED !== 'true') {
      console.log('[Scheduler] Legacy sourcing scheduler disabled by safety policy');
      return;
    }

    const service = getSourcingService();
    const config = await service.getConfig();

    if (!config.isEnabled) {
      console.log('[Scheduler] Disabled by config');
      return;
    }

    this.scheduleNext(config.scheduleInterval);
    console.log(`[Scheduler] Started, interval: ${config.scheduleInterval}s`);
  }

  private scheduleNext(intervalSeconds: number): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }

    const jitter = Math.random() * 120000;
    const delayMs = intervalSeconds * 1000 + jitter;
    this.nextRunAt = new Date(Date.now() + delayMs).toISOString();

    console.log(`[Scheduler] Next run at: ${this.nextRunAt}`);

    this.intervalId = setTimeout(async () => {
      await this.execute();
      this.scheduleNext(intervalSeconds);
    }, delayMs);
  }

  async execute(): Promise<void> {
    if (process.env.AUTOPILOT_LEGACY_SOURCING_ENABLED !== 'true') {
      console.log('[Scheduler] Execution blocked: AUTOPILOT_LEGACY_SOURCING_ENABLED is not true');
      return;
    }

    if (this.isRunning) {
      console.log('[Scheduler] Already running, skipping');
      return;
    }

    this.isRunning = true;
    this.lastRunAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      const service = getSourcingService();
      const countsBefore = await service.getProductsCountByCategory();
      console.log('[Scheduler] Category counts before sourcing:', countsBefore);

      const result = await service.runSourcing();
      console.log('[Scheduler] Sourcing completed:', result);

      const countsAfter = await service.getProductsCountByCategory();
      console.log('[Scheduler] Category counts after sourcing:', countsAfter);

      console.log('[Scheduler] Starting verification of published products...');
      const verifyResult = await service.verifyPublishedProducts();
      this.lastVerifyAt = new Date().toISOString();
      console.log('[Scheduler] Verification completed:', verifyResult);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Scheduler] Full cycle completed in ${duration}s`);
    } catch (err) {
      console.error('[Scheduler] Run failed:', err);
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.nextRunAt = null;
    console.log('[Scheduler] Stopped');
  }

  getStatus(): {
    isRunning: boolean;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastVerifyAt: string | null;
    isScheduled: boolean;
    legacySourcingEnabled: boolean;
  } {
    return {
      isRunning: this.isRunning,
      nextRunAt: this.nextRunAt,
      lastRunAt: this.lastRunAt,
      lastVerifyAt: this.lastVerifyAt,
      isScheduled: this.intervalId !== null,
      legacySourcingEnabled: process.env.AUTOPILOT_LEGACY_SOURCING_ENABLED === 'true',
    };
  }
}

let schedulerInstance: SourcingScheduler | null = null;

export function getSourcingScheduler(): SourcingScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new SourcingScheduler();
  }
  return schedulerInstance;
}

export default SourcingScheduler;
