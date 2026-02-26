import { Suspense } from 'react';
import { JobTable } from '@/components/jobs/job-table';

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Jobs</h1>
        <p className="mt-1 text-muted-foreground">
          All analyzed job postings
        </p>
      </div>

      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <JobTable />
      </Suspense>
    </div>
  );
}
