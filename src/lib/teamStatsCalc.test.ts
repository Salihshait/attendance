import { describe, expect, it } from 'vitest';
import { computeTeamStats } from './teamStatsCalc';

describe('computeTeamStats', () => {
  it('counts present/absent/leave by day_status', () => {
    const stats = computeTeamStats(5, [
      { day_status: 'present', late_minutes: 0, early_going_minutes: 0 },
      { day_status: 'half_day', late_minutes: 0, early_going_minutes: 0 },
      { day_status: 'absent', late_minutes: 0, early_going_minutes: 0 },
      { day_status: 'leave', late_minutes: 0, early_going_minutes: 0 },
      { day_status: 'weekoff', late_minutes: 0, early_going_minutes: 0 },
    ]);
    expect(stats).toEqual({ teamSize: 5, present: 2, absent: 1, onLeave: 1, late: 0, earlyGoing: 0 });
  });

  it('counts late/early going independent of day_status', () => {
    const stats = computeTeamStats(2, [
      { day_status: 'present', late_minutes: 15, early_going_minutes: 0 },
      { day_status: 'present', late_minutes: 0, early_going_minutes: 20 },
    ]);
    expect(stats.late).toBe(1);
    expect(stats.earlyGoing).toBe(1);
    expect(stats.present).toBe(2);
  });

  it('reports zero counts when no attendance rows exist yet for the day', () => {
    expect(computeTeamStats(8, [])).toEqual({ teamSize: 8, present: 0, absent: 0, onLeave: 0, late: 0, earlyGoing: 0 });
  });
});
