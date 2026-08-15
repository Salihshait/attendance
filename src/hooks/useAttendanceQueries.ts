import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDateISO } from '@/lib/utils';
import type { AttendanceDay, HolidayRow, RawPunchRow } from '@/types/attendance';

export function useAttendanceRange(employeeId: string | undefined, start: Date, end: Date) {
  const startStr = formatDateISO(start);
  const endStr = formatDateISO(end);

  return useQuery({
    queryKey: ['attendance-range', employeeId, startStr, endStr],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<AttendanceDay[]> => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, employee_id, attendance_date, check_in, check_out, effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes, day_status, validation_status, remarks, shift:shifts(name)')
        .eq('employee_id', employeeId)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr)
        .order('attendance_date');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        attendanceDate: row.attendance_date,
        shiftName: (row.shift as unknown as { name: string } | null)?.name ?? null,
        checkIn: row.check_in,
        checkOut: row.check_out,
        effectiveMinutes: row.effective_minutes,
        lateMinutes: row.late_minutes,
        earlyGoingMinutes: row.early_going_minutes,
        excessStayMinutes: row.excess_stay_minutes,
        shortfallMinutes: row.shortfall_minutes,
        dayStatus: row.day_status,
        validationStatus: row.validation_status,
        remarks: row.remarks,
      }));
    },
  });
}

/** Raw device/mobile/web punches, before they're collapsed into `attendance`. */
export function useRawPunches(employeeId: string | undefined, start: Date, end: Date) {
  const startStr = formatDateISO(start);
  const endStr = formatDateISO(end);

  return useQuery({
    queryKey: ['raw-punches', employeeId, startStr, endStr],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<RawPunchRow[]> => {
      const { data, error } = await supabase
        .from('attendance_punches')
        .select('id, punch_date, punch_time, punch_type, device, location, source, employee:employees(first_name, last_name, employee_code)')
        .eq('employee_id', employeeId)
        .gte('punch_date', startStr)
        .lte('punch_date', endStr)
        .order('punch_time', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const employee = row.employee as unknown as { first_name: string; last_name: string | null; employee_code: string } | null;
        return {
          id: row.id,
          employeeName: employee ? [employee.first_name, employee.last_name].filter(Boolean).join(' ') : '-',
          employeeCode: employee?.employee_code ?? '-',
          punchDate: row.punch_date,
          punchTime: row.punch_time,
          punchType: row.punch_type,
          device: row.device,
          location: row.location,
          source: row.source,
        };
      });
    },
  });
}

/** Single day's attendance record — used by the regularization form to show "Original attendance". */
export function useAttendanceDay(employeeId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['attendance-day', employeeId, date],
    enabled: Boolean(employeeId && date),
    queryFn: async (): Promise<AttendanceDay | null> => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, employee_id, attendance_date, check_in, check_out, effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes, day_status, validation_status, remarks, shift:shifts(name)')
        .eq('employee_id', employeeId)
        .eq('attendance_date', date)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        employeeId: data.employee_id,
        attendanceDate: data.attendance_date,
        shiftName: (data.shift as unknown as { name: string } | null)?.name ?? null,
        checkIn: data.check_in,
        checkOut: data.check_out,
        effectiveMinutes: data.effective_minutes,
        lateMinutes: data.late_minutes,
        earlyGoingMinutes: data.early_going_minutes,
        excessStayMinutes: data.excess_stay_minutes,
        shortfallMinutes: data.shortfall_minutes,
        dayStatus: data.day_status,
        validationStatus: data.validation_status,
        remarks: data.remarks,
      };
    },
  });
}

export function useHolidays(organizationId: string | undefined, year?: number) {
  return useQuery({
    queryKey: ['holidays', organizationId, year],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<HolidayRow[]> => {
      let query = supabase
        .from('holidays')
        .select('id, holiday_date, name, holiday_type, description, location:locations(name)')
        .order('holiday_date');
      if (year) {
        query = query.gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        holidayDate: row.holiday_date,
        name: row.name,
        holidayType: row.holiday_type,
        locationName: (row.location as unknown as { name: string } | null)?.name ?? null,
        description: row.description,
      }));
    },
  });
}
