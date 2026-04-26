import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOrganization } from '@clerk/clerk-react';
import { toast } from 'sonner';
import Button from '../../generic/Button';
import { C } from '../../theme';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded?: () => void;
}

const AddMemberModal = ({ isOpen, onClose, onMemberAdded }: AddMemberModalProps) => {
  const { organization } = useOrganization();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('org:member');
  const [isInviting, setIsInviting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setRole('org:member');
      setIsInviting(false);
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isInviting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isInviting]);

  const handleClose = () => {
    if (isInviting) return;
    onClose();
  };

  const handleInvite = async () => {
    if (!organization) {
      toast.error('No organization selected');
      return;
    }

    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setIsInviting(true);
      await organization.inviteMember({
        emailAddress: email.trim(),
        role: role as 'org:member' | 'org:admin',
      });

      // Reload organization to update invitations list
      await organization.reload();
      onMemberAdded?.();

      toast.success('Invitation sent successfully!');
      setEmail('');
      setRole('org:member');
      onClose();
    } catch (error: any) {
      const errorMessage = error.errors?.[0]?.message || error.message || 'Failed to send invitation';
      toast.error(errorMessage);
    } finally {
      setIsInviting(false);
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 m-0 z-[9999] flex items-center justify-center"
      style={{
        top: 0, right: 0, bottom: 0, left: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        animation: 'modalFadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <style>{`@keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div className="w-full max-w-md rounded-xl p-6 mx-4" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)', animation: 'scaleIn 0.2s ease' }}>
        <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: C.text }}>
          Invite Team Member
        </h2>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium" style={{ color: C.text }}>Email Address</label>
          <style>{`#sophia-invite-email::placeholder { color: #9ca3af; }`}</style>
          <input
            id="sophia-invite-email"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email.trim() && !isInviting) {
                handleInvite();
              }
            }}
            autoFocus
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              background: C.inputBg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 14, fontFamily: "'Tomorrow', sans-serif",
              outline: 'none',
            }}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium" style={{ color: C.text }}>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-0"
            style={{ background: C.inputBg, borderWidth: 1, borderStyle: 'solid', borderColor: C.border, color: C.text }}
          >
            <option value="org:member">Member</option>
            <option value="org:admin">Admin</option>
          </select>
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleClose}
            className="flex-1"
            disabled={isInviting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleInvite}
            className="flex-1"
            disabled={isInviting || !email.trim()}
          >
            {isInviting ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default AddMemberModal;
