/**
 * CalibrationFlow -- Conversational calibration questions with option chips.
 *
 * Renders 3 sequential SOPHIA chat bubbles, each with selectable option chips.
 * After all 3 are answered, calls onComplete with mapped API values.
 *
 * Per UI-SPEC Component 2 and D-04.
 */
import { useState } from 'react';
import { C, useThemeMode } from '../../theme';
import { SophiaWhiteOrb } from '../orbs';

interface CalibrationFlowProps {
  onComplete: (settings: { directness: string; accountability: string; memory_level: string }) => void;
}

interface QuestionDef {
  text: string;
  field: 'directness' | 'accountability' | 'memory_level';
  options: Array<{ label: string; value: string }>;
}

const QUESTIONS: QuestionDef[] = [
  {
    text: 'How direct should I be with feedback?',
    field: 'directness',
    options: [
      { label: 'Gentle', value: 'gentle' },
      { label: 'Balanced', value: 'balanced' },
      { label: 'Direct', value: 'direct' },
    ],
  },
  {
    text: 'How should I follow up on actions?',
    field: 'accountability',
    options: [
      { label: 'Check in regularly', value: 'strict' },
      { label: 'Friendly reminders', value: 'friendly' },
      { label: 'Only when you ask', value: 'on_request' },
    ],
  },
  {
    text: 'How much should I remember between sessions?',
    field: 'memory_level',
    options: [
      { label: 'This session only', value: 'session_only' },
      { label: 'My commitments', value: 'commitments' },
      { label: 'Commitments + preferences', value: 'commitments_preferences' },
      { label: 'Everything', value: 'full' },
    ],
  },
];

// Map values to human-readable descriptions for confirmation
const DIRECTNESS_LABELS: Record<string, string> = {
  gentle: 'gentle',
  balanced: 'balanced',
  direct: 'direct',
};

const ACCOUNTABILITY_LABELS: Record<string, string> = {
  strict: 'check in regularly',
  friendly: 'send friendly reminders',
  on_request: 'only follow up when you ask',
};

const MEMORY_LABELS: Record<string, string> = {
  session_only: 'this session only',
  commitments: 'your commitments',
  commitments_preferences: 'commitments and preferences',
  full: 'everything',
};

export function CalibrationFlow({ onComplete }: CalibrationFlowProps) {
  useThemeMode();

  // currentQuestion: 0, 1, 2 = showing that question; 3 = done (confirmation shown)
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleSelect = (field: string, value: string) => {
    const newAnswers = { ...answers, [field]: value };
    setAnswers(newAnswers);

    if (currentQuestion < 2) {
      // Advance to next question after a brief delay for visual feedback
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      // All 3 answered -- call onComplete and show confirmation
      setCurrentQuestion(3);
      onComplete({
        directness: newAnswers.directness,
        accountability: newAnswers.accountability,
        memory_level: newAnswers.memory_level,
      });
    }
  };

  const confirmationText = currentQuestion === 3
    ? `Got it! I'll be ${DIRECTNESS_LABELS[answers.directness] || answers.directness}, ${ACCOUNTABILITY_LABELS[answers.accountability] || answers.accountability}, and remember ${MEMORY_LABELS[answers.memory_level] || answers.memory_level}. You can change these anytime in your profile settings. Let's get started!`
    : '';

  return (
    <>
      {QUESTIONS.map((q, qi) => {
        if (qi > currentQuestion) return null;

        const selectedValue = answers[q.field];
        const isAnswered = selectedValue !== undefined;

        return (
          <div key={q.field} style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: 6,
            animation: qi === currentQuestion ? 'fadeSlide 0.35s ease both' : undefined,
          }}>
            <div style={{ marginRight: 12, marginTop: 4, flexShrink: 0 }}>
              <SophiaWhiteOrb size={28} animate={false} />
            </div>
            <div style={{
              maxWidth: 480,
              padding: '12px 18px',
            }}>
              {/* Question text */}
              <div style={{
                fontSize: 14.5,
                lineHeight: 1.75,
                color: C.text,
                fontFamily: "'Tomorrow', sans-serif",
                marginBottom: 12,
              }}>
                {q.text}
              </div>

              {/* Option chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                role="radiogroup"
                aria-label={q.text}
              >
                {q.options.map(opt => {
                  const isSelected = selectedValue === opt.value;
                  const isDisabled = isAnswered && !isSelected;

                  return (
                    <button
                      key={opt.value}
                      onClick={() => !isAnswered && handleSelect(q.field, opt.value)}
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isAnswered}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 14,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Tomorrow', sans-serif",
                        cursor: isAnswered ? 'default' : 'pointer',
                        background: isSelected ? C.tealGlow : C.hoverBg,
                        border: `1px solid ${isSelected ? C.tealBorder : C.border}`,
                        color: isSelected ? C.teal : C.textSec,
                        opacity: isDisabled ? 0.4 : 1,
                        pointerEvents: isAnswered ? 'none' : 'auto',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Confirmation message after all 3 questions */}
      {currentQuestion === 3 && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          marginBottom: 6,
          animation: 'fadeSlide 0.35s ease both',
        }}>
          <div style={{ marginRight: 12, marginTop: 4, flexShrink: 0 }}>
            <SophiaWhiteOrb size={28} animate={false} />
          </div>
          <div style={{
            maxWidth: 480,
            padding: '12px 18px',
          }}>
            <div style={{
              fontSize: 14.5,
              lineHeight: 1.75,
              color: C.text,
              fontFamily: "'Tomorrow', sans-serif",
            }}>
              {confirmationText}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
