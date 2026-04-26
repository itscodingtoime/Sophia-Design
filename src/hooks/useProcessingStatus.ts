import { useState, useEffect, useRef, useCallback } from 'react';
import { useSophiaAuth } from './useSophiaAuth';
import { API_BASE_URL } from '../services/api';

export interface ProcessingJob {
  meeting_id: number;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  error_message?: string;
  title?: string;
}

const POLL_INTERVAL = 5000; // 5 seconds

export function useProcessingStatus() {
  const { getApiToken } = useSophiaAuth();
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  useEffect(() => {
    if (!isPolling) return;

    let active = true;

    const poll = async () => {
      try {
        const token = await getApiToken();
        if (!token || !active) return;

        const res = await fetch(`${API_BASE_URL}/v1/meetings/processing`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.error('Processing poll failed:', res.status);
          return;
        }

        const data: ProcessingJob[] = await res.json();
        if (!active) return;

        setJobs(data);

        if (data.length === 0) {
          setIsPolling(false);
          return;
        }
      } catch (err) {
        console.error('Processing poll error:', err);
      }

      if (active) {
        timerRef.current = window.setTimeout(poll, POLL_INTERVAL);
      }
    };

    poll();

    return () => {
      active = false;
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [isPolling, getApiToken]);

  return { jobs, startPolling, isPolling };
}
