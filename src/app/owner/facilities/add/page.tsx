import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/session';
import { FacilityForm } from '@/components/owner/FacilityForm';

export const metadata: Metadata = { title: 'Add Facility' };

export default async function AddFacilityPage() {
  const { userId } = await requireOwner('/owner/facilities');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Add a Facility</h1>
      <FacilityForm />
    </div>
  );
}
