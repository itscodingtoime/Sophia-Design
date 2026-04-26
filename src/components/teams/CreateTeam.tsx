import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useClerk, useOrganizationList } from '@clerk/clerk-react';
import { toast } from 'sonner';
import Button from '../../generic/Button';
import Input from '../../generic/Input';
import { C } from '../../theme';

import { PlusIcon } from 'lucide-react';

const CreateTeam = () => {
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { createOrganization, setActive } = useClerk();
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  // Handle Escape key to close modal
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) {
        setOpen(false);
        setTeamName('');
        setTeamDescription('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, isCreating]);

  const handleClose = () => {
    if (isCreating) return;
    setOpen(false);
    setTeamName('');
    setTeamDescription('');
  };

  const handleCreate = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    try {
      setIsCreating(true);

      const org = await createOrganization({
        name: teamName.trim(),
        ...(teamDescription.trim() && {
          publicMetadata: { description: teamDescription.trim() },
        }),
      });

      await setActive({ organization: org.id });
      await userMemberships?.revalidate?.();

      toast.success(`Team "${org.name}" created!`);
      setOpen(false);
      setTeamName('');
      setTeamDescription('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create team');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button
        className="flex items-center gap-2 hover:bg-transparent hover:underline"
        style={{ color: C.text }}
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={12} style={{ color: C.text }} />
        <span>Create Team</span>
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleClose();
              }
            }}
          >
            <div className="w-full max-w-md mx-4 rounded-xl p-6 shadow-2xl" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
              <h2 className="mb-4 text-lg font-semibold" style={{ color: C.text }}>
                Create New Team
              </h2>

              <div className="mb-4">
              <Input
                className="focus:ring-0"
                style={{ background: C.inputBg, borderColor: C.border, color: C.text }}
                placeholder="Enter team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating && teamName.trim()) {
                    handleCreate();
                  }
                }}
                autoFocus
              />
            </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', color: C.text, fontFamily: "'Tomorrow', sans-serif", fontSize: 13, marginBottom: 6 }}>
                  Team Description (optional)
                </label>
                <textarea
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.inputBg,
                    color: C.text, fontFamily: "'Tomorrow', sans-serif",
                    fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box',
                  }}
                  rows={3}
                  placeholder="Add a description for your team..."
                  value={teamDescription}
                  onChange={e => setTeamDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3" style={{ marginTop: 12 }}>
                <Button
                  variant="primary"
                  onClick={handleClose}
                  className="flex-1"
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  className="flex-1"
                  disabled={isCreating || !teamName.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create Team'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default CreateTeam;
