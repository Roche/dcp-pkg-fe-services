import { BehaviorSubject } from 'rxjs';
import { logger } from '@open-dcp/utilities';
import { deepEqual } from '../helpers/deepEqual';
import { WatchableStoreConfig } from '../types/watchableStoreConfig';
import { VERSION, COMPATIBILITY } from '../version';

export type SubscriberCallback<T = any> = (value: T) => void;

export class Store<State extends Record<string, any> = Record<string, any>> { // Add default type parameter
  private state: { [K in keyof State]: BehaviorSubject<State[K] | null | undefined> };
  private subscribers: Record<string, SubscriberCallback[]>;
  protected fullStateSubscribers: SubscriberCallback<any>[]; // Change to any[]
  private config?: WatchableStoreConfig<State>;
  private readonly version: string = VERSION;
  private readonly compatibility: string[] = COMPATIBILITY;

  constructor(initialState: State = {} as State, config?: WatchableStoreConfig<State>) {
    this.state = {} as { [K in keyof State]: BehaviorSubject<State[K] | null | undefined> };

    Object.keys(initialState).forEach((key) => {
      this.state[key as keyof State] = new BehaviorSubject<State[keyof State] | null | undefined>(
        initialState[key as keyof State] ?? null
      );
    });

    this.subscribers = {};
    this.fullStateSubscribers = [];
    this.config = config;
  }

  isCompatibleWith(otherVersion: string): boolean {
    return this.compatibility.includes(otherVersion);
  }

  getVersion(): string {
    return this.version;
  }

  getConfig(): WatchableStoreConfig<State> | undefined {
    return this.config;
  }

  getState(): State {
    const state = {} as Record<string, any>;
    Object.keys(this.state).forEach((key) => {
      state[key] = this.state[key as keyof State].getValue();
    });
    return state as State;
  }

  update<K extends keyof State>(key: K, value: State[K] | null, persistentStorageKey: string | null = null): void {
    const subject = this.state[key];
    if (!subject) {
      logger.error('State for key "' + String(key) + '" not initialized');
      return;
    }

    const currentValue = subject.getValue();
    const newValue = value ?? null;

    if (!deepEqual(currentValue, newValue)) {
      this.state[key].next(value);
      this.notifySubscribers(key, value);
      this.notifyFullStateSubscribers();

      if (persistentStorageKey) {
        this.persistToLocalStorage(key, value, persistentStorageKey);
      }
    }
  }

  /**
   * Migrates subscribers to another store instance.
   * - Key-specific subscribers: ✅ Always migrated
   * - Full-state subscribers: ✅ Migrated if source store tracks them
   */
  migrateSubscribers(targetStore: Store<State>) {
    let keyCount = 0;
    let fullStateCount = 0;

    // Migrate key-specific subscribers
    Object.keys(this.subscribers).forEach((key) => {
      const callbacks = this.subscribers[key];
      callbacks.forEach((callback) => {
        targetStore.subscribe(key as keyof State, callback);
        keyCount++;
      });
    });

    // Migrate full-state subscribers
    if (this.fullStateSubscribers && this.fullStateSubscribers.length > 0) {
      this.fullStateSubscribers.forEach((callback) => {
        targetStore.subscribe(callback as SubscriberCallback<State>); // Type assertion
        fullStateCount++;
      });
    }

    logger.log(
      `✅ Migrated ${keyCount} key-specific subscriber(s) and ${fullStateCount} full-state subscriber(s)`
    );
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  private persistToLocalStorage<K extends keyof State>(key: K, value: State[K] | null, persistentStorageKey: string) {
    const parts = persistentStorageKey.split('.');
    const storageKey = parts[0];
    const nestedPath = parts.slice(1).join('.');

    const existingRaw = localStorage.getItem(storageKey);
    let existingObj: Record<string, any> = {};

    if (existingRaw) {
      try {
        existingObj = JSON.parse(existingRaw);
      } catch {
        existingObj = {};
      }
    }

    if (nestedPath) {
      this.setNestedValue(existingObj, nestedPath, value);
    } else {
      existingObj[key as string] = value;
    }

    localStorage.setItem(storageKey, JSON.stringify(existingObj));
  }

  subscribe<K extends keyof State>(
    keyOrCallback: K | SubscriberCallback<State>,
    callback?: SubscriberCallback<State[K]>
  ): () => void {
    if (typeof keyOrCallback === 'function') {
      const stateCallback = keyOrCallback as SubscriberCallback<State>;
      this.fullStateSubscribers.push(stateCallback);
      stateCallback(this.getState());

      const unsubscribeFunctions = Object.keys(this.state).map((key) =>
        this.subscribe(key as keyof State, () => {
          stateCallback(this.getState());
        })
      );

      return () => {
        this.fullStateSubscribers = this.fullStateSubscribers.filter(
          (cb) => cb !== stateCallback
        );
        unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
      };
    } else if (callback) {
      const key = keyOrCallback as K;
      if (!this.subscribers[key as string]) {
        this.subscribers[key as string] = [];
      }

      this.subscribers[key as string].push(callback);

      return () => {
        this.subscribers[key as string] = this.subscribers[key as string].filter(
          (cb) => cb !== callback
        );
      };
    }

    throw new Error('Invalid arguments for subscribe method.');
  }

  private notifySubscribers<K extends keyof State>(key: K, value: State[K] | null): void {
    const callbacks = this.subscribers[key as string] || [];
    callbacks.forEach((callback) => callback(value));
  }

  private notifyFullStateSubscribers(): void {
    const currentState = this.getState();
    this.fullStateSubscribers.forEach((callback) => callback(currentState));
  }
}