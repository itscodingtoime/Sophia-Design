import { FileText, Mic, Upload } from 'lucide-react';
import { C } from '../../theme';

interface FileStatsProps {
  totalFiles: number;
  totalLiveMeetings: number;
  totalUploadedTranscripts: number;
}

const FileStats = ({
  totalFiles,
  totalLiveMeetings,
  totalUploadedTranscripts,
}: FileStatsProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
      {/* Total Files */}
      <div className="flex items-center justify-between rounded-xl px-5 py-4 shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-50">
            <FileText className="h-5 w-5 text-pink-500" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: C.text }}>Total files</p>
            <p className="mt-1 text-lg font-semibold" style={{ color: C.text }}>{totalFiles}</p>
          </div>
        </div>
      </div>

      {/* Live Meetings */}
      <div className="flex items-center justify-between rounded-xl px-5 py-4 shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
            <Mic className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: C.text }}>Live meetings</p>
            <p className="mt-1 text-lg font-semibold" style={{ color: C.text }}>{totalLiveMeetings}</p>
          </div>
        </div>
      </div>

      {/* Uploaded transcripts */}
      <div className="flex items-center justify-between rounded-xl px-5 py-4 shadow-sm" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
            <Upload className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: C.text }}>Uploaded transcripts</p>
            <p className="mt-1 text-lg font-semibold" style={{ color: C.text }}>{totalUploadedTranscripts}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileStats;
