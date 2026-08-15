import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { useAuth } from '@/auth/useAuth';
import { useHolidays } from '@/hooks/useAttendanceQueries';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { HolidayRow } from '@/types/attendance';
import { ORG_ID } from '@/lib/orgContext';

function yearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map((y) => ({ value: String(y), label: String(y) }));
}

export default function HolidayListPage() {
  const { authSession } = useAuth();
  const orgId = authSession?.employee ? ORG_ID : undefined;
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { data, isLoading } = useHolidays(orgId, Number(year));
  const rows = useMemo(() => data ?? [], [data]);

  const columns: ColumnDef<HolidayRow>[] = [
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.holidayDate), id: 'date' },
    { header: 'Holiday', accessorKey: 'name' },
    {
      header: 'Type',
      accessorFn: (r) => r.holidayType.charAt(0).toUpperCase() + r.holidayType.slice(1),
      id: 'type',
    },
    { header: 'Location', accessorFn: (r) => r.locationName ?? 'All Locations', id: 'location' },
    { header: 'Description', accessorFn: (r) => r.description ?? '-', id: 'description' },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Holiday List' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Holiday List" />

        <FilterBar>
          <FilterField label="Year">
            <FilterSelect value={year} onChange={setYear} options={yearOptions()} />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search by holiday name"
          emptyMessage={isLoading ? 'Loading…' : 'No holidays found for this year.'}
        />
      </div>
    </div>
  );
}
