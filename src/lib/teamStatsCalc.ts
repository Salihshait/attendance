import type { DayStatus } from '@/types/attendance';
import type { TeamStats } from '@/types/manager';

export interface TeamStatsAttendanceRow {
  day_status: DayStatus;
  late_minutes: number;
  early_going_minutes: number;
}

/**
 * Reduces one day's attendance rows for a manager's direct reports into the
 * Manager Dashboard's stat-tile counts. Late/Early Going are counted
 * whenever the respective minutes are positive, independent of day_status —
 * an employee can be marked "present" and still be late or leave early.
 */
export function computeTeamStats(teamSize: number, rows: TeamStatsAttendanceRow[]): TeamStats {
  let present = 0;
  let absent = 0;
  let onLeave = 0;
  let late = 0;
  let earlyGoing = 0;

  for (const row of rows) {
    if (row.day_status === 'present' || row.day_status === 'half_day') present += 1;
    else if (row.day_status === 'absent') absent += 1;
    else if (row.day_status === 'leave') onLeave += 1;

    if (row.late_minutes > 0) late += 1;
    if (row.early_going_minutes > 0) earlyGoing += 1;
  }

  return { teamSize, present, absent, onLeave, late, earlyGoing };
}
