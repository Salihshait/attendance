import { Construction } from 'lucide-react';
import { Breadcrumb, type BreadcrumbItem } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ComingSoonPage({ title, breadcrumb }: { title: string; breadcrumb: BreadcrumbItem[] }) {
  return (
    <div>
      <Breadcrumb items={breadcrumb} />
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title={title} />
        <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
          <Construction className="h-8 w-8" />
          <p className="text-sm">This module is planned for a follow-up build session.</p>
        </div>
      </div>
    </div>
  );
}
