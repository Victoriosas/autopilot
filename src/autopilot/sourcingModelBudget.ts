import { AsyncLocalStorage } from 'node:async_hooks';
export const sourcingModelBudget = new AsyncLocalStorage<{beforeCall:()=>Promise<void>;deadline:number}>();
