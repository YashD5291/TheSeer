'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge, ScoreBadge, RecommendationBadge } from './status-badge';
import { useCallback, useEffect, useState } from 'react';

interface JobRow {
  _id: string;
  title: string;
  company: string;
  location?: string;
  analysis?: {
    fitScore?: number;
    recommendedBase?: string;
    applyRecommendation?: string;
  };
  status: string;
  createdAt: string;
}

interface JobListResponse {
  jobs: JobRow[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUSES = [
  'all',
  'analyzed',
  'resume_created',
  'applied',
  'phone_screen',
  'technical',
  'onsite',
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
];

export function JobTable() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<JobListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [page, setPage] = useState(
    parseInt(searchParams.get('page') || '1')
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    params.set('page', String(page));
    params.set('limit', '25');

    const res = await fetch(`/api/jobs?${params}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [search, status, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    if (page > 1) params.set('page', String(page));
    router.replace(`/jobs?${params}`, { scroll: false });
  }, [search, status, page, router]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Recommendation</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !data || data.jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              data.jobs.map((job) => (
                <TableRow key={job._id} className="cursor-pointer hover:bg-accent">
                  <TableCell>
                    <Link href={`/jobs/${job._id}`}>
                      <StatusBadge status={job.status} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/jobs/${job._id}`} className="font-medium">
                      {job.company}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/jobs/${job._id}`}>
                      {job.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    {job.analysis?.fitScore !== undefined && (
                      <ScoreBadge score={job.analysis.fitScore} />
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {job.analysis?.recommendedBase?.replace(/_/g, ' ') || '-'}
                  </TableCell>
                  <TableCell>
                    {job.analysis?.applyRecommendation && (
                      <RecommendationBadge rec={job.analysis.applyRecommendation} />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {data.total} jobs total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm">
              {data.page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
