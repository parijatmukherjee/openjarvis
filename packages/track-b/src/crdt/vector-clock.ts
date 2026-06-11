export interface VectorClock {
  [deviceId: string]: number;
}

export function merge(a: VectorClock, b: VectorClock): VectorClock {
  const result: VectorClock = { ...a };
  for (const [device, count] of Object.entries(b)) {
    result[device] = Math.max(result[device] ?? 0, count);
  }
  return result;
}

export function compare(
  a: VectorClock,
  b: VectorClock,
): "before" | "after" | "concurrent" | "equal" {
  let aGreater = false;
  let bGreater = false;
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (av > bv) aGreater = true;
    if (bv > av) bGreater = true;
  }

  if (aGreater && bGreater) return "concurrent";
  if (aGreater) return "after";
  if (bGreater) return "before";
  return "equal";
}

export function increment(clock: VectorClock, deviceId: string): VectorClock {
  return { ...clock, [deviceId]: (clock[deviceId] ?? 0) + 1 };
}
