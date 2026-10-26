import { redirect } from 'next/navigation';
import SopFormClient from './SopFormClient';

export const dynamic = 'force-dynamic';

export default async function SopCaptureFormPage({ searchParams }: { searchParams: Promise<{ area?: string, machine?: string }> }) {
  const params = await searchParams;
  if (!params.area || !params.machine) {
    redirect('/sop-capture');
  }

  return <SopFormClient area={params.area} machine={params.machine} />;
}
