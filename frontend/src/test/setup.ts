import "@testing-library/jest-dom/vitest";

/* Node ≥22 ships a global `localStorage` that is a non-functional stub unless
   node runs with --localstorage-file, and vitest's jsdom sandbox inherits it —
   shadowing jsdom's working Storage (even window.localStorage.getItem comes
   back undefined on Node 25). Install a real in-memory Storage so tests behave
   the same on any Node, including the Node 20 CI runners. */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(String(k), String(v)),
  } as Storage;
}
Object.defineProperty(globalThis, "localStorage", {
  value: memoryStorage(),
  configurable: true,
  writable: true,
});
