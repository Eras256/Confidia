export interface VestingSchedule {
  totalAmount: number;
  startTimestamp: number;
  cliffDurationSeconds: number;
  vestingDurationSeconds: number;
}

export function calculateVestedAmount(
  schedule: VestingSchedule,
  currentTimestamp: number
): number {
  const { totalAmount, startTimestamp, cliffDurationSeconds, vestingDurationSeconds } = schedule;

  if (currentTimestamp < startTimestamp + cliffDurationSeconds) {
    return 0;
  }

  if (currentTimestamp >= startTimestamp + vestingDurationSeconds) {
    return totalAmount;
  }

  const elapsed = currentTimestamp - startTimestamp;
  const fraction = elapsed / vestingDurationSeconds;
  return Math.floor(totalAmount * fraction);
}

export function simulateVestingSchedule(
  schedule: VestingSchedule,
  stepsCount: number = 10
): { timestamp: number; vested: number; percentage: number }[] {
  const { startTimestamp, vestingDurationSeconds } = schedule;
  const stepSize = Math.max(1, Math.floor(vestingDurationSeconds / stepsCount));
  const results = [];

  for (let i = 0; i <= stepsCount; i++) {
    const time = startTimestamp + (i * stepSize);
    const vested = calculateVestedAmount(schedule, time);
    const percentage = Math.round((vested / schedule.totalAmount) * 100);
    results.push({ timestamp: time, vested, percentage });
  }

  return results;
}
