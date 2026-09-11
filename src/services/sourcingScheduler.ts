import { getSourcingService } from './productSourcingService';

class SourcingScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private nextRunAt: string | null = null;
  private lastRunAt: string | null = null;

  async start(): Promise<void> {
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

    const jitter = Math.random() * 60000;
    const delayMs = intervalSeconds * 1000 + jitter;
    this.nextRunAt = new Date(Date.now() + delayMs).toISOString();

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

    try {
      const service = getSourcingService();
      const result = await service.runSourcing();
      console.log(`[Scheduler] Run completed:`, result);
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
    isScheduled: boolean;
  } {
    return {
      isRunning: this.isRunning,
      nextRunAt: this.nextRunAt,
      lastRunAt: this.lastRunAt,
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
