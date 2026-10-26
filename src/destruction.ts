/** Shared thresholds keep impact events and the cached stonework in sync. */
export function wallDamageStage(hp: number, maxHp: number): number {
  const ratio = hp / maxHp;
  return hp <= 0
    ? 4
    : ratio <= 0.25
      ? 3
      : ratio <= 0.55
        ? 2
        : ratio <= 0.8
          ? 1
          : 0;
}
