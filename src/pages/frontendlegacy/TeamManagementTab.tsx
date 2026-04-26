import { useEffect, useState } from 'react';
import { useOrganization } from '@clerk/clerk-react';
import { useUser } from '@clerk/clerk-react';
import MemberTable from '../components/teams/MemberTable';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { C } from '../theme';
import { SectionCard, NoTeamState } from '@/components/composition';
import { Skeleton } from '@/components/ui/skeleton';

const TeamManagementTab = () => {
  const { user } = useUser();
  const { userProfile } = useCurrentUser();

  const { organization, memberships, invitations, isLoaded: orgLoaded } = useOrganization({
    memberships: { infinite: true },
    invitations: { infinite: true },
  });

  // get the actual list of invitations
  const invitationsList = invitations?.data;

  const [localMemberships, setLocalMemberships] = useState(memberships?.data ?? []);

  useEffect(() => {
    if (memberships?.data) {
      setLocalMemberships(memberships.data);
    }
  }, [memberships?.data]);

  const handleRemoveMember = async (membershipId: string) => {
    if (!membershipId || !organization || !memberships) return;

    const confirmed = confirm('Are you sure you want to remove this member?');
    if (!confirmed) return;

    try {
      const membership = memberships.data?.find((m) => m.id === membershipId);
      if (membership) {
        await membership.destroy();
        // Update local state so the UI reflects the deletion immediately
        setLocalMemberships((prev) => prev.filter((m) => m.id !== membershipId));
        // Keep Clerk organization in sync in the background
        await organization.reload();
        toast.success("Member removed");
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!organization || !invitations) return;
    const confirmed = confirm('Revoke this invitation?');
    if (!confirmed) return;

    try {
      const invitation = invitationsList?.find((inv) => inv.id === invitationId);
      if (invitation) {
        await invitation.revoke();
        await organization.reload();
        toast.success("Invitation revoked");
      }
    } catch (error: any) {
      toast.error('Failed to revoke invitation');
    }
  };

  const canManageTeam = () => {
    const isSystemAdmin = userProfile?.role === 'admin' || user?.primaryEmailAddress?.emailAddress === 'oliverdubois10@gmail.com';
    const currentMembership = memberships?.data?.find(m => m.publicUserData?.userId === user?.id);
    const isTeamAdmin = currentMembership?.role === 'org:admin';
    return isSystemAdmin || isTeamAdmin;
  };

  if (!organization) {
    return <NoTeamState />;
  }

  return (
    <div className="flex-1 space-y-8">
      <div className="grid gap-6">
        <SectionCard noPadding>
          <div className="flex-1">
            {!orgLoaded || !memberships?.data ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <MemberTable
                memberships={localMemberships}
                currentUserId={user?.id}
                onRemove={handleRemoveMember}
              />
            )}

            {invitations?.data && invitations.data.length > 0 && (
              <div className="mt-8 border-t border-white/10 pt-6 px-4 pb-4">
                <h3 className="mb-4 text-sm font-semibold text-white/80">Pending Invitations</h3>
                <div className="space-y-2">
                  {invitations.data.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-white">{inv.emailAddress}</p>
                        <p className="text-[10px] uppercase text-white/40">{inv.role.replace('org:', '')}</p>
                      </div>
                      {canManageTeam() && (
                        <button onClick={() => handleRevokeInvitation(inv.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default TeamManagementTab;
