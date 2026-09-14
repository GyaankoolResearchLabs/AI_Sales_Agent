import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonRows } from './Skeleton';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
}

/** Generic, responsive, horizontally-scrollable table used across CRM list pages. */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  isError,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  onRowClick,
  rowHref,
}: DataTableProps<T>) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <SkeletonRows rows={6} />
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => {
                if (rowHref) navigate(rowHref(row));
                else onRowClick?.(row);
              }}
              className={(onRowClick || rowHref) ? 'cursor-pointer hover:bg-gray-50' : ''}
            >
              {columns.map((col) => (
                <td key={col.header} className={`px-4 py-3 whitespace-nowrap text-gray-700 ${col.className ?? ''}`}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
