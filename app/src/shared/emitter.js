/**
 * Factory pub/sub thuần (P4-1).
 *
 * `shared` không được biết domain, nên đây chỉ là `on/off/emit` trên một `Map`
 * channel. Instance do `shell` tạo lúc boot rồi **tiêm** vào `tools.configure`
 * (và `ui.mount` sau này) — không section nào import một "bus" toàn cục, nên
 * `tools` không phải import `shell` (cạnh bị `boundaries.json` cấm).
 */

/**
 * @returns {{
 *   on(channel: string, fn: Function): () => void,
 *   off(channel: string, fn: Function): void,
 *   emit(channel: string, payload?: unknown): void,
 *   clear(channel?: string): void
 * }}
 */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const channels = new Map();

  function on(channel, fn) {
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel).add(fn);
    return () => off(channel, fn);
  }

  function off(channel, fn) {
    const set = channels.get(channel);
    if (!set) return;
    set.delete(fn);
    if (!set.size) channels.delete(channel);
  }

  function emit(channel, payload) {
    const set = channels.get(channel);
    if (!set) return;
    for (const fn of Array.from(set)) fn(payload);
  }

  function clear(channel) {
    if (channel === undefined) channels.clear();
    else channels.delete(channel);
  }

  return { on, off, emit, clear };
}
