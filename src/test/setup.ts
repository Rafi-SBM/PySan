import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

/**
 * Node 26 exposes a native `localStorage` that is inert unless the process was
 * started with `--localstorage-file`, and it shadows the jsdom implementation.
 * Tests get a plain in-memory Storage instead, so the persistence paths in the
 * app are genuinely exercised and each test starts from a clean slate.
 */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.has(key) ? (this.entries.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

function install(name: 'localStorage' | 'sessionStorage'): void {
  const storage = new MemoryStorage();
  Object.defineProperty(window, name, {
    value: storage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
    writable: true,
  });
}

// jsdom implements no layout, so it has no scrollIntoView. Every browser does.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

beforeEach(() => {
  install('localStorage');
  install('sessionStorage');
});
