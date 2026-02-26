'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUSES = [
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

interface StatusUpdaterProps {
  jobId: string;
  currentStatus: string;
  currentNotes: string;
}

export function StatusUpdater({
  jobId,
  currentStatus,
  currentNotes,
}: StatusUpdaterProps) {
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(currentNotes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        notes,
        event: {
          type: 'status_change',
          metadata: { from: currentStatus, to: status },
        },
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Update'}
        </Button>
      </div>
      <textarea
        className="w-full rounded-lg border bg-background p-3 text-sm"
        rows={3}
        placeholder="Add notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
}
