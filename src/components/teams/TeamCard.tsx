import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UploadCloud } from 'lucide-react';
import { useOrganizationList } from '@clerk/clerk-react';
import Button from '../../generic/Button';
import { C } from '../../theme';

interface TeamCardProps {
    organization: any; // Using any for Clerk Organization resource
}

const TeamCard = ({ organization }: TeamCardProps) => {
    const navigate = useNavigate();
    const { setActive } = useOrganizationList({
        userMemberships: { infinite: true },
    });
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchMembers = async () => {
            try {
                // Fetch members for this organization
                // Clerk's organization resource has a getMemberships method
                const response = await organization.getMemberships();
                if (isMounted) {
                    setMembers(response.data || []);
                }
            } catch (error) {
                console.error('Error fetching members for team:', organization.name, error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchMembers();

        return () => {
            isMounted = false;
        };
    }, [organization]);

    const handleNavigateToTeam = async (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (setActive) {
            try {
                await setActive({ organization: organization.id });
                navigate('/teams');
            } catch (error) {
                console.error('Error setting active organization:', error);
            }
        }
    };

    return (
        <div
            className="relative overflow-hidden rounded-xl p-4 transition-all gap-4 hover-card px-5 py-4 shadow-sm hover:shadow-md"
            style={{ background: C.bgSub, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}
            onClick={handleNavigateToTeam}
        >
            <div className="relative z-10 flex items-center gap-6 ">
                {/* Team name and member count */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight truncate" style={{ color: C.text }}>{organization.name}</h3>
                    <p className="mt-1 text-xs font-medium" style={{ color: C.text }}>
                        {loading ? '...' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
                    </p>
                </div>

                {/* Members preview */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {loading ? (
                        <div className="flex gap-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
                            ))}
                        </div>
                    ) : members.length > 0 ? (
                        <>
                            <div className="flex -space-x-2">
                                {members.slice(0, 4).map((membership) => (
                                    <div
                                        key={membership.id}
                                        className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden"
                                        title={membership.publicUserData?.firstName
                                            ? `${membership.publicUserData.firstName} ${membership.publicUserData.lastName || ''}`
                                            : membership.publicUserData?.identifier || 'Unknown Member'}
                                    >
                                        {membership.publicUserData?.imageUrl ? (
                                            <img
                                                src={membership.publicUserData.imageUrl}
                                                alt=""
                                                className="h-full w-full rounded-full object-cover"
                                                title="View members"
                                            />
                                        ) : (
                                            <User size={14} className="text-white/60" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            {members.length > 4 && (
                                <span className="text-xs text-white/50 ml-1">+{members.length - 4}</span>
                            )}
                        </>
                    ) : (
                        <span className="text-xs text-white/40">No members</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamCard;
