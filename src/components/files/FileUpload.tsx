import { useState, useEffect } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE_URL } from '../../services/api';
import Button from '../../generic/Button';
import { useTeam } from '../../context/TeamContext';
import {
  X,
  FileText,
  UploadCloud,
  Check,
  Loader2,
  History,
  CloudUpload,
  FileCheck
} from 'lucide-react';
import { C, useThemeMode } from '../../theme';

interface ProcessResponse {
  meeting_id: number;
  message: string;
  status: string;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface FileUploadProps {
  meetingId?: string | null;
  onSuccess?: () => void;
  onClose?: () => void;
}

const FileUpload = ({ meetingId, onSuccess, onClose }: FileUploadProps = {}) => {
  useThemeMode();
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [meetingDate, setMeetingDate] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [createdMeetingId, setCreatedMeetingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize with current date/time in local timezone
  useEffect(() => {
    const now = new Date();
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const formatted = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setMeetingDate(formatted);
  }, []);

  // Validation
  const isValidDate = () => {
    if (!meetingDate) return true; // Empty is OK (will use current time)
    const selected = new Date(meetingDate);
    const now = new Date();
    const maxDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Allow up to 24 hours in future
    const minDate = new Date('2020-01-01'); // Reasonable minimum
    
    return selected >= minDate && selected <= maxDate;
  };

  const getValidationError = () => {
    if (!meetingDate) return null;
    const selected = new Date(meetingDate);
    const now = new Date();
    const maxDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    if (selected > maxDate) {
      return 'Meeting date cannot be more than 24 hours in the future';
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validExtensions = ['.vtt', '.sbv', '.txt', '.json', '.pdf', '.docx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      setErrorMessage(`Invalid file type. Please upload a ${validExtensions.join(', ')} file.`);
      setUploadStatus('error');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setUploadStatus('idle');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a file first.');
      setUploadStatus('error');
      return;
    }

    // Validate date
    const dateError = getValidationError();
    if (dateError) {
      setErrorMessage(dateError);
      setUploadStatus('error');
      return;
    }

    try {
      setUploadStatus('uploading');
      setErrorMessage(null);

      const token = await getToken({ organizationId: organization?.id });
      if (!token) {
        throw new Error('Authentication token is required');
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', selectedFile);
      // Include title - use user input or fall back to filename
      formData.append('title', meetingTitle || selectedFile.name);
      // Include meeting date if provided
      if (meetingDate) {
        formData.append('meeting_date', meetingDate);
      }

      // Use the unified meetings upload endpoint
      const url = meetingId
        ? `${API_BASE_URL}/v1/meetings/${meetingId}/transcript`
        : `${API_BASE_URL}/v1/meetings/upload`;

      // Upload file
      const response = await axios.post<ProcessResponse>(
        url,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setCreatedMeetingId(response.data.meeting_id);
      setUploadStatus('processing');

      // Note: In a real app, you might want to poll for completion status
      // For now, we'll show "processing" and let the user know it's being processed
      setTimeout(() => {
        setUploadStatus('done');
        onSuccess?.();
      }, 2000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setErrorMessage(
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to upload file. Please try again.'
      );
      setUploadStatus('error');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setMeetingTitle('');
    setUploadStatus('idle');
    setCreatedMeetingId(null);
    setErrorMessage(null);
  };

  return (
    <div className="relative rounded-xl p-6 shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full transition-colors" style={{ color: C.text }}
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      )}
      <h2 className="mb-6 text-xl font-semibold flex items-center gap-2" style={{ color: C.text }}>
        <FileText className="w-5 h-5" style={{ color: C.teal }} />
        Upload Transcript
      </h2>

      {/* Meeting Title */}
      <div className="mb-6">
        <label htmlFor="meeting-title" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textDim }}>
          Meeting Title
        </label>
        <input
          id="meeting-title"
          type="text"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          placeholder="e.g. Weekly Sync, Project Kickoff"
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400"
          style={{ background: C.inputBg, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, color: C.text }}
          disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
        />
      </div>

      {/* Meeting Date/Time Picker */}
      <div className="mb-6">
        <label htmlFor="meeting-date" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textDim }}>
          Meeting Date & Time
        </label>
        <input
          id="meeting-date"
          type="datetime-local"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          max={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
          min="2020-01-01T00:00"
          className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all ${
            getValidationError() ? 'border-red-300 focus:ring-red-200' : ''
          }`}
          style={{ background: C.inputBg, borderWidth: 1, borderStyle: 'solid', borderColor: getValidationError() ? undefined : C.border, color: C.text }}
          disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
        />
        {getValidationError() && (
          <p className="mt-1 text-xs text-red-500">{getValidationError()}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Leave blank to use current time, or select when the meeting took place
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300"
        style={isDragging
          ? { borderColor: C.teal, background: C.tealGlow, transform: 'scale(1.01)' }
          : { borderColor: C.border, background: C.inputBg }}
      >
        {selectedFile ? (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: C.teal, color: C.bg }}>
              <Check className="w-6 h-6" />
            </div>
            <p className="font-bold truncate max-w-full px-4" style={{ color: C.text }}>{selectedFile.name}</p>
            <p className="text-xs mt-1" style={{ color: C.textDim }}>
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
              className="mt-4 text-[10px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest transition-colors"
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            >
              Remove File
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in fade-in duration-500">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.tealGlow, color: C.teal }}>
              <CloudUpload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-600">
              Drop transcript or <label htmlFor="file-input" className="cursor-pointer hover:underline" style={{ color: C.teal }}>browse</label>
            </p>
            <p className="mt-2 text-[10px] text-gray-400 font-medium tracking-wide uppercase">
              VTT, SBV, TXT, JSON, PDF, DOCX
            </p>
            <input
              id="file-input"
              type="file"
              accept=".vtt,.sbv,.txt,.json,.pdf,.docx"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Discrete Status Bar */}
      {(errorMessage || uploadStatus === 'processing' || uploadStatus === 'done' || uploadStatus === 'uploading') && (
        <div className={`mt-4 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-3 border transition-all ${errorMessage
            ? 'bg-red-50 text-red-600 border-red-100'
            : uploadStatus === 'done'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
          <div className={`h-2 w-2 rounded-full animate-pulse ${errorMessage ? 'bg-red-500' :
              uploadStatus === 'done' ? 'bg-emerald-500' : 'bg-amber-500'
            }`} />
          {errorMessage || (
            uploadStatus === 'uploading' ? 'Uploading transcript...' :
              uploadStatus === 'processing' ? 'Processing analysis...' :
                'Ready to analyze'
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mt-8">
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploadStatus === 'uploading' || uploadStatus === 'processing'}
          className="flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs"
          variant="primary"
        >
          {uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <History className="w-4 h-4" />
          )}
          {uploadStatus === 'uploading'
            ? 'Uploading...'
            : uploadStatus === 'processing'
              ? 'Processing...'
              : 'Analyze Meeting'}
        </Button>

        {(uploadStatus === 'done' || uploadStatus === 'error') && (
          <button
            onClick={handleReset}
            className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all"
          >
            Reset
          </button>
        )}
      </div>

      <div className="relative flex py-8 items-center">
        <div className="flex-grow border-t border-gray-100"></div>
        <span className="flex-shrink-0 mx-4 text-gray-300 text-[10px] font-black uppercase tracking-widest">OR</span>
        <div className="flex-grow border-t border-gray-100"></div>
      </div>

      <ImportModal />
    </div>
  );
};

// Simple embedded modal component for import
const ImportModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();
  const { activeTeam } = useTeam();

  const handleOpen = async () => {
    setIsOpen(true);
    if (activeTeam) {
      setLoading(true);
      try {
        const token = await getToken();
        const baseUrl = API_BASE_URL.replace(/\/api$/, '');
        const res = await fetch(`${baseUrl}/meetings/${activeTeam.team_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleImport = async (meetingId: string) => {
    if (!activeTeam) return;
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/teams/import-meeting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          team_id: activeTeam.team_id,
          meeting_id: meetingId
        })
      });

      if (!response.ok) throw new Error("Import failed");

      toast.success("Meeting imported successfully! Processing started.");
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import meeting from Intelligence");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 py-3 bg-gray-50/50 rounded-xl border border-gray-100 flex items-center justify-between">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Need to import?</span>
      <button
        onClick={handleOpen}
        className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors" style={{ color: C.teal }}
      >
        <History className="w-3.5 h-3.5" />
        Meeting Intelligence Import
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-gray-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold" style={{ color: C.text }}>Select Meeting</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-12 flex flex-col items-center gap-3 text-gray-400">
                  <Loader2 className="animate-spin" size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Loading history...</span>
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-1">
                  {history.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => handleImport(m.id)}
                      className="w-full text-left p-4 hover-bg rounded-xl transition-all flex justify-between items-center group"
                    >
                      <div>
                        <div className="text-sm font-bold" style={{ color: C.text }}>{m.title || `Meeting Analysis`}</div>
                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">
                          {new Date(m.created_at).toLocaleDateString()} • {m.dominant_tone}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 text-[10px] font-black uppercase tracking-widest transition-all" style={{ color: C.teal }}>
                        Import
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <History className="text-gray-300" size={18} />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">No recorded meetings found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
