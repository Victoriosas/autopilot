import { getSourcingService } from './productSourcingService';

const TWENTY_FOUR_HOURS = 86400;

class SourcingScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private nextRunAt: string | null = null;
  private lastRunAt: string | null = null;
  private lastVerifyAt: string | null = null;

  async start(): Promise<void> {
    const service = getSourcingService();
    const config = await service.getConfig();

    if (!config.isEnabled) {
      console.log('[Scheduler] Disabled by config');
      return;
    }

    this.scheduleNext(config.scheduleInterval);
    console.log(`[Scheduler] Started, interval: ${config.scheduleInterval}s (24h)`);
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
      await this.scheduleNext(intervalSeconds);
    }, delayMs);
  }

  async execute(): Promise<void> {
    if (this.isRunning) {
      console.log('[Scheduler] Already running, skipping');
      return;
    }

    this.isRunning = true;
    this.lastRunAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      const service = getSourcingService();

      // Step 1: Get category counts before sourcing
      const countsBefore = await service.getProductsCountByCategory();
      console.log('[Scheduler] Category counts before sourcing:', countsBefore);

      // Step 2: Run sourcing (will prioritize categories with <30)
      const result = await service.runSourcing();
      console.log('[Scheduler] Sourcing completed:', result);

      // Step 3: Get category counts after sourcing
      const countsAfter = await service.getProductsCountByCategory();
      console.log('[Scheduler] Category counts after sourcing:', countsAfter);

      // Step 4: Verify published products (stock, price)
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
  } {
    return {
      isRunning: this.isRunning,
      nextRunAt: this.nextRunAt,
      lastRunAt: this.lastRunAt,
      lastVerifyAt: this.lastVerifyAt,
      isScheduled: this.intervalId !== null,
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
