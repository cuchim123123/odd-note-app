import { AsyncLocalStorage } from 'async_hooks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const txStorage = new AsyncLocalStorage<any>();
