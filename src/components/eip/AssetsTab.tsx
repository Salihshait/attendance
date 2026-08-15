import type { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/auth/useAuth';
import { useAssets } from '@/hooks/useProfileQueries';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { AssetRow } from '@/types/eip';

const statusTone: Record<AssetRow['status'], StatusKind> = {
  assigned: 'approved',
  returned: 'cancelled',
  lost: 'rejected',
  damaged: 'pending',
};

export function AssetsTab() {
  const { authSession } = useAuth();
  const { data, isLoading } = useAssets(authSession?.employee.id);

  const columns: ColumnDef<AssetRow>[] = [
    { header: 'Asset ID', accessorKey: 'assetCode' },
    { header: 'Asset Type', accessorKey: 'assetType' },
    { header: 'Asset Name', accessorKey: 'assetName' },
    { header: 'Serial Number', accessorFn: (r) => r.serialNumber ?? '-', id: 'serialNumber' },
    { header: 'Issued Date', accessorFn: (r) => formatDDMMYYYY(r.issuedDate), id: 'issuedDate' },
    { header: 'Return Date', accessorFn: (r) => (r.returnDate ? formatDDMMYYYY(r.returnDate) : '-'), id: 'returnDate' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<AssetRow['status']>();
        return <StatusBadge status={statusTone[status]} label={status.charAt(0).toUpperCase() + status.slice(1)} />;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      searchPlaceholder="Search by asset name"
      emptyMessage={isLoading ? 'Loading…' : 'No assets assigned.'}
    />
  );
}
