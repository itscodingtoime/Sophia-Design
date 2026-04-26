import { useRef, useState, useEffect } from 'react';
import { useOrganizationList } from '@clerk/clerk-react';
import { LayoutGrid, GitBranch, RotateCcw } from 'lucide-react';

import TeamCard from './TeamCard';
import TeamOrgChart from './OrgChart';
import { useAllTeamsOrgData } from '../../hooks/useAllTeamsOrgData';
import Button from '../../generic/Button';
import { C } from '../../theme';

type AllTeamsViewProps = {
    view?: 'list' | 'chart';
};

const AllTeamsView = ({ view: forcedView }: AllTeamsViewProps = {}) => {
    const [view, setView] = useState<'list' | 'chart'>(forcedView ?? 'list');
    const effectiveView = forcedView ?? view;
    const hideToggle = forcedView != null;

    const { userMemberships, isLoaded } = useOrganizationList({
        userMemberships: { infinite: true },
    });

    // Fetch org chart data when chart view is active
    const { data: orgChartData, loading: orgChartLoading } = useAllTeamsOrgData();
    const [chartData, setChartData] = useState<typeof orgChartData>([]);
    const initialChartDataRef = useRef<typeof orgChartData>([]);

    useEffect(() => {
        if (!orgChartLoading && orgChartData.length > 0) {
            const cloned = structuredClone(orgChartData);

            initialChartDataRef.current = cloned;
            setChartData(cloned);
        }
    }, [orgChartLoading, orgChartData]);

    function handleResetChart() {
        setChartData(structuredClone(initialChartDataRef.current));
    }


    if (!isLoaded) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div style={{ color: C.textDim }}>Loading teams...</div>
            </div>
        );
    }

    const teams = userMemberships.data?.map((mem) => mem.organization) || [];

    return (
        <div className="space-y-6">
            {!hideToggle && <h2 className="mb-6 text-xl font-semibold" style={{ color: C.text }}>Your Teams</h2>}
            {/* Toggle view between team list and org chart (hidden when used as tab content) */}
            {!hideToggle && (
                <div style={{ borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.border }}>
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setView('list')}
                            className="px-3 py-2 text-sm font-medium transition-all border-b-2 flex items-center gap-2"
                            style={view === 'list'
                                ? { color: C.teal, borderBottomColor: C.teal }
                                : { color: C.text, borderBottomColor: 'transparent' }}
                        >
                            <LayoutGrid size={16} />
                            Team List
                        </button>
                        <button
                            onClick={() => setView('chart')}
                            className="px-3 py-2 text-sm font-medium transition-all border-b-2 flex items-center gap-2"
                            style={view === 'chart'
                                ? { color: C.teal, borderBottomColor: C.teal }
                                : { color: C.text, borderBottomColor: 'transparent' }}
                        >
                            <GitBranch size={16} />
                            Org Chart
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            {effectiveView === 'chart' ? (
                <div className="relative w-full overflow-hidden rounded-xl" style={{ borderWidth: 1, borderStyle: 'solid', borderColor: C.border, background: C.bgSub }}>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                        <div className="flex items-center gap-3">
                            <p className="text-xs" style={{ color: C.text }}>Click nodes to expand - Drag to pan - Scroll to zoom</p>
                        </div>
                        <Button
                            variant="secondary"

                            onClick={handleResetChart}
                            className="flex items-center gap-2"
                        >
                            <RotateCcw size={16} style={{ color: C.text }} />
                            <span className="text-xs">Reset</span>
                        </Button>
                    </div>

                    {/* Chart */}
                    {orgChartLoading ? (
                        <div className="flex h-[500px] items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: C.border, borderTopColor: C.teal }} />
                                <p style={{ color: C.textDim }}>Building organisation tree...</p>
                            </div>
                        </div>
                    ) : orgChartData.length === 0 ? (
                        <div className="flex h-[300px] flex-col items-center justify-center gap-4">
                            <p style={{ color: C.text }}>No teams to display</p>
                            <p className="text-sm" style={{ color: C.textSec }}>Create a team to see your organisation tree</p>
                        </div>
                    ) : (
                        <div className="min-h-[400px] sm:min-h-[500px] md:min-h-[600px] overflow-auto">
                            <TeamOrgChart data={chartData} />
                        </div>
                    )}
                </div>
            ) : teams.length === 0 ? (
                <div className="rounded-xl p-12 text-center backdrop-blur-xs" style={{ background: C.card, borderWidth: 1, borderStyle: 'solid', borderColor: C.border }}>
                    <h3 className="text-xl font-semibold" style={{ color: C.text }}>No teams found</h3>
                    <p className="mt-2" style={{ color: C.text }}>You aren't a member of any teams yet. Click "Create Team" to get started.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {teams.map((team) => (
                        <TeamCard key={team.id} organization={team} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AllTeamsView;
