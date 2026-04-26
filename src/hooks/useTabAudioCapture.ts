import { useState, useRef, useMemo, useEffect, useCallback } from 'react';

// ─── Types ───

interface UseTabAudioCaptureOptions {
  onComplete: (blob: Blob) => Promise<void>;
  onError?: (error: string) => void;
}

interface UseTabAudioCaptureReturn {
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  isCapturing: boolean;
  isSupported: boolean;
  error: string | null;
}

// ─── MIME Type Fallback ───

const getSupportedMimeType = (): string => {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "", // Fallback to browser default
  ];
  return types.find(type => !type || MediaRecorder.isTypeSupported(type)) || "";
};

// ─── Hook ───

export function useTabAudioCapture(options: UseTabAudioCaptureOptions): UseTabAudioCaptureReturn {
  const { onComplete, onError } = options;

  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for mutable state across renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  // Feature detection: check if getDisplayMedia supports tab audio capture
  const isSupported = useMemo(() => {
    if (typeof navigator?.mediaDevices?.getDisplayMedia !== 'function') return false;
    try {
      const supported = navigator.mediaDevices.getSupportedConstraints();
      return 'displaySurface' in supported;
    } catch {
      return false;
    }
  }, []);

  // Cleanup all streams and audio context
  const cleanup = useCallback(() => {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach(t => t.stop());
      displayStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startCapture = useCallback(async () => {
    setError(null);

    // 1. Get display media with tab-preferring constraints
    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        selfBrowserSurface: "exclude",
        systemAudio: "include",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "exclude",
      } as any);
    } catch {
      // User cancelled tab picker -- return silently (no error)
      return;
    }

    displayStreamRef.current = displayStream;

    // 2. Stop video tracks immediately (we only need audio)
    displayStream.getVideoTracks().forEach(t => t.stop());

    // 3. Check for audio track
    if (displayStream.getAudioTracks().length === 0) {
      cleanup();
      const msg = 'No audio detected. Make sure "Share tab audio" is checked when selecting the tab.';
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    // 4. Get mic stream
    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      cleanup();
      const msg = 'Microphone access is required for recording. Please enable it in your browser settings.';
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    micStreamRef.current = micStream;

    // 5. Mix via AudioContext
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const dest = audioContext.createMediaStreamDestination();
    const tabSource = audioContext.createMediaStreamSource(
      new MediaStream(displayStream.getAudioTracks())
    );
    tabSource.connect(dest);
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(dest);

    // 6. Create MediaRecorder on mixed stream
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(
      dest.stream,
      mimeType ? { mimeType } : undefined
    );
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeType || 'audio/webm',
      });

      // Cleanup all streams and audio context
      cleanup();
      setIsCapturing(false);

      // Call onComplete with the recorded blob
      if (blob.size > 0) {
        try {
          await onCompleteRef.current(blob);
        } catch (err) {
          console.error('useTabAudioCapture: onComplete failed:', err);
        }
      }
    };

    // 7. Auto-stop listener on display audio track ended
    displayStream.getAudioTracks()[0].addEventListener('ended', () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    });

    // 8. Start recording
    recorder.start(1000);
    setIsCapturing(true);
  }, [cleanup]);

  const stopCapture = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    startCapture,
    stopCapture,
    isCapturing,
    isSupported,
    error,
  };
}
