import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useProcessingStatus, type ProcessingJob } from '../hooks/useProcessingStatus';

interface ProcessingStatusContextValue {
  jobs: ProcessingJob[];
  startPolling: () => void;
}

const ProcessingStatusContext = createContext<ProcessingStatusContextValue>({
  jobs: [],
  startPolling: () => {},
});

export function ProcessingStatusProvider({ children }: { children: React.ReactNode }) {
  const { jobs, startPolling, isPolling } = useProcessingStatus();
  const previousJobsRef = useRef<ProcessingJob[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const prev = previousJobsRef.current;

    for (const job of jobs) {
      const prevJob = prev.find(p => p.meeting_id === job.meeting_id);

      // Detect transition: was pending/processing, now complete
      if (
        job.status === 'complete' &&
        prevJob &&
        (prevJob.status === 'processing' || prevJob.status === 'pending')
      ) {
        toast.success(job.title || 'Meeting processed', {
          description: 'Processing complete',
          action: {
            label: 'View',
            onClick: () => navigate(`/studio/${job.meeting_id}`),
          },
        });
      }

      // Detect transition: was pending/processing, now failed
      if (
        job.status === 'failed' &&
        prevJob &&
        (prevJob.status === 'processing' || prevJob.status === 'pending')
      ) {
        toast.error(job.title || 'Processing failed', {
          description: job.error_message || 'An error occurred during processing',
          action: {
            label: 'Retry',
            onClick: () => navigate(`/studio/${job.meeting_id}`),
          },
        });
      }
    }

    previousJobsRef.current = [...jobs];
  }, [jobs, navigate]);

  return (
    <ProcessingStatusContext.Provider value={{ jobs, startPolling }}>
      {children}
    </ProcessingStatusContext.Provider>
  );
}

export function useProcessingJobs() {
  return useContext(ProcessingStatusContext);
}
