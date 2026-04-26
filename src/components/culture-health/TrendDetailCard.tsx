import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { C, useThemeMode } from '../../theme';

export interface TrendDetailCardProps {
  periodLabel: string;
  meetings: {
    meeting_id: number;
    title: string | null;
    meeting_date: string;
    collective_score: number | null;
    qualitative_observations: string | null;
  }[];
  onClose: () => void;
}

const TrendDetailCard = ({ periodLabel, meetings, onClose }: TrendDetailCardProps) => {
  useThemeMode();
  const navigate = useNavigate();

  return (
    <div style={{
      background: C.card,
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      padding: 16,
      position: 'relative',
      animation: 'fadeSlide 0.25s ease',
      marginTop: 14,
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close detail"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} color={C.textDim} />
      </button>

      {/* Header */}
      <div style={{
        fontSize: 14.5,
        fontWeight: 600,
        color: C.text,
        fontFamily: "'Josefin Sans', sans-serif",
        marginBottom: 14,
        paddingRight: 28,
      }}>
        {periodLabel}
      </div>

      {/* Meeting list */}
      {meetings.length === 0 ? (
        <div style={{
          fontSize: 12,
          color: C.textDim,
          fontStyle: 'italic',
          padding: '8px 0',
        }}>
          No meetings recorded this period
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {meetings.map((meeting) => (
            <div
              key={meeting.meeting_id}
              style={{
                padding: '10px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {/* Meeting title (clickable) */}
              <div
                onClick={() => navigate(`/studio/${meeting.meeting_id}`)}
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: C.text,
                  cursor: 'pointer',
                  marginBottom: 4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.teal; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.text; }}
              >
                {meeting.title || 'Untitled Meeting'}
              </div>

              {/* Observation excerpt */}
              {meeting.qualitative_observations && (
                <div style={{
                  fontSize: 11,
                  color: C.textDim,
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                }}>
                  {meeting.qualitative_observations}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendDetailCard;
