import { useState } from 'react';
import { User2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/auth/useAuth';
import { usePersonalDetails } from '@/hooks/useProfileQueries';
import { cn, initialsFromName } from '@/lib/utils';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import { InfoRow } from '@/components/eip/InfoRow';
import { StatutoryDetailsTab } from '@/components/eip/StatutoryDetailsTab';
import { BankDetailsTab } from '@/components/eip/BankDetailsTab';
import { AssetsTab } from '@/components/eip/AssetsTab';
import { AcademicQualificationTab } from '@/components/eip/AcademicQualificationTab';
import { DocumentsUploadTab } from '@/components/eip/DocumentsUploadTab';
import { PreviousEmploymentTab } from '@/components/eip/PreviousEmploymentTab';
import { FamilyDetailsTab } from '@/components/eip/FamilyDetailsTab';

const tabs = [
  'Company Details',
  'Statutory Details',
  'Bank Details',
  'Assets',
  'Academic Qualification',
  'Documents Upload',
  'Previous Employment',
  'Personal Details',
  'Family Details',
  'Others',
  'New Fields',
  'Employee Review',
] as const;

type Tab = (typeof tabs)[number];

function ComingSoonTab() {
  return <p className="px-3 py-8 text-center text-xs text-slate-400">This section is planned for a follow-up build session.</p>;
}

export default function ProfilePage() {
  const { authSession } = useAuth();
  const [tab, setTab] = useState<Tab>('Company Details');
  const { data: personal } = usePersonalDetails(authSession?.employee.id);

  if (!authSession) return null;
  const e = authSession.employee;

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'My Profile' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="My Profile" />

        <div className="flex flex-col gap-0 lg:flex-row">
          <aside className="w-full shrink-0 border-b border-slate-100 lg:w-72 lg:border-b-0 lg:border-r">
            <div className="flex flex-col items-center gap-3 border-b border-slate-100 p-4">
              <div className="flex h-32 w-28 items-center justify-center rounded border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-400">
                {e.photoUrl ? (
                  <img src={e.photoUrl} alt={e.displayName} className="h-full w-full rounded object-cover" />
                ) : (
                  initialsFromName(e.displayName)
                )}
              </div>
              <span className="rounded bg-primary-500 px-3 py-1 text-xs font-semibold text-white">{e.displayName}</span>
            </div>
            <nav className="flex flex-col py-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-left text-xs',
                    tab === t ? 'bg-primary-50 font-semibold text-primary-600' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <User2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  {t}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex-1 p-0">
            {tab === 'Company Details' && (
              <div>
                <InfoRow label="Paygroup" value={e.paygroup} />
                <InfoRow label="Associate Code" value={e.employeeCode} />
                <InfoRow label="First Name" value={e.firstName} />
                <InfoRow label="Middle Name" value={e.middleName} />
                <InfoRow label="Last Name" value={e.lastName} />
                <InfoRow label="Gender" value={e.gender} />
                <InfoRow label="Father Name" value={e.fatherName} />
                <InfoRow label="Date Of Birth" value={e.dateOfBirth ? formatDDMMYYYY(e.dateOfBirth) : null} />
                <InfoRow label="Date Of Joining" value={formatDDMMYYYY(e.dateOfJoining)} />
                <InfoRow label="Official Email" value={e.officialEmail} />
                <InfoRow label="Official Mobile" value={e.officialMobile} />
                <InfoRow label="Department" value={e.departmentName} />
                <InfoRow label="Designation" value={e.designationName} />
                <InfoRow label="Location" value={e.locationName} />
                <InfoRow label="Grade" value={e.gradeName} />
                <InfoRow label="Cost Centre" value={e.costCentre} />
                <InfoRow label="Place of Tax Deduction" value={e.placeOfTaxDeduction} />
                <InfoRow label="Reporting Manager" value={e.reportingManagerName} />
                <InfoRow label="Job Responsibility" value={e.jobResponsibility} />
              </div>
            )}

            {tab === 'Personal Details' && (
              <div>
                <InfoRow label="Marital Status" value={personal?.maritalStatus} />
                <InfoRow label="Nationality" value={personal?.nationality} />
                <InfoRow label="Blood Group" value={personal?.bloodGroup} />
                <InfoRow label="Personal Email" value={personal?.personalEmail} />
                <InfoRow label="Personal Mobile" value={personal?.personalMobile} />
                <InfoRow label="Address Line 1" value={personal?.addressLine1} />
                <InfoRow label="Address Line 2" value={personal?.addressLine2} />
                <InfoRow label="City" value={personal?.city} />
                <InfoRow label="State" value={personal?.state} />
                <InfoRow label="Country" value={personal?.country} />
                <InfoRow label="PIN Code" value={personal?.pinCode} />
                <InfoRow label="Emergency Contact Name" value={personal?.emergencyContactName} />
                <InfoRow label="Emergency Contact Number" value={personal?.emergencyContactNumber} />
              </div>
            )}

            {tab === 'Statutory Details' && <StatutoryDetailsTab />}
            {tab === 'Bank Details' && <BankDetailsTab />}
            {tab === 'Assets' && <AssetsTab />}
            {tab === 'Academic Qualification' && <AcademicQualificationTab />}
            {tab === 'Documents Upload' && <DocumentsUploadTab />}
            {tab === 'Previous Employment' && <PreviousEmploymentTab />}
            {tab === 'Family Details' && <FamilyDetailsTab />}
            {(tab === 'Others' || tab === 'New Fields' || tab === 'Employee Review') && <ComingSoonTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
