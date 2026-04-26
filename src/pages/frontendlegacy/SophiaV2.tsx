import { useState, useEffect, useRef, useCallback } from "react";
import { useClerk } from '@clerk/clerk-react';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  getTeams, getTeamMembers, getDashboardStats,
  getCalendarStatus, connectCalendar, getCalendarEvents, disconnectCalendar,
  getMeetings, uploadMeeting,
  type Team, type TeamMember, type DashboardStats, type CalendarEventDTO, type Meeting as ApiMeeting,
} from '../services/api';
import {
  listSessions, startSession, deleteSession as apiDeleteSession,
  getSessionMessages, sendMessage,
  getProfile, updatePreference,
  type CoachSession, type CoachMessage, type CoachProfile,
} from '../services/coach';

import { C, THEMES, useThemeMode } from '../theme';
import type { ThemeMode } from '../theme';
import { SophiaWhiteOrb, CrystalStudioOrb } from '../components/orbs';

// ─── Types ───
interface StudioMember {
  name: string;
  role: string;
}
interface Studio {
  id: string;
  name: string;
  description: string;
  members: StudioMember[];
  warmth: number;
  trend: "up" | "down" | "flat";
  orbColors: { primary: number; secondary: number; accent: number };
  latestObs: string;
  lastMeeting: string;
}
interface PeriodData {
  label: string;
  warmth: number;
  phase: string;
  insight: string;   // what's currently happening for this score
  start: string[];   // behaviours to start doing
  stop: string[];    // behaviours to stop doing
  keep: string[];    // behaviours to keep doing
}
interface StudioDataEntry {
  weeks: PeriodData[];
  months: PeriodData[];
  quarters: PeriodData[];
}

// ─── Data (mutable — updated from API in SophiaV2()) ───
let STUDIOS: Record<string, Studio> = {};

// Mutable user object — updated from API in SophiaV2()
let USER = { name: "Loading...", role: "", email: "" };

// ─── Feature Weightings per Studio (10 core features from classification spec) ───
const FEATURE_LABELS: { key: string; label: string; short: string; neg: string }[] = [
  { key: "ownership", label: "Ownership", short: "Ownership", neg: "Externalisation" },
  { key: "inquiry", label: "Inquiry", short: "Inquiry", neg: "Premature Closure" },
  { key: "challenge", label: "Constructive Challenge", short: "Challenge", neg: "Avoidance" },
  { key: "sharing", label: "Info Sharing", short: "Sharing", neg: "Hoarding" },
  { key: "decision", label: "Decision Clarity", short: "Decisions", neg: "Ambiguity" },
  { key: "framing", label: "Positive Framing", short: "Framing", neg: "Negative Framing" },
  { key: "participation", label: "Inclusive Participation", short: "Inclusion", neg: "Concentrated" },
  { key: "overlap", label: "Collaborative Overlap", short: "Collab", neg: "Competitive Interruption" },
  { key: "regulation", label: "Regulation", short: "Regulation", neg: "Escalation" },
  { key: "future", label: "Future Orientation", short: "Future", neg: "Past Focus" },
];

let STUDIO_FEATURES: Record<string, Record<string, number>> = {};

// SOPHIA question prompts per studio (contextual to their dynamics)
const SOPHIA_PROMPTS: Record<string, string> = {
  sales: "How are we balancing competition with collaboration this week?",
  product: "What tension are we avoiding that needs to surface?",
  creative: "What risk did we take this week that stretched us?",
};

let STUDIO_DATA: Record<string, StudioDataEntry> = {
  sales: {
    weeks: [
      { label: "Jan 6", warmth: 0.35, phase: "Forming", insight: "The team operates as five individuals sharing a target. Pipeline reviews are status updates — zero cross-pollination or collective problem-solving happening yet.", start: ["Ask one open question per meeting and wait 10 seconds before speaking", "Pair two reps on a shared prospect this week"], stop: ["Jumping in with solutions when someone raises a blocker", "Running meetings as round-robin status updates"], keep: ["Strong individual accountability — everyone delivers", "Consistent meeting cadence and structure"] },
      { label: "Jan 13", warmth: 0.42, phase: "Forming", insight: "First peer-to-peer moment: one rep asked another for input on a complex deal. Small but significant — competition is beginning to soften.", start: ["Publicly celebrate the collaboration moment in your next standup", "Create a shared wins channel for cross-team deal support"], stop: ["Comparing individual numbers in group settings", "Answering questions directed at other team members"], keep: ["The emerging peer-to-peer dynamic — don\u2019t force it", "Individual target ownership alongside team goals"] },
      { label: "Jan 20", warmth: 0.38, phase: "Storming", insight: "Monthly targets triggered old competitive patterns. One team member went noticeably quiet — the collaboration gains from last week are fragile.", start: ["Check in privately with the quiet team member", "Reframe targets: \u2018how did we help each other win this week?\u2019"], stop: ["Leading with individual metrics in team meetings", "Ignoring withdrawal signals from quieter members"], keep: ["Awareness that collaboration should be the goal", "The team\u2019s growing discomfort with pure competition"] },
      { label: "Jan 27", warmth: 0.50, phase: "Storming", insight: "You celebrated a team win instead of individual numbers and the energy in the room shifted visibly. Two reps problem-solved together for the first time.", start: ["Open each meeting with a \u2018who helped you this week\u2019 round", "Let the team propose solutions before you weigh in"], stop: ["Being the first to answer every strategic question", "Framing wins as individual achievements"], keep: ["Celebrating collective moments — the team responds to it", "The two reps\u2019 natural partnership — let it develop"] },
      { label: "Feb 3", warmth: 0.55, phase: "Storming", insight: "Pipeline review had genuine debate for the first time. A team member challenged a pricing assumption and the group engaged instead of deferring to you.", start: ["Assign a \u2018challenger\u2019 role each meeting to normalise pushback", "After debate, summarise what the team decided — not what you decided"], stop: ["Resolving disagreements too quickly to keep things moving", "Treating polite agreement as alignment"], keep: ["The emerging willingness to challenge assumptions", "Your restraint in not jumping to conclusions"] },
      { label: "Feb 10", warmth: 0.48, phase: "Storming", insight: "Q1 pressure hit and you reverted to solution mode. The room went quiet instantly. The pattern is clear: stress triggers your control instinct.", start: ["When stressed, say \u2018I\u2019m feeling the pressure — what do you all think?\u2019", "Take a breath before responding to urgent problems in meetings"], stop: ["Solving problems for the team under deadline pressure", "Interpreting silence as agreement rather than shutdown"], keep: ["The team\u2019s faster recovery time — resilience is building", "Your self-awareness about this pattern"] },
      { label: "Feb 17", warmth: 0.60, phase: "Norming", insight: "Breakthrough: you caught yourself stepping in and paused. Someone else filled the space with a strong idea. Natural working pairs are forming.", start: ["Name what you\u2019re doing: \u2018I\u2019m going to hold back and let you run with this\u2019", "Give pairs ownership of specific deal strategies"], stop: ["Restructuring or assigning pairs — let them form naturally", "Stepping in when the pause feels uncomfortable"], keep: ["The conscious pause before speaking — it\u2019s working", "Trusting the team\u2019s emerging self-organisation"] },
      { label: "Feb 24", warmth: 0.65, phase: "Norming", insight: "The team analysed a lost deal together without blame. Members are building on each other\u2019s ideas — real collective intelligence is emerging.", start: ["Run a monthly \u2018retrospective\u2019 on team dynamics, not just deals", "Ask high performers how they can stretch into mentoring roles"], stop: ["Treating losses as failures — the team is learning from them", "Over-protecting high performers from team responsibilities"], keep: ["The blame-free post-mortem culture that\u2019s developing", "Building on ideas rather than competing with them"] },
      { label: "Feb 28", warmth: 0.68, phase: "Norming", insight: "The team is solving problems together before bringing them to you. Trust is building — people name problems directly. Your leadership role is evolving.", start: ["Start delegating meeting facilitation to different team members", "Share this progress with the team — they deserve to see their growth"], stop: ["Solving things they can now solve themselves", "Hovering over decisions the team has already made"], keep: ["Holding the space — every time you don\u2019t solve it, they get stronger", "Direct, honest communication the team has built"] },
    ],
    months: [
      { label: "September", warmth: 0.18, phase: "Forming", insight: "Five solo performers chasing individual quotas. No shared rituals, no collective identity. Meetings are transactional — update, assign, dismiss.", start: ["Observe team interactions without intervening for one full week", "Identify which reps already have natural rapport"], stop: ["Assuming revenue output reflects team health", "Treating pipeline reviews as your only team touchpoint"], keep: ["Individual drive and self-sufficiency", "Consistent quota attainment across the board"] },
      { label: "October", warmth: 0.32, phase: "Forming", insight: "One rep quietly helped another close a tricky deal but didn’t mention it publicly. Collaboration exists in whispers — the culture doesn’t yet reward it.", start: ["Publicly acknowledge any cross-team support you spot", "Ask in 1:1s: ‘who helped you this month?’"], stop: ["Only celebrating closed-won as an individual stat", "Ignoring informal collaboration happening below the surface"], keep: ["The latent willingness to help — it’s there, just hidden", "Strong personal accountability on targets"] },
      { label: "November", warmth: 0.20, phase: "Forming", insight: "End-of-quarter pressure amplified individualism. The team competed for the same leads and trust eroded. Classic tragedy of the commons in a sales org.", start: ["Clarify territory boundaries to reduce internal competition", "Introduce a team-level bonus component, even small"], stop: ["Pitting reps against each other on the same accounts", "Treating Q4 intensity as normal operating mode"], keep: ["Hunger to win — just redirect it from individual to collective", "Self-awareness that the quarter was dysfunctional"] },
      { label: "December", warmth: 0.28, phase: "Forming", insight: "Pre-SOPHIA baseline. Five individuals sharing a revenue target — no team intelligence, meetings are status updates, wins and losses stay siloed.", start: ["Introduce one collaborative exercise per week", "Ask the team what \u2018working together\u2019 could look like"], stop: ["Running every meeting as a round-robin update", "Celebrating only individual achievements"], keep: ["Strong individual accountability", "Consistent delivery against personal targets"] },
      { label: "January", warmth: 0.48, phase: "Storming", insight: "First real signs of collaboration emerged alongside old competitive patterns. Monthly targets triggered regression but peer-to-peer conversations are beginning.", start: ["Reframe one team metric around collective outcomes", "Create space for the team to solve a problem without you"], stop: ["Leading with individual leaderboards", "Resolving tension too quickly — let it develop"], keep: ["The emerging peer dynamic — one rep is naturally leading this shift", "Your growing awareness of when you over-control"] },
      { label: "February", warmth: 0.62, phase: "Norming", insight: "Real momentum. The team is learning to self-organise, solve problems collectively, and communicate directly. Your role is shifting from solver to enabler.", start: ["Hand over meeting facilitation on a rotating basis", "Set up a team retrospective focused on how you work together"], stop: ["Reverting to control mode under pressure", "Answering questions the team can answer themselves"], keep: ["Self-organisation and natural pair formation", "Blame-free analysis of wins and losses"] },
    ],
    quarters: [
      { label: "Q3 2025", warmth: 0.22, phase: "Forming", insight: "Individual contributor culture. High revenue performance but zero collective intelligence — wins and losses are completely siloed.", start: ["Begin exploring team coaching approaches", "Audit current meeting structures for collaboration gaps"], stop: ["Rewarding only individual performance", "Assuming high revenue means healthy team dynamics"], keep: ["Revenue consistency", "Individual accountability structures"] },
      { label: "Q4 2025", warmth: 0.30, phase: "Forming", insight: "First experiments with SOPHIA. The team is sceptical but curious. No resistance, but no enthusiasm either.", start: ["Share early pattern observations with the team transparently", "Set realistic expectations — change takes quarters, not weeks"], stop: ["Over-hyping the tool — let results speak", "Expecting immediate behaviour change"], keep: ["The team\u2019s openness to trying something new", "Your commitment to evolving your leadership"] },
      { label: "Q1 2026", warmth: 0.55, phase: "Norming", insight: "Transformation underway. From individuals to a functioning team. Collaboration is becoming habitual and collective problem-solving is real.", start: ["Set team-level OKRs alongside individual targets", "Begin coaching high performers into leadership roles"], stop: ["Micromanaging decisions the team can now own", "Treating collaboration as optional or nice-to-have"], keep: ["Your evolving leadership style — it\u2019s driving this change", "The team\u2019s growing trust and direct communication"] },
    ],
  },
  product: {
    weeks: [
      { label: "Jan 6", warmth: 0.38, phase: "Forming", insight: "Efficient but disconnected. Tasks get done reliably but nobody questions whether they should be done differently. Execution without innovation.", start: ["End each standup with \u2018what should we be doing differently?\u2019", "Give one person permission to challenge the plan each sprint"], stop: ["Treating efficiency as the only metric of success", "Moving past raised concerns without exploring them"], keep: ["Reliable delivery cadence — nothing drops", "Clear ownership and accountability on every task"] },
      { label: "Jan 13", warmth: 0.40, phase: "Forming", insight: "The lead runs tight, efficient meetings but leaves no room for input. The team follows rather than contributes — the lead\u2019s strength is also the bottleneck.", start: ["Add 5 minutes of unstructured discussion to every meeting", "Ask the quietest person in the room for their view first"], stop: ["Filling every silence with the next agenda item", "Treating meetings as information delivery sessions"], keep: ["Meeting structure and time discipline", "Clear task ownership after each session"] },
      { label: "Jan 20", warmth: 0.42, phase: "Forming", insight: "A team member raised a process concern. It was acknowledged but moved past too quickly — concerns need to be held, not just heard.", start: ["When someone raises a concern, ask \u2018tell me more\u2019 before moving on", "Create a \u2018parking lot\u2019 for ideas that deserve deeper exploration"], stop: ["Acknowledging concerns and immediately moving to next topic", "Equating \u2018heard\u2019 with \u2018addressed\u2019"], keep: ["That someone spoke up — this is new and valuable", "The team\u2019s growing comfort with voicing opinions"] },
      { label: "Jan 27", warmth: 0.38, phase: "Forming", insight: "Good ideas are being shared after meetings in private, not during them. The thinking is strong but psychological safety isn\u2019t there yet.", start: ["Open a shared doc where ideas can be added anonymously before meetings", "Respond to every idea with curiosity before evaluation"], stop: ["Evaluating ideas immediately — it signals \u2018wrong answer\u2019 risk", "Assuming the meeting captured all the thinking in the room"], keep: ["The quality of thinking happening — the talent is there", "Low-pressure 1:1s where real ideas surface"] },
      { label: "Feb 3", warmth: 0.44, phase: "Storming", insight: "A logistics crisis forced real-time problem solving and the team was better than expected. The capability exists — it\u2019s the culture holding them back.", start: ["Simulate crisis-style collaboration: short, focused problem-solving sprints", "Debrief the crisis response: \u2018what did we do differently and why did it work?\u2019"], stop: ["Waiting for emergencies to unlock collaboration", "Returning to command-and-control after the crisis passes"], keep: ["The problem-solving energy — find ways to trigger it without a real crisis", "Consistent output even during disruption"] },
      { label: "Feb 10", warmth: 0.40, phase: "Forming", insight: "Crisis energy faded and so did collaboration. The team snapped back to steady-state execution. They need a reason to collaborate beyond emergencies.", start: ["Introduce weekly \u2018design challenges\u2019 that require multiple perspectives", "Build structured debate into sprint planning"], stop: ["Accepting \u2018fine\u2019 as good enough for team dynamics", "Treating collaboration as a crisis-only tool"], keep: ["Consistent, reliable output", "The memory of what good collaboration felt like"] },
      { label: "Feb 17", warmth: 0.42, phase: "Forming", insight: "A team member challenged a vendor decision. The lead listened but didn\u2019t change course — unclear if the challenge was truly absorbed.", start: ["After pushback, visibly adjust the plan — even slightly — to show input matters", "Ask challengers to propose alternatives, not just objections"], stop: ["Listening without changing — it erodes trust in speaking up", "Making decisions before the meeting and using discussion as theatre"], keep: ["The fact that challenges are happening — this is real progress", "The lead\u2019s composure when being challenged"] },
      { label: "Feb 24", warmth: 0.41, phase: "Forming", insight: "Flat trajectory. The unspoken tension between speed and quality is the elephant in every room. The team needs permission to slow down and think together.", start: ["Dedicate one meeting per sprint to \u2018thinking time\u2019 with no action items", "Name the speed-vs-quality tension explicitly and invite the team to solve it"], stop: ["Optimising every meeting for efficiency — some need to be exploratory", "Avoiding the hard conversation about what quality really means here"], keep: ["Team stability — no conflict, no turnover risk", "The foundation of trust that allows this tension to exist safely"] },
    ],
    months: [
      { label: "September", warmth: 0.30, phase: "Forming", insight: "The team ships reliably but never questions the spec. Execution is strong, innovation is zero. They build what they’re told and nothing more.", start: ["Ask the team to propose one improvement per sprint", "Run a ‘what could go wrong’ exercise on the next feature"], stop: ["Hand-delivering fully formed specs with no room for input", "Measuring success solely by on-time delivery"], keep: ["Rock-solid delivery cadence", "Clear ownership and zero dropped balls"] },
      { label: "October", warmth: 0.44, phase: "Forming", insight: "A developer proposed an alternative approach in standup and was politely ignored. The idea was good — the culture just doesn’t have a muscle for it.", start: ["Circle back to that ignored suggestion and explore it publicly", "Create 10% time for the team to experiment with their own ideas"], stop: ["Rewarding only predictable output", "Treating suggestions as disruptions to the sprint"], keep: ["Willingness to speak up despite the culture gap", "Low-ego approach to work — no one is territorial"] },
      { label: "November", warmth: 0.30, phase: "Forming", insight: "Deadline crunch killed the experimentation momentum. The team reverted to heads-down execution and went quiet. Pressure is the enemy of culture change here.", start: ["Protect one meeting per sprint from deadline pressure", "Debrief the crunch: what did we sacrifice and was it worth it?"], stop: ["Cancelling growth-oriented meetings when deadlines loom", "Treating sprint pressure as a reason to stop investing in culture"], keep: ["The memory of October’s brief openness — the team knows it’s possible", "Resilience under pressure — they always deliver"] },
      { label: "December", warmth: 0.35, phase: "Forming", insight: "Reliable but rigid. Executes well but doesn\u2019t innovate or challenge. Agreement masks avoidance — the team needs creative tension.", start: ["Introduce a \u2018what if we\u2019re wrong?\u2019 question to each planning session", "Rotate meeting facilitation to distribute voice"], stop: ["Treating agreement as alignment", "Rewarding only delivery speed"], keep: ["Predictable, reliable delivery", "Strong individual accountability"] },
      { label: "January", warmth: 0.45, phase: "Forming", insight: "Small movements. Individual voices are starting to emerge but aren\u2019t being amplified. The lead needs coaching on creating space.", start: ["Coach the lead on asking questions instead of giving answers", "Amplify quiet voices: \u2018I noticed you had a thought — tell us\u2019"], stop: ["Letting strong voices dominate every discussion", "Moving past input without acknowledging its value"], keep: ["Growing individual willingness to speak up", "The team\u2019s openness to change"] },
      { label: "February", warmth: 0.42, phase: "Forming", insight: "Flattest trend across your studios. Not declining but not growing either. The status quo is comfortable enough to persist — needs active intervention.", start: ["Set an explicit team goal around decision quality, not just speed", "Run a team workshop on productive disagreement"], stop: ["Accepting plateau as stability", "Hoping culture will shift without structured intervention"], keep: ["Solid foundation — no regression to protect", "Individual willingness to try new approaches"] },
    ],
    quarters: [
      { label: "Q4 2025", warmth: 0.35, phase: "Forming", insight: "A well-oiled machine that doesn\u2019t ask why. Efficient, predictable, reliable — but not intelligent as a collective.", start: ["Introduce cross-functional collaboration experiments", "Set up retrospectives focused on \u2018how\u2019 not just \u2018what\u2019"], stop: ["Measuring success only by output volume", "Assuming smooth execution means healthy dynamics"], keep: ["Delivery reliability", "Clear role definitions and ownership"] },
      { label: "Q1 2026", warmth: 0.41, phase: "Forming", insight: "Marginal improvement. The bottleneck is cultural, not capability. The team is open to change but not yet driving it.", start: ["Give the team a problem to solve without leadership input", "Reward the first person who constructively disagrees in a meeting"], stop: ["Solving problems for the team", "Protecting the team from productive discomfort"], keep: ["Openness to change", "Consistent baseline performance"] },
    ],
  },
  creative: {
    weeks: [
      { label: "Jan 6", warmth: 0.55, phase: "Norming", insight: "Already the strongest team from day one. Creative culture naturally breeds psychological safety — people experiment freely and share openly.", start: ["Set a specific creative stretch goal that pushes beyond the comfort zone", "Invite someone from another team to sit in on a brainstorm"], stop: ["Assuming high baseline means the work is done", "Coasting on natural chemistry without intentional growth"], keep: ["The experimentation-first culture — it's your competitive advantage", "Psychological safety that lets people take creative risks"] },
      { label: "Jan 13", warmth: 0.60, phase: "Norming", insight: "The creative director shared a failed concept first and the team followed with their own. Leader vulnerability is creating team-wide permission to be imperfect.", start: ["Have a different team member open each meeting with a 'what I got wrong' moment", "Document the vulnerability pattern — it's replicable for other teams"], stop: ["Relying solely on the lead to set the tone for openness", "Treating vulnerability as a leadership tactic rather than a team norm"], keep: ["Leader modelling — it's textbook and it's working", "The ripple effect: one person's honesty unlocks everyone's"] },
      { label: "Jan 20", warmth: 0.63, phase: "Norming", insight: "A team member challenged the lead's direction on the rebrand and was welcomed. The whole room relaxed visibly. Upward challenge is safe here — that's rare and valuable.", start: ["Test peer-to-peer challenge: can team members push back on each other?", "Create a 'devil's advocate' rotation so challenge becomes structural"], stop: ["Assuming upward challenge means all-directional challenge", "Over-praising the challenge — normalise it, don't celebrate it"], keep: ["The lead's genuine receptiveness to pushback", "The team's growing confidence to disagree openly"] },
      { label: "Jan 27", warmth: 0.58, phase: "Storming", insight: "Client rejection hit the team hard. They took it personally before regrouping — shared emotional investment is a strength but recovery took two days.", start: ["Build a 30-minute 'reset ritual' after setbacks — debrief, feel, refocus", "Separate critique of work from critique of people explicitly"], stop: ["Letting emotional processing stretch beyond one day", "Taking client feedback as a personal judgement on the team"], keep: ["Shared emotional investment — the team genuinely cares about their work", "The fact that they regrouped without external intervention"] },
      { label: "Feb 3", warmth: 0.68, phase: "Norming", insight: "The team workshopped the client rejection together and came back with something objectively better. Failure recovery is becoming this team's superpower — they alchemise setbacks.", start: ["Run individual check-ins after high-energy recoveries to catch unprocessed frustration", "Document what made the recovery work so you can replicate it deliberately"], stop: ["Assuming high energy post-recovery means everyone is fine", "Skipping the emotional debrief because the output is strong"], keep: ["The collaborative recovery process — it produces better work", "Team ownership of failures as collective challenges, not individual blame"] },
      { label: "Feb 10", warmth: 0.72, phase: "Performing", insight: "Two team members co-created a content strategy in real time — beautiful collective thinking. Ideas built on ideas without ego. But others were quieter during this dynamic.", start: ["Actively invite quieter members into co-creation moments", "Rotate creative partnerships so co-creation isn't exclusive"], stop: ["Letting the loudest creative voices dominate collaborative sessions", "Mistaking two people's synergy for whole-team alignment"], keep: ["Spontaneous co-creation — it's producing genuinely innovative work", "The ego-free idea-building dynamic between those two"] },
      { label: "Feb 17", warmth: 0.70, phase: "Performing", insight: "Sustained high performance. The team disagrees freely and recovers quickly. Slight dip from last week is normal — even performing teams have natural cycles.", start: ["Use this stable period to stretch into new creative territory", "Invite the team to reflect on how they've changed since January"], stop: ["Panicking about small dips — they're healthy oscillation", "Pushing for continuous upward trajectory — it's unsustainable"], keep: ["Creative risk-taking at its peak", "The speed of conflict-to-resolution — it's getting faster every week"] },
      { label: "Feb 24", warmth: 0.75, phase: "Performing", insight: "A team member proposed scrapping two weeks of work for a better direction and nobody flinched. The team trusts each other enough to waste time together — highest form of creative safety.", start: ["Celebrate the pivot explicitly — the team needs to know this behaviour is valued", "Ask contributors of scrapped work how they feel — don't assume they're fine"], stop: ["Assuming that 'nobody flinched' means nobody felt the loss", "Treating sunk cost flexibility as automatic — it's earned trust"], keep: ["The willingness to kill darlings for better work", "Trust deep enough to change direction without defensiveness"] },
      { label: "Feb 28", warmth: 0.78, phase: "Performing", insight: "Your strongest team. People challenge each other freely and recover quickly. The culture here is what you're trying to grow across the whole company.", start: ["Have this team mentor or buddy with other teams", "Document their cultural practices as a playbook for the organisation"], stop: ["Isolating this team's success — it needs to spread", "Treating them as 'the good team' in ways that create comparison pressure"], keep: ["Everything about how this team communicates", "The organic, self-sustaining nature of their psychological safety"] },
    ],
    months: [
      { label: "September", warmth: 0.40, phase: "Forming", insight: "Strong individual talent but the creative director dominates every review. Ideas flow one direction — from the top. The team executes vision rather than co-creating it.", start: ["Have the creative director present last instead of first", "Ask each team member to bring an unfinished idea to the next review"], stop: ["Leading with the director’s concept in every brief", "Evaluating ideas against the director’s style as the benchmark"], keep: ["High craft standards — the work quality is excellent", "Genuine passion for the discipline across the team"] },
      { label: "October", warmth: 0.55, phase: "Norming", insight: "The director deliberately held back in a brainstorm and two juniors filled the space with surprisingly bold concepts. The room felt different — lighter, more electric.", start: ["Make the director’s step-back a regular practice, not a one-off", "Pair juniors on a live brief without senior oversight"], stop: ["Reverting to hierarchical reviews after the experiment", "Over-praising the juniors — normalise their contribution instead"], keep: ["The energy shift when hierarchy was flattened", "The director’s willingness to experiment with their own role"] },
      { label: "November", warmth: 0.40, phase: "Storming", insight: "A client-facing deadline exposed a trust fracture — the director took over the final presentation without consulting the team. Two people felt their work was erased.", start: ["Debrief the takeover honestly: what drove it and how did it land?", "Agree on a handoff protocol for high-stakes presentations"], stop: ["Overriding team decisions under pressure, even with good intentions", "Treating client-facing moments as too important for the team to own"], keep: ["The fact that people felt strongly enough to be hurt — they’re invested", "The director’s growing awareness that control has costs"] },
      { label: "December", warmth: 0.50, phase: "Norming", insight: "Natural psychological safety from shared creative values gives this team a head start. But creative culture doesn't automatically equal healthy culture — it needs probing.", start: ["Run a team health check to validate assumptions about safety", "Introduce structured feedback beyond creative critique"], stop: ["Assuming creative openness means emotional openness", "Treating creative chemistry as a substitute for team development"], keep: ["The natural safety baseline — it's rare and valuable", "Shared creative values as a foundation for deeper trust"] },
      { label: "January", warmth: 0.65, phase: "Norming", insight: "Steady growth driven by leadership vulnerability. The lead's willingness to share failures first is accelerating team development beyond what structure alone could achieve.", start: ["Begin transitioning tone-setting from leader-driven to team-driven", "Introduce peer-to-peer feedback alongside upward challenge"], stop: ["Over-relying on the lead's style as the only growth engine", "Conflating leader-initiated vulnerability with team-wide openness"], keep: ["The vulnerability-permission cycle — it's producing measurable growth", "The lead's authentic, non-performative approach to openness"] },
      { label: "February", warmth: 0.73, phase: "Performing", insight: "The model team. Self-sustaining culture where the team polices its own dynamics. If every team operated like this, you'd have a fundamentally different company.", start: ["Connect this team's learnings to other teams — they have insights to share", "Challenge them with cross-functional projects that test their culture in new contexts"], stop: ["Letting them become insular or self-congratulatory", "Using them as a comparison benchmark that pressures other teams"], keep: ["Self-sustaining cultural dynamics — the team corrects itself", "The organic evolution from leader-driven to team-driven growth"] },
    ],
    quarters: [
      { label: "Q4 2025", warmth: 0.50, phase: "Norming", insight: "Strong cultural foundation. Creative values provide natural psychological safety, but this is cultural rather than structural — it needs intentional reinforcement to sustain.", start: ["Build structural supports to reinforce the cultural foundation", "Begin documenting what makes this team's dynamics work"], stop: ["Assuming culture will sustain itself without attention", "Taking the creative foundation for granted"], keep: ["Openness, vulnerability, and experimentation as defaults", "The team's natural comfort with ambiguity and iteration"] },
      { label: "Q1 2026", warmth: 0.70, phase: "Performing", insight: "Exceptional growth trajectory. Trust and constructive challenge coexist beautifully. This team is proof of concept for what SOPHIA-supported development can achieve.", start: ["Use this team's story to inspire others — but frame it as possibility, not pressure", "Set stretch goals that test their culture at higher stakes"], stop: ["Creating comparison pressure with other teams", "Treating their success as inevitable rather than earned"], keep: ["The balance of trust and challenge — it's the engine of their performance", "Your leadership approach with this team — it's a model for the others"] },
    ],
  },
};

// ─── Shared UI Components ───
const Avatar = ({ name, size = 38, image, bgColor, ringColor }: { name: string; size?: number; image?: string | null; bgColor?: string | null; ringColor?: string | null }) => {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const glowColor = ringColor || `hsla(${hue},50%,55%,1)`;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: image ? `url(${image}) center/cover no-repeat` : bgColor || `linear-gradient(135deg, hsla(${hue},40%,30%,0.9), hsla(${hue + 40},35%,20%,0.95))`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "#fff",
      boxShadow: `0 0 0 3px ${glowColor}88, 0 0 12px ${glowColor}44`,
      flexShrink: 0,
      letterSpacing: 0.5, textShadow: "0 1px 3px rgba(0,0,0,0.25)",
    }}>
      {!image && initials}
    </div>
  );
};

/* ─── Orb Wrappers preserving existing API ─── */
const SophiaOrb = ({ intensity = 0.5, size = 80, hueA = 25, hueB = 275, hueC = 45 }: {
  intensity?: number; size?: number; animate?: boolean; hueA?: number; hueB?: number; hueC?: number;
}) => <CrystalStudioOrb warmth={intensity} size={size} dominantHue={hueA} secondaryHue={hueB} colorBlend={0.35} />;

const StudioOrb = ({ warmth = 0.5, size = 80, orbColors }: {
  warmth?: number; size?: number; orbColors: { primary: number; secondary: number; accent: number };
}) => (
  <CrystalStudioOrb warmth={warmth} size={size} dominantHue={orbColors.primary} secondaryHue={orbColors.secondary} colorBlend={0.35} ringColor={`hsla(${orbColors.primary}, 55%, 60%, 0.5)`} />
);

const GlowOrb = ({ intensity, orbColors }: { intensity: number; orbColors: { primary: number; secondary: number; accent: number } }) => (
  <CrystalStudioOrb warmth={intensity} size={120} dominantHue={orbColors.primary} secondaryHue={orbColors.secondary} colorBlend={0.35} ringColor={`hsla(${orbColors.primary}, 55%, 60%, 0.45)`} />
);

const TrendIndicator = ({ studioId }: { studioId: string }) => {
  const data = STUDIO_DATA[studioId];
  if (!data) return null;
  const weeks = data.weeks;
  if (weeks.length < 2) return null;
  const current = weeks[weeks.length - 1].warmth;
  const previous = weeks[weeks.length - 2].warmth;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isUp = change > 0;
  const isFlat = Math.abs(change) < 0.5;
  const arrow = isFlat ? "→" : isUp ? "↑" : "↓";
  const color = isFlat ? C.amber : isUp ? C.teal : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
      <span style={{ fontSize: 13 }}>{arrow}</span>
      {Math.abs(change).toFixed(1)}%
    </div>
  );
};

const TrendPercent = ({ periods, activeIdx, label }: { periods: PeriodData[]; activeIdx: number; label: string }) => {
  // Calculate % change from previous period
  const current = periods[activeIdx]?.warmth || 0;
  const previous = activeIdx > 0 ? periods[activeIdx - 1]?.warmth : periods[0]?.warmth;
  const prevVal = previous || current;
  const change = prevVal > 0 ? ((current - prevVal) / prevVal) * 100 : 0;
  const isUp = change > 0;
  const isFlat = Math.abs(change) < 0.5;
  const arrow = isFlat ? "→" : isUp ? "↑" : "↓";
  const color = isFlat ? C.amber : isUp ? C.teal : C.red;

  return (
    <div style={{ textAlign: "center", marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 300, color, fontFamily: "'Josefin Sans', sans-serif", letterSpacing: -1 }}>
          {arrow} {Math.abs(change).toFixed(1)}%
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>
        {label} · {isFlat ? "Steady" : isUp ? "Strengthening" : "Dipping"} vs previous
      </div>
    </div>
  );
};

// ─── Studio Card ───
const StudioCard = ({ studio, isActive, onSelect }: { studio: Studio; isActive: boolean; onSelect: (id: string) => void }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onSelect(studio.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 24, width: "100%", padding: "24px 28px",
        background: isActive ? C.activeBg : hovered ? C.cardHover : C.card,
        backdropFilter: "blur(28px) saturate(1.2)", WebkitBackdropFilter: "blur(28px) saturate(1.2)",
        border: `1px solid ${isActive ? C.tealBorder : C.border}`,
        borderRadius: 18, cursor: "pointer", transition: "all 0.35s ease",
        fontFamily: "'Tomorrow', sans-serif", textAlign: "left",
        boxShadow: hovered ? "0 8px 36px rgba(0,0,0,0.32)" : "0 2px 16px rgba(0,0,0,0.18)",
      }}
    >
      <RainbowOrb studioId={studio.id} warmth={studio.warmth} size={72} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 500, color: C.text, letterSpacing: 0.3 }}>{studio.name}</div>
          <TrendIndicator studioId={studio.id} />
        </div>
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 10 }}>{studio.description}</div>
        <div style={{
          fontSize: 12.5, color: C.textDim, lineHeight: 1.6, fontStyle: "italic",
          overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
        }}>
          &ldquo;{studio.latestObs}&rdquo;
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {studio.members.slice(0, 4).map((m, i) => (
              <div key={i} style={{ marginLeft: i > 0 ? -8 : 0, position: "relative", zIndex: 4 - i }}>
                <Avatar name={m.name} size={26} ringColor={getStudioColor(studio.id)} />
              </div>
            ))}
            {studio.members.length > 4 && (
              <div style={{
                marginLeft: -8, width: 26, height: 26, borderRadius: "50%",
                background: C.elevated, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 600, color: C.textDim, border: `1px solid ${C.border}`,
              }}>+{studio.members.length - 4}</div>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.textDim }}>{studio.members.length} members</div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: C.textDim }}>{studio.lastMeeting}</div>
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? C.teal : C.textDim} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: "stroke 0.2s" }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
};

// ─── Mini Sparkline (smooth cubic bezier with glowing endpoint) ───
const MiniSparkline = ({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data) - 0.05;
  const max = Math.max(...data) + 0.05;
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));
  // Catmull-Rom → cubic bezier smooth curve (no straight segments)
  const tension = 0.3;
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  // Build filled area path: line path + close to bottom-right → bottom-left
  const areaD = d + ` L${pts[pts.length - 1].x.toFixed(2)},${height} L${pts[0].x.toFixed(2)},${height} Z`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-fill-${color.replace('#','')})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
      {/* Glowing endpoint — concentric rings fading outward (static, no animation) */}
      <circle cx={last.x} cy={last.y} r="5" fill={color} opacity="0.12" />
      <circle cx={last.x} cy={last.y} r="3.5" fill={color} opacity="0.3" />
      <circle cx={last.x} cy={last.y} r="2" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
};

// ─── Trend Word (replaces Tuckman phase labels) ───
const getTrendWord = (studioId: string): { word: string; color: string; pct: string } => {
  const data = STUDIO_DATA[studioId];
  if (!data) return { word: "Unknown", color: C.textDim, pct: "0%" };
  const weeks = data.weeks;
  if (weeks.length < 2) return { word: "New", color: C.textDim, pct: "0%" };
  const current = weeks[weeks.length - 1].warmth;
  const previous = weeks[weeks.length - 2].warmth;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const pctStr = (change >= 0 ? "\u2191 " : "\u2193 ") + Math.abs(change).toFixed(1) + "%";
  // Also look at 3-week trend for richer context
  const threeBack = weeks.length >= 4 ? weeks[weeks.length - 4].warmth : weeks[0].warmth;
  const longerChange = threeBack > 0 ? ((current - threeBack) / threeBack) * 100 : 0;

  if (current >= 0.75 && change >= 0) return { word: "Thriving", color: "#7ED68A", pct: pctStr };
  if (current >= 0.6 && change > 3) return { word: "Accelerating", color: C.teal, pct: pctStr };
  if (current >= 0.6 && change >= 0) return { word: "Growing", color: C.teal, pct: pctStr };
  if (change > 5) return { word: "Surging", color: C.teal, pct: pctStr };
  if (change > 0 && longerChange > 0) return { word: "Climbing", color: C.teal, pct: pctStr };
  if (Math.abs(change) < 1.5 && current >= 0.5) return { word: "Steady", color: C.amber, pct: pctStr };
  if (Math.abs(change) < 1.5 && current < 0.5) return { word: "Plateaued", color: C.amber, pct: pctStr };
  if (change < -3) return { word: "Cooling", color: C.red, pct: pctStr };
  if (change < 0) return { word: "Dipping", color: C.amber, pct: pctStr };
  return { word: "Emerging", color: C.textDim, pct: pctStr };
};

// ─── Feature Weighting Tooltip ───
const DONUT_COLORS = [
  "#E87840", // 0 Ownership — Ember (energy, taking charge) +20%
  "#58C8E8", // 1 Inquiry — Sky Steel (clarity, communication) +20%
  "#D85878", // 2 Challenge — Terracotta Rose (empathy in challenge) +20%
  "#E8B820", // 3 Sharing — Solar (open sharing, achievement) +20%
  "#B868E0", // 4 Decision — Amethyst (cognition, analysis) +20%
  "#48D898", // 5 Framing — Sage Mint (growth, positive) +20%
  "#2850D8", // 6 Participation — Royal Blue (calm, inclusive) +20%
  "#70C858", // 7 Overlap — Fern (fresh collaboration) +20%
  "#D84848", // 8 Regulation — Dusty Coral (self-control) +20%
  "#5878C8", // 9 Future — Steel Indigo (looking ahead) +20%
];

// Get dominant feature color for a studio — used by graphs, rings, sparklines to match the orb
const getStudioColor = (studioId: string): string => {
  const features = STUDIO_FEATURES[studioId];
  if (!features) return C.teal;
  const entries = FEATURE_LABELS.map((f, i) => ({ w: features[f.key] || 0, ci: i }));
  const dom = [...entries].sort((a, b) => b.w - a.w)[0];
  return DONUT_COLORS[dom.ci];
};

// Build a smooth, blended conic-gradient from feature weights + colors.
// Colours flow into each other organically — no hard stops, no pie-chart look.
const buildConicGradient = (studioId: string): string => {
  const features = STUDIO_FEATURES[studioId];
  if (!features) return "conic-gradient(from -90deg, #E8913A, #5B8DEF)";
  const entries = FEATURE_LABELS.map((f, i) => ({ raw: features[f.key] || 0, ci: i }));
  const total = entries.reduce((s, e) => s + e.raw, 0);
  // Interleave big/small for maximum colour mixing
  const sorted = [...entries].sort((a, b) => b.raw - a.raw);
  const interleaved: typeof entries = [];
  let lo = 0, hi = sorted.length - 1;
  while (lo <= hi) {
    if (lo === hi) { interleaved.push(sorted[lo]); break; }
    interleaved.push(sorted[lo++]);
    interleaved.push(sorted[hi--]);
  }
  // Smooth stops: place each colour at the MIDPOINT of its segment so CSS blends between them
  let cumulative = 0;
  const stops: string[] = [];
  interleaved.forEach(e => {
    const pct = e.raw / total;
    const midPct = ((cumulative + pct / 2) * 100).toFixed(1);
    cumulative += pct;
    stops.push(`${DONUT_COLORS[e.ci]} ${midPct}%`);
  });
  // Close the loop — repeat the first colour at 100% so it wraps smoothly
  stops.push(`${DONUT_COLORS[interleaved[0].ci]} 100%`);
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
};

// ─── Rainbow Orb — feature-color conic gradient with liquid fill + outer ring ───
const RainbowOrb = ({ studioId, warmth = 0.5, size = 120 }: { studioId: string; warmth?: number; size?: number }) => {
  const w = Math.max(0, Math.min(1, warmth));
  const conicGrad = buildConicGradient(studioId);
  const fillPct = w * 100;
  const glowAlpha = 0.04 + w * 0.36;
  const edgeAlpha = 0.06 + w * 0.16;
  const specAlpha = 0.15 + w * 0.5;
  // Wave amplitude — gentle, subtle motion
  const waveAmp = size * 0.045 * Math.max(0.25, Math.min(w, 1 - w, 0.45) / 0.45);
  const waveY = size * (1 - w);
  // Unique animation offset per studio
  const animDelay = studioId === "sales" ? 0 : studioId === "product" ? -2.5 : -5;
  // Outer ring sizing
  const ringGap = Math.max(3, size * 0.06);
  const ringWidth = Math.max(1.5, size * 0.02);
  const totalSize = size + (ringGap + ringWidth) * 2;
  const features = STUDIO_FEATURES[studioId];
  const oc = STUDIOS[studioId]?.orbColors;
  // Ring color derived from dominant feature color (matches donut ring)
  const domFeature = features ? FEATURE_LABELS.map((f, i) => ({ w: features[f.key] || 0, ci: i })).sort((a, b) => b.w - a.w)[0] : null;
  const domHex = domFeature ? DONUT_COLORS[domFeature.ci] : null;
  const ringColor = domHex ? `${domHex}${Math.round((0.25 + w * 0.45) * 255).toString(16).padStart(2, '0')}` : (oc ? `hsla(${oc.primary},60%,60%,${0.25 + w * 0.45})` : `rgba(127,193,170,${0.2 + w * 0.4})`);
  const ringGlow = domHex ? `${domHex}${Math.round((w * 0.3) * 255).toString(16).padStart(2, '0')}` : (oc ? `hsla(${oc.primary},70%,65%,${w * 0.3})` : "transparent");

  return (
    <div style={{ position: "relative", width: totalSize, height: totalSize, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Outer ring */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        border: `${ringWidth}px solid ${ringColor}`,
        boxShadow: `0 0 ${size * 0.08}px ${ringGlow}, inset 0 0 ${size * 0.04}px ${ringGlow}`,
        animation: "crystalPulse 6s ease-in-out infinite alternate",
        transition: "border-color 0.6s ease, box-shadow 0.6s ease",
      }} />
      {/* Floor glow */}
      {w > 0.1 && <div style={{
        position: "absolute", bottom: ringGap * 0.3, left: "15%", width: "70%", height: "35%", borderRadius: "50%",
        background: `radial-gradient(ellipse, rgba(232,145,58,${glowAlpha * 0.6}) 0%, rgba(232,145,58,${glowAlpha * 0.25}) 50%, transparent 75%)`,
        filter: `blur(${size * 0.12}px)`, zIndex: 0,
      }} />}
      {/* Main sphere shell — centered inside the ring */}
      <div style={{
        position: "relative", width: size, height: size, borderRadius: "50%", overflow: "hidden", zIndex: 1,
        background: C.hoverBg,
      }}>
        {/* Empty glass top */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 65%)`,
          zIndex: 1,
        }} />
        {/* Liquid fill with animated wave surface — 3 layers for more dynamic motion */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          <defs>
            <clipPath id={`wave-${studioId}-${size}`}>
              <path>
                <animate
                  attributeName="d"
                  dur="2.8s"
                  repeatCount="indefinite"
                  begin={`${animDelay}s`}
                  values={`
                    M0,${waveY} C${size * 0.15},${waveY - waveAmp * 1.2} ${size * 0.3},${waveY + waveAmp} ${size * 0.5},${waveY} C${size * 0.7},${waveY - waveAmp} ${size * 0.85},${waveY + waveAmp * 1.2} ${size},${waveY} L${size},${size} L0,${size} Z;
                    M0,${waveY + waveAmp * 0.5} C${size * 0.2},${waveY + waveAmp * 1.3} ${size * 0.4},${waveY - waveAmp * 1.1} ${size * 0.5},${waveY - waveAmp * 0.3} C${size * 0.6},${waveY + waveAmp * 0.8} ${size * 0.8},${waveY - waveAmp * 1.2} ${size},${waveY - waveAmp * 0.4} L${size},${size} L0,${size} Z;
                    M0,${waveY - waveAmp * 0.3} C${size * 0.25},${waveY - waveAmp * 1.4} ${size * 0.35},${waveY + waveAmp * 1.2} ${size * 0.5},${waveY + waveAmp * 0.4} C${size * 0.65},${waveY - waveAmp * 0.6} ${size * 0.75},${waveY + waveAmp * 1.3} ${size},${waveY + waveAmp * 0.5} L${size},${size} L0,${size} Z;
                    M0,${waveY} C${size * 0.15},${waveY - waveAmp * 1.2} ${size * 0.3},${waveY + waveAmp} ${size * 0.5},${waveY} C${size * 0.7},${waveY - waveAmp} ${size * 0.85},${waveY + waveAmp * 1.2} ${size},${waveY} L${size},${size} L0,${size} Z
                  `.trim()}
                />
              </path>
            </clipPath>
            <clipPath id={`wave2-${studioId}-${size}`}>
              <path>
                <animate
                  attributeName="d"
                  dur="3.4s"
                  repeatCount="indefinite"
                  begin={`${animDelay - 1}s`}
                  values={`
                    M0,${waveY + waveAmp * 0.4} C${size * 0.2},${waveY + waveAmp} ${size * 0.35},${waveY - waveAmp * 0.8} ${size * 0.5},${waveY + waveAmp * 0.3} C${size * 0.65},${waveY + waveAmp * 0.9} ${size * 0.8},${waveY - waveAmp * 0.7} ${size},${waveY + waveAmp * 0.4} L${size},${size} L0,${size} Z;
                    M0,${waveY - waveAmp * 0.5} C${size * 0.2},${waveY - waveAmp * 0.9} ${size * 0.35},${waveY + waveAmp} ${size * 0.5},${waveY - waveAmp * 0.4} C${size * 0.65},${waveY - waveAmp * 0.7} ${size * 0.8},${waveY + waveAmp * 0.9} ${size},${waveY - waveAmp * 0.5} L${size},${size} L0,${size} Z;
                    M0,${waveY + waveAmp * 0.4} C${size * 0.2},${waveY + waveAmp} ${size * 0.35},${waveY - waveAmp * 0.8} ${size * 0.5},${waveY + waveAmp * 0.3} C${size * 0.65},${waveY + waveAmp * 0.9} ${size * 0.8},${waveY - waveAmp * 0.7} ${size},${waveY + waveAmp * 0.4} L${size},${size} L0,${size} Z
                  `.trim()}
                />
              </path>
            </clipPath>
            <clipPath id={`wave3-${studioId}-${size}`}>
              <path>
                <animate
                  attributeName="d"
                  dur="4.6s"
                  repeatCount="indefinite"
                  begin={`${animDelay - 2.3}s`}
                  values={`
                    M0,${waveY - waveAmp * 0.2} C${size * 0.3},${waveY + waveAmp * 0.6} ${size * 0.5},${waveY - waveAmp * 0.5} ${size * 0.7},${waveY + waveAmp * 0.3} C${size * 0.85},${waveY - waveAmp * 0.4} ${size * 0.95},${waveY + waveAmp * 0.5} ${size},${waveY} L${size},${size} L0,${size} Z;
                    M0,${waveY + waveAmp * 0.3} C${size * 0.2},${waveY - waveAmp * 0.7} ${size * 0.45},${waveY + waveAmp * 0.6} ${size * 0.6},${waveY - waveAmp * 0.4} C${size * 0.75},${waveY + waveAmp * 0.5} ${size * 0.9},${waveY - waveAmp * 0.3} ${size},${waveY + waveAmp * 0.2} L${size},${size} L0,${size} Z;
                    M0,${waveY - waveAmp * 0.2} C${size * 0.3},${waveY + waveAmp * 0.6} ${size * 0.5},${waveY - waveAmp * 0.5} ${size * 0.7},${waveY + waveAmp * 0.3} C${size * 0.85},${waveY - waveAmp * 0.4} ${size * 0.95},${waveY + waveAmp * 0.5} ${size},${waveY} L${size},${size} L0,${size} Z
                  `.trim()}
                />
              </path>
            </clipPath>
          </defs>
        </svg>
        {/* Primary liquid layer — smooth blended colours */}
        <div style={{
          position: "absolute", inset: 0, clipPath: `url(#wave-${studioId}-${size})`, zIndex: 2,
        }}>
          {/* Base colour layer — moderate blur for smooth blending */}
          <div style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.08}px)`, opacity: 0.85,
          }} />
          {/* Soft glow layer — more diffuse for organic feel */}
          <div style={{
            position: "absolute", inset: "5%", borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.14}px)`, opacity: 0.4,
          }} />
          {/* Slow rotating overlay — creates swirl movement */}
          <div style={{
            position: "absolute", inset: "-15%", borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.2}px)`, opacity: 0.25,
            animation: "iridRotate 18s linear infinite", mixBlendMode: "overlay" as const,
          }} />
        </div>
        {/* Secondary wave layer — offset timing for depth */}
        <div style={{
          position: "absolute", inset: 0, clipPath: `url(#wave2-${studioId}-${size})`, zIndex: 3, opacity: 0.3,
        }}>
          <div style={{
            position: "absolute", inset: -6, borderRadius: "50%",
            background: conicGrad, filter: `blur(${size * 0.1}px)`, opacity: 0.8,
          }} />
        </div>
        {/* Third wave layer — slowest, for shimmer */}
        <div style={{
          position: "absolute", inset: 0, clipPath: `url(#wave3-${studioId}-${size})`, zIndex: 4, opacity: 0.15,
        }}>
          <div style={{
            position: "absolute", inset: -3, borderRadius: "50%",
            background: `radial-gradient(circle at 30% 60%, rgba(255,255,255,0.35), transparent 60%), ${conicGrad}`,
            filter: `blur(${size * 0.08}px)`, opacity: 0.75,
          }} />
        </div>
        {/* Colour pool at bottom — dominant colour settles here */}
        {domHex && w > 0.1 && <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(ellipse 90% 55% at 50% 90%, ${domHex}${Math.round(0.55 * 255).toString(16).padStart(2, '0')} 0%, ${domHex}${Math.round(0.3 * 255).toString(16).padStart(2, '0')} 30%, ${domHex}${Math.round(0.1 * 255).toString(16).padStart(2, '0')} 55%, transparent 75%)`,
          filter: `blur(${size * 0.05}px)`,
          zIndex: 5,
        }} />}
        {/* Glass specular — subtle so colour proportions remain readable */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(ellipse 50% 40% at 32% 28%, rgba(255,255,255,${specAlpha * 0.3}) 0%, rgba(255,255,255,${specAlpha * 0.1}) 25%, transparent 50%)`,
          zIndex: 8,
        }} />
        {/* Center glow in filled area */}
        {w > 0.2 && <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 50% ${100 - fillPct * 0.5}%, rgba(255,255,255,${w * 0.18}) 0%, transparent 45%)`,
          zIndex: 9,
        }} />}
        {/* Edge shadow ring */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          boxShadow: `inset 0 0 ${size * 0.02}px rgba(0,0,0,${edgeAlpha}), inset 0 0 ${size * 0.005}px rgba(0,0,0,${edgeAlpha * 1.5})`,
          border: `${Math.max(1, size * 0.008)}px solid rgba(0,0,0,${edgeAlpha * 0.7})`, zIndex: 11,
        }} />
        {/* Inner rim */}
        <div style={{
          position: "absolute", inset: `${Math.max(1, size * 0.01)}px`, borderRadius: "50%",
          border: `${Math.max(0.5, size * 0.004)}px solid rgba(255,255,255,${0.05 + w * 0.1})`,
          zIndex: 12, pointerEvents: "none",
        }} />
      </div>
    </div>
  );
};

const FeatureDonut = ({ studioId, orbSize = 120 }: { studioId: string; orbSize?: number }) => {
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const features = STUDIO_FEATURES[studioId];
  if (!features) return null;

  // Normalize so all features sum to 100%
  const entries = FEATURE_LABELS.map((f, i) => ({ ...f, raw: features[f.key] || 0, ci: i }));
  const total = entries.reduce((s, e) => s + e.raw, 0);
  const norm = entries.map(e => ({ ...e, pct: e.raw / total }));
  norm.sort((a, b) => b.pct - a.pct);

  const svgSize = orbSize + 200;
  const cx = svgSize / 2, cy = svgSize / 2;
  const innerR = orbSize / 2 + 18;
  const outerR = innerR + 12;
  const gap = 0.02;

  let angle = -Math.PI / 2; // Start at top (12 o'clock) for natural reading order in the standalone chart
  const segs = norm.map(e => {
    const sweep = e.pct * Math.PI * 2;
    const s = { ...e, sa: angle + gap / 2, ea: angle + sweep - gap / 2, mid: angle + sweep / 2 };
    angle += sweep;
    return s;
  });

  const arc = (ir: number, or: number, sa: number, ea: number) => {
    const c = Math.cos, s = Math.sin, la = ea - sa > Math.PI ? 1 : 0;
    return `M${cx+or*c(sa)},${cy+or*s(sa)} A${or},${or} 0 ${la} 1 ${cx+or*c(ea)},${cy+or*s(ea)} L${cx+ir*c(ea)},${cy+ir*s(ea)} A${ir},${ir} 0 ${la} 0 ${cx+ir*c(sa)},${cy+ir*s(sa)} Z`;
  };

  // ── Left / Right label columns with connector lines ──
  // Labels are split by which side of the circle their segment midpoint faces,
  // then stacked vertically with a minimum gap to prevent overlap.
  const labelGap = 10;   // horizontal distance from ring edge to label text
  const lineH = 13;      // minimum vertical space between labels
  const rightX = cx + outerR + labelGap;
  const leftX = cx - outerR - labelGap;

  type LblEntry = typeof segs[0] & { i: number; idealY: number; y: number; side: "R" | "L" };
  const rightCol: LblEntry[] = [];
  const leftCol: LblEntry[] = [];

  segs.forEach((s, i) => {
    const cosM = Math.cos(s.mid);
    const idealY = cy + (outerR + 4) * Math.sin(s.mid);
    const entry: LblEntry = { ...s, i, idealY, y: idealY, side: cosM >= 0 ? "R" : "L" };
    if (cosM >= 0) rightCol.push(entry); else leftCol.push(entry);
  });

  // Relaxation: sort by ideal Y, then push apart any that are closer than lineH
  const spreadCol = (col: LblEntry[]) => {
    col.sort((a, b) => a.idealY - b.idealY);
    for (let pass = 0; pass < 12; pass++) {
      for (let j = 1; j < col.length; j++) {
        const dy = col[j].y - col[j - 1].y;
        if (dy < lineH) {
          const push = (lineH - dy) / 2;
          col[j - 1].y -= push;
          col[j].y += push;
        }
      }
      // Keep within SVG
      const yMin = 10, yMax = svgSize - 28;
      col.forEach(l => { l.y = Math.max(yMin, Math.min(yMax, l.y)); });
    }
  };
  spreadCol(rightCol);
  spreadCol(leftCol);
  const allLabels = [...rightCol, ...leftCol];

  return (
    <div style={{
      position: "relative", width: svgSize, height: svgSize,
      overflow: "visible",
    }}>
      <svg width={svgSize} height={svgSize} style={{ overflow: "visible" }}>
        {/* Donut segments */}
        {segs.map((s, i) => (
          <path
            key={i}
            d={arc(innerR, hovIdx === i ? outerR + 4 : outerR, s.sa, s.ea)}
            fill={DONUT_COLORS[s.ci]}
            opacity={hovIdx !== null && hovIdx !== i ? 0.3 : 0.85}
            style={{ transition: "all 0.2s ease", cursor: "pointer" }}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(null)}
          />
        ))}
        {/* Connector lines + labels in left/right columns */}
        {allLabels.map(l => {
          const isHov = hovIdx === l.i;
          const pctVal = Math.round(l.pct * 100);
          const isR = l.side === "R";
          // Point on outer ring where connector starts
          const rX = cx + outerR * Math.cos(l.mid);
          const rY = cy + outerR * Math.sin(l.mid);
          // Elbow — horizontal bridge to label column
          const eX = isR ? rightX - 2 : leftX + 2;
          const tX = isR ? rightX : leftX;
          const lineOp = hovIdx !== null && hovIdx !== l.i ? 0.1 : 0.28;
          return (
            <g key={`lbl-${l.i}`}>
              <polyline
                points={`${rX},${rY} ${eX},${l.y} ${tX},${l.y}`}
                fill="none" stroke={DONUT_COLORS[l.ci]}
                strokeWidth={0.6} opacity={lineOp}
                style={{ transition: "opacity 0.2s" }}
              />
              <circle cx={rX} cy={rY} r={1.3} fill={DONUT_COLORS[l.ci]} opacity={lineOp * 1.4} />
              <text
                x={tX} y={l.y}
                textAnchor={isR ? "start" : "end"}
                dominantBaseline="central"
                fill={DONUT_COLORS[l.ci]}
                fontSize={isHov ? 10.5 : 9}
                fontWeight={isHov ? 700 : 600}
                fontFamily="'Tomorrow', sans-serif"
                opacity={hovIdx !== null && hovIdx !== l.i ? 0.35 : 1}
                style={{ transition: "all 0.2s", pointerEvents: "none" }}
              >
                {l.short} {pctVal}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* "How Culture is Measured" at the bottom */}
      <div style={{
        position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap",
        textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "'Tomorrow', sans-serif" }}>
          How Culture is Measured
        </div>
        <div style={{ fontSize: 8.5, color: C.textDim, marginTop: 1, fontFamily: "'Tomorrow', sans-serif" }}>
          Feature weightings · summed to 100%
        </div>
      </div>
    </div>
  );
};

// ─── Space Card (equal grid card) ───
const SpaceCard = ({ studio, onSelect }: { studio: Studio; onSelect: (id: string) => void }) => {
  const [hovered, setHovered] = useState(false);
  const [bubbleHover, setBubbleHover] = useState(false);
  const data = STUDIO_DATA[studio.id];
  const sparkData = data?.weeks.map(w => w.warmth) || [];
  const color = getStudioColor(studio.id);
  const trend = getTrendWord(studio.id);
  // Get latest insight
  const latestWeek = data?.weeks[data.weeks.length - 1];
  const keyInsight = latestWeek?.insight || studio.latestObs;
  const sophiaPrompt = SOPHIA_PROMPTS[studio.id] || "What patterns should I explore with this team?";

  return (
    <button
      onClick={() => onSelect(studio.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", width: "100%", padding: "28px 24px",
        background: hovered ? C.cardHover : C.card,
        backdropFilter: "blur(28px) saturate(1.2)", WebkitBackdropFilter: "blur(28px) saturate(1.2)",
        border: `1px solid ${C.border}`,
        borderRadius: 18, cursor: "pointer", transition: "all 0.35s ease",
        fontFamily: "'Tomorrow', sans-serif", textAlign: "left",
        boxShadow: hovered ? "0 8px 36px rgba(0,0,0,0.32)" : "0 2px 16px rgba(0,0,0,0.18)",
        position: "relative",
      }}
    >
      {/* Top: Orb + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <RainbowOrb studioId={studio.id} warmth={studio.warmth} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: C.text, letterSpacing: 0.3 }}>{studio.name}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{studio.description}</div>
        </div>
      </div>

      {/* SOPHIA chat bubble — own row */}
      <div
        style={{ position: "relative", marginBottom: 14 }}
        onMouseEnter={() => setBubbleHover(true)}
        onMouseLeave={() => setBubbleHover(false)}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px",
          background: bubbleHover ? C.tealGlow : C.hoverBg,
          border: `1px solid ${bubbleHover ? C.tealBorder : C.border}`,
          borderRadius: 14, transition: "all 0.25s", cursor: "default",
        }}>
          <SophiaWhiteOrb size={20} animate={false} />
          <div style={{ fontSize: 11.5, color: bubbleHover ? C.text : C.textSec, lineHeight: 1.4, fontStyle: "italic" }}>
            {sophiaPrompt}
          </div>
        </div>
      </div>

      {/* 3 equal sections with dividers: Graph + % | Insight | Team */}
      <div style={{
        display: "flex",
        background: C.hoverBg, borderRadius: 12,
        border: `1px solid ${C.border}`,
      }}>
        {/* Section 1: Graph + Trend % */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8,
          padding: "14px 16px", minWidth: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textSec, letterSpacing: 0.3 }}>{trend.word}</div>
            <TrendIndicator studioId={studio.id} />
          </div>
          <MiniSparkline data={sparkData} color={color} width={160} height={28} />
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", margin: "10px 0", background: C.border }} />

        {/* Section 2: Key Insight */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          padding: "14px 16px", minWidth: 0,
        }}>
          <div style={{
            fontSize: 11.5, color: C.textDim, lineHeight: 1.55, fontStyle: "italic",
            overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
            WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
          }}>
            &ldquo;{keyInsight}&rdquo;
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", margin: "10px 0", background: C.border }} />

        {/* Section 3: Team */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 5, padding: "14px 16px", minWidth: 0,
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4, maxWidth: 72 }}>
            {studio.members.slice(0, 6).map((m, i) => (
              <div key={i}><Avatar name={m.name} size={24} ringColor={color} /></div>
            ))}
          </div>
          {studio.members.length > 6 && (
            <span style={{ fontSize: 10, color: C.textDim }}>+{studio.members.length - 6}</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 10 }}>{studio.lastMeeting}</div>
    </button>
  );
};

// ─── Score Ring (donut chart with glowing terminator dot) ───
const ScoreRing = ({ score, color, size = 72 }: { score: number; color: string; size?: number }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score / 100, 0), 1);
  const dash = circ * pct;
  const gap = circ - dash;
  // Compute arc endpoint for glowing terminator dot
  const angle = pct * 2 * Math.PI;
  const dotX = size / 2 + r * Math.cos(angle);
  const dotY = size / 2 + r * Math.sin(angle);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={5} opacity={0.3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5.5}
          strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}44)`, transition: "stroke-dasharray 0.6s ease" }} />
        {/* Glowing terminator dot at arc tip */}
        {pct > 0.02 && (
          <>
            <circle cx={dotX} cy={dotY} r={size * 0.065} fill={color} opacity="0.15" />
            <circle cx={dotX} cy={dotY} r={size * 0.045} fill={color} opacity="0.4" />
            <circle cx={dotX} cy={dotY} r={size * 0.028} fill="#fff" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          </>
        )}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 0,
      }}>
        <div style={{ fontSize: size * 0.3, fontWeight: 300, color: C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {score}
        </div>
      </div>
    </div>
  );
};

// ─── Spaces Overview Card (shown when no space is selected) ───
const SpacesOverview = ({ onSelectStudio }: { onSelectStudio: (id: string) => void }) => {
  const allStudios = Object.values(STUDIOS);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "36px 32px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 400, fontFamily: "'Josefin Sans', sans-serif", color: C.text, letterSpacing: 0.3 }}>Culture Health</div>
          <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 4 }}>Overview of team dynamics across all teams</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {allStudios.map(s => {
            const data = STUDIO_DATA[s.id];
            const latestWeek = data?.weeks[data.weeks.length - 1];
            const trend = getTrendWord(s.id);
            const sparkData = data?.weeks.map(w => w.warmth) || [];
            const studioColor = getStudioColor(s.id);
            const sparkColor = studioColor;
            const ringColor = studioColor;
            const keyInsight = latestWeek?.insight || s.latestObs;
            const score = Math.round(s.warmth * 100);
            return (
              <button
                key={s.id}
                onClick={() => onSelectStudio(s.id)}
                style={{
                  display: "flex", alignItems: "stretch", width: "100%",
                  borderRadius: 20, cursor: "pointer",
                  background: C.card, backdropFilter: "blur(24px) saturate(1.2)",
                  border: `1px solid ${C.border}`, textAlign: "left",
                  fontFamily: "'Tomorrow', sans-serif",
                  boxShadow: `0 2px 16px ${C.shadowColor}`,
                  transition: "all 0.3s ease", overflow: "hidden",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.18)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.boxShadow = `0 2px 16px ${C.shadowColor}`; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Column 1: Orb + Team Info */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "24px 24px", gap: 12, minWidth: 140,
                }}>
                  <RainbowOrb studioId={s.id} warmth={s.warmth} size={88} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: 0.2 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>{s.description.length > 34 ? s.description.slice(0, 34) + "..." : s.description}</div>
                  </div>
                </div>

                {/* Thin divider */}
                <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "16px 0" }} />

                {/* Column 2: Insight */}
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
                  padding: "20px 24px", minWidth: 0, gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <SophiaWhiteOrb size={14} animate={false} />
                    <span style={{ fontSize: 9, color: C.teal, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Latest Insight</span>
                  </div>
                  <div style={{
                    fontSize: 12.5, color: C.textSec, lineHeight: 1.65, fontStyle: "italic",
                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                    WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
                  }}>
                    &ldquo;{keyInsight}&rdquo;
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500 }}>{latestWeek?.phase || ""}</div>
                </div>

                {/* Thin divider */}
                <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "16px 0" }} />

                {/* Column 3: Score Ring */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "20px 20px", gap: 6, minWidth: 100,
                }}>
                  <ScoreRing score={score} color={ringColor} size={72} />
                  <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Score</div>
                </div>

                {/* Thin divider */}
                <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "16px 0" }} />

                {/* Column 4: Trend */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "20px 20px", gap: 8, minWidth: 110,
                }}>
                  <div style={{ fontSize: 14, color: trend.color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{trend.pct}</div>
                  <div style={{ fontSize: 11, color: trend.color, fontWeight: 600, letterSpacing: 0.3 }}>{trend.word}</div>
                  <MiniSparkline data={sparkData} color={sparkColor} width={80} height={28} />
                </div>

                {/* Chevron */}
                <div style={{ display: "flex", alignItems: "center", paddingRight: 14, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Culture Health View (right sidebar + popout detail) ───
const SpacesView = ({ activeStudioId, onSelectStudio, onPopoutChange }: { activeStudioId: string; onSelectStudio: (id: string) => void; onPopoutChange: (open: boolean) => void }) => {
  const { mode: themeMode } = useThemeMode();
  const isDark = themeMode === "dark";
  const allStudios = Object.values(STUDIOS);
  const [openStudio, setOpenStudio] = useState<string | null>(null);

  const handleOpen = (id: string) => {
    onSelectStudio(id);
    setOpenStudio(id);
    onPopoutChange(true);
  };
  const handleClose = () => {
    setOpenStudio(null);
    onPopoutChange(false);
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
      {/* Main area — overview dashboard when no popout */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
        filter: openStudio ? "blur(4px)" : "none", opacity: openStudio ? 0.4 : 1,
        transition: "filter 0.3s ease, opacity 0.3s ease",
        pointerEvents: openStudio ? "none" : "auto",
      }}>
        <SpacesOverview onSelectStudio={handleOpen} />
      </div>

      {/* Right sidebar — culture health list — stays sharp, never blurs */}
      <div style={{
        width: 270, minWidth: 270, borderLeft: `1px solid ${C.border}`,
        background: C.panelBg, backdropFilter: "blur(28px) saturate(1.2)",
        display: "flex", flexDirection: "column", overflowY: "auto",
        zIndex: 60,
      }}>
        <div style={{ padding: "20px 18px 12px", fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>
          Culture Health
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px 20px" }}>
          {allStudios.map(s => {
            const isActive = openStudio === s.id;
            const trend = getTrendWord(s.id);
            return (
              <button
                key={s.id}
                onClick={() => handleOpen(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                  background: isActive ? C.activeBg : "transparent",
                  border: "none", borderLeft: isActive ? `3px solid ${C.teal}` : "3px solid transparent",
                  transition: "all 0.2s ease", textAlign: "left",
                  fontFamily: "'Tomorrow', sans-serif",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.hoverBg; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <RainbowOrb studioId={s.id} warmth={s.warmth} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? C.text : C.textSec, letterSpacing: 0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: trend.color, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                      {Math.round(s.warmth * 100)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.description}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <TrendIndicator studioId={s.id} />
                    <span style={{ fontSize: 10, color: trend.color, fontWeight: 500 }}>{trend.word}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Popout modal — Notion rectangle with dimmed backdrop (only covers main area, not right sidebar) */}
      {openStudio && (
        <div
          onClick={handleClose}
          style={{
            position: "absolute", top: 0, bottom: 0, left: 0, right: 270,
            zIndex: 55,
            background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeSlide 0.25s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(920px, calc(100% - 48px))",
              maxHeight: "min(600px, calc(100% - 64px))",
              background: isDark ? C.bg : "#ffffff", borderRadius: 12,
              border: `1px solid ${C.border}`,
              boxShadow: "0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
              overflowY: "auto", overflowX: "hidden",
              position: "relative",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                position: "absolute", top: 12, right: 12, zIndex: 10,
                width: 32, height: 32, borderRadius: 8, border: "none",
                background: C.hoverBg, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.elevated; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.hoverBg; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSec} strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <SpaceDetail studioId={openStudio} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Space Detail (Notion-style content pane) ───
const SpaceDetail = ({ studioId }: { studioId: string }) => {
  const studio = STUDIOS[studioId];
  const data = STUDIO_DATA[studioId];
  if (!studio || !data) return null;

  const [timeframe, setTimeframe] = useState<"weeks" | "months" | "quarters">("weeks");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showWeighting, setShowWeighting] = useState(false);
  const [showInsightHistory, setShowInsightHistory] = useState(false);

  useEffect(() => { setSelectedIdx(null); setTimeframe("weeks"); }, [studioId]);

  const timeframeLabels = { weeks: "Weeks", months: "Months", quarters: "Quarters" };
  const timeframeOptions: ("weeks" | "months" | "quarters")[] = ["weeks", "months", "quarters"];
  const periods = data[timeframe] || [];
  const activeIdx = selectedIdx !== null && selectedIdx < periods.length ? selectedIdx : periods.length - 1;
  const activePeriod = periods[activeIdx];
  const currentWarmth = activePeriod?.warmth || 0;
  const trend = getTrendWord(studioId);

  const graphColor = getStudioColor(studioId);
  const graphColorDim = graphColor + "26";
  const graphColorMid = graphColor + "66";
  const graphGlow = graphColor + "99";

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>

      {/* ── HERO: Orb takes up top ~1/3, blurs content on hover ── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 24px 14px", minHeight: 280,
        background: `radial-gradient(ellipse 90% 80% at 50% 45%, ${C.hoverBg}, transparent)`,
        position: "relative", zIndex: 5,
      }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <RainbowOrb studioId={studioId} warmth={currentWarmth} size={200} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 400, fontFamily: "'Josefin Sans', sans-serif", letterSpacing: 0.3, color: C.text, textAlign: "center" }}>
          {studio.name}
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 3, textAlign: "center" }}>{studio.description}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 300, color: C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
            {Math.round(currentWarmth * 100)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <TrendIndicator studioId={studioId} />
              <span style={{ fontSize: 12, color: trend.color, fontWeight: 600 }}>{trend.word}</span>
            </div>
            <span style={{ fontSize: 11, color: C.textDim }}>{activePeriod?.phase || ""}</span>
          </div>
        </div>

        {/* ── Trend line — full width under orb ── */}
        <div style={{ width: "100%", marginTop: 18, padding: "0 8px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 10, gap: 6 }}>
            {timeframeOptions.map(tf => (
              <button key={tf} onClick={() => { setTimeframe(tf); setSelectedIdx(null); }} style={{
                padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: timeframe === tf ? 600 : 400,
                fontFamily: "'Tomorrow', sans-serif", cursor: "pointer", letterSpacing: 0.3,
                background: timeframe === tf ? C.tealGlow : "transparent",
                border: `1px solid ${timeframe === tf ? C.tealBorder : "transparent"}`,
                color: timeframe === tf ? C.teal : C.textDim, transition: "all 0.2s",
              }}>{timeframeLabels[tf]}</button>
            ))}
          </div>
          <div style={{ position: "relative", height: 140 }}>
            {(() => {
              const vh = 140;
              const padPct = 4; // percentage padding
              const usablePct = 100 - padPct * 2;
              const gapPct = periods.length > 1 ? usablePct / (periods.length - 1) : 0;
              const pxPct = (i: number) => padPct + i * gapPct;
              const py = (p: PeriodData) => vh - p.warmth * vh;
              const pyPct = (p: PeriodData) => ((1 - p.warmth) * 100);
              return (<>
                <svg width="100%" height={vh} style={{ overflow: "visible", position: "absolute", inset: 0 }}>
                  <line x1={`${padPct}%`} y1={vh * 0.65} x2={`${100 - padPct}%`} y2={vh * 0.65} stroke={C.border} strokeDasharray="3 3" strokeWidth="0.5" />
                  <line x1={`${padPct}%`} y1={vh * 0.45} x2={`${100 - padPct}%`} y2={vh * 0.45} stroke={C.border} strokeDasharray="3 3" strokeWidth="0.5" />
                  <line x1={`${padPct}%`} y1={vh * 0.25} x2={`${100 - padPct}%`} y2={vh * 0.25} stroke={C.border} strokeDasharray="3 3" strokeWidth="0.5" />
                </svg>
                <svg width="100%" height={vh} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" style={{ overflow: "visible", position: "absolute", inset: 0 }}>
                  {periods.length > 1 && (() => {
                    const cPts = periods.map((p, i) => ({ x: pxPct(i), y: py(p) }));
                    const t = 0.3;
                    let d = `M${cPts[0].x},${cPts[0].y}`;
                    for (let j = 0; j < cPts.length - 1; j++) {
                      const q0 = cPts[Math.max(0, j - 1)], q1 = cPts[j], q2 = cPts[j + 1], q3 = cPts[Math.min(cPts.length - 1, j + 2)];
                      d += ` C${q1.x + (q2.x - q0.x) * t},${q1.y + (q2.y - q0.y) * t} ${q2.x - (q3.x - q1.x) * t},${q2.y - (q3.y - q1.y) * t} ${q2.x},${q2.y}`;
                    }
                    const areaD = d + ` L${cPts[cPts.length - 1].x},${vh} L${cPts[0].x},${vh} Z`;
                    return (<>
                      <defs>
                        <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={graphColor} stopOpacity="0.16" />
                          <stop offset="100%" stopColor={graphColor} stopOpacity="0.01" />
                        </linearGradient>
                      </defs>
                      <path d={areaD} fill="url(#chart-area-fill)" />
                      <path d={d} fill="none" stroke={graphColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${graphGlow})` }} />
                    </>);
                  })()}
                </svg>
                {/* Dots + labels as HTML so they don't stretch */}
                {periods.map((p, i) => (
                  <div key={i} onClick={() => setSelectedIdx(i)} style={{
                    position: "absolute", left: `${pxPct(i)}%`, top: `${pyPct(p)}%`,
                    transform: "translate(-50%, -50%)", cursor: "pointer", zIndex: 2,
                  }}>
                    {i === activeIdx && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: graphColorDim, border: `1px solid ${graphColorMid}` }} />}
                    <div style={{
                      width: i === activeIdx ? 7 : 5, height: i === activeIdx ? 7 : 5, borderRadius: "50%",
                      background: i === activeIdx ? graphColor : C.textDim,
                      border: i === activeIdx ? `1px solid ${C.text}` : "none",
                      transition: "all 0.3s", position: "relative",
                      boxShadow: i === activeIdx ? `0 0 6px ${graphGlow}` : "none",
                    }} />
                    {i === activeIdx && (
                      <div style={{
                        position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                        marginBottom: 6, fontSize: 10, fontWeight: 700, color: C.text,
                        fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap",
                      }}>{Math.round(p.warmth * 100)}</div>
                    )}
                    <div style={{ position: "absolute", inset: -14, borderRadius: "50%" }} />
                  </div>
                ))}
              </>);
            })()}
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {periods.map((p, i) => (
              <div key={`${timeframe}-label-${i}`} onClick={() => setSelectedIdx(i)} style={{
                flex: 1, textAlign: "center", fontSize: 9,
                color: i === activeIdx ? C.text : C.textDim,
                fontWeight: i === activeIdx ? 600 : 400, cursor: "pointer", transition: "all 0.2s",
              }}>{p.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT: Single column stacked cards ── */}
      <div style={{
        padding: "0 32px 32px", maxWidth: 780, margin: "0 auto",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {activePeriod && (<>
            {/* Insight — what's happening right now */}
            <div style={{
              background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "18px 22px",
              border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.teal}`,
              boxShadow: `0 2px 12px ${C.shadowColor}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <SophiaWhiteOrb size={16} animate={false} />
                <div style={{ fontSize: 11, color: C.teal, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Insight</div>
              </div>
              <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7, fontWeight: 400 }}>{activePeriod.insight}</div>
            </div>

            {/* Start / Stop / Keep — 3 column grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {/* START */}
              <div style={{
                background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "16px 16px",
                border: `1px solid ${C.border}`, borderTop: `3px solid #7ED68A`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7ED68A" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  <div style={{ fontSize: 11, color: "#7ED68A", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Start</div>
                </div>
                {activePeriod.start.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < activePeriod.start.length - 1 ? 10 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7ED68A", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.55 }}>{item}</div>
                  </div>
                ))}
              </div>

              {/* STOP */}
              <div style={{
                background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "16px 16px",
                border: `1px solid ${C.border}`, borderTop: `3px solid ${C.amber}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  <div style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Stop</div>
                </div>
                {activePeriod.stop.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < activePeriod.stop.length - 1 ? 10 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.amber, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.55 }}>{item}</div>
                  </div>
                ))}
              </div>

              {/* KEEP */}
              <div style={{
                background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "16px 16px",
                border: `1px solid ${C.border}`, borderTop: `3px solid #7EC8E0`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7EC8E0" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <div style={{ fontSize: 11, color: "#7EC8E0", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Keep</div>
                </div>
                {activePeriod.keep.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < activePeriod.keep.length - 1 ? 10 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7EC8E0", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.55 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* Team Members — big profiles showing collective */}
          <div style={{
            background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14, padding: "20px 22px",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 16 }}>Team</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
              {studio.members.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 95 }}>
                  <Avatar name={m.name} size={68} ringColor={graphColor} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500, lineHeight: 1.3 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insight History — expandable timeline of past insights */}
          <div style={{
            background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14,
            border: `1px solid ${C.border}`, boxShadow: `0 2px 12px ${C.shadowColor}`, overflow: "hidden",
          }}>
            <button
              onClick={() => setShowInsightHistory(!showInsightHistory)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "14px 22px",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>
                  Insight History
                </span>
                <span style={{ fontSize: 10, color: C.textDim, opacity: 0.6 }}>({periods.length})</span>
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: showInsightHistory ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s ease" }}
              ><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {showInsightHistory && (
              <div style={{ padding: "0 22px 18px", animation: "donutIn 0.25s ease-out" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {periods.slice().reverse().map((p, i) => {
                    const isActive = (periods.length - 1 - i) === activeIdx;
                    return (
                      <div key={i} style={{
                        display: "flex", gap: 14, padding: "12px 0",
                        borderBottom: i < periods.length - 1 ? `1px solid ${C.border}` : "none",
                        opacity: isActive ? 1 : 0.75,
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                      }}
                      onClick={() => setSelectedIdx(periods.length - 1 - i)}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = isActive ? "1" : "0.75")}
                      >
                        {/* Timeline dot + line */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 5, width: 12, flexShrink: 0 }}>
                          <div style={{
                            width: isActive ? 10 : 7, height: isActive ? 10 : 7, borderRadius: "50%",
                            background: isActive ? graphColor : C.textDim,
                            boxShadow: isActive ? `0 0 6px ${graphGlow}` : "none",
                            transition: "all 0.2s",
                          }} />
                          {i < periods.length - 1 && (
                            <div style={{ width: 1, flex: 1, background: C.border, marginTop: 4 }} />
                          )}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: isActive ? C.text : C.textSec,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}>{p.label}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: graphColor,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}>{Math.round(p.warmth * 100)}</span>
                            <span style={{ fontSize: 10, color: C.textDim }}>{p.phase}</span>
                            {isActive && (
                              <span style={{
                                fontSize: 8, color: graphColor, background: graphColorDim,
                                padding: "1px 6px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
                              }}>Current</span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 12, color: C.textSec, lineHeight: 1.6, fontStyle: "italic",
                          }}>
                            &ldquo;{p.insight}&rdquo;
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* How Culture is Measured — expandable weighting section */}
          <div style={{
            background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 14,
            border: `1px solid ${C.border}`,
            boxShadow: `0 2px 12px ${C.shadowColor}`,
            overflow: "hidden",
          }}>
            <button
              onClick={() => setShowWeighting(!showWeighting)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "14px 22px",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
                <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>
                  How Culture is Measured
                </span>
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: showWeighting ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s ease" }}
              ><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {showWeighting && (
              <div style={{
                padding: "0 22px 20px",
                animation: "donutIn 0.25s ease-out",
              }}>
                <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6, marginBottom: 14 }}>
                  SOPHIA measures 10 features of team communication dynamics. Each feature is weighted based on its prevalence in your team's interactions.
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <FeatureDonut studioId={studioId} orbSize={160} />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Chat Components ───
const MicIcon = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.textDim} strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);


const VoiceOrb = ({ listening, speaking }: { listening: boolean; speaking: boolean }) => {
  const active = listening || speaking;
  return (
    <div style={{ position: "relative", width: 240, height: 240, margin: "0 auto", transition: "all 0.5s ease", animation: "orbFloat 5s ease-in-out infinite" }}>
      <style>{`
        @keyframes voiceRipple { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.8); opacity: 0; } }
        @keyframes voiceRipple2 { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(3.2); opacity: 0; } }
        @keyframes voiceRipple3 { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(3.6); opacity: 0; } }
        @keyframes orbFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes loginOrbSwirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes loginOrbSwirlReverse { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
        @keyframes loginOrbRadiate { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
      `}</style>
      {/* Ripple rings — exactly like login orb */}
      {[0, 1, 2].map(i => (
        <div key={`ripple-${i}`} style={{
          position: "absolute", inset: -2, borderRadius: "50%",
          border: "1.5px solid rgba(180,200,220,0.35)",
          animation: `voiceRipple${i === 0 ? "" : i === 1 ? "2" : "3"} ${3 + i * 0.6}s ease-out infinite ${i * 1.1}s`,
          pointerEvents: "none" as const,
        }} />
      ))}
      {/* Rainbow glow behind orb */}
      <div style={{
        position: "absolute", inset: -70, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, hsla(280,50%,80%,0.14) 20%, hsla(200,50%,75%,0.1) 35%, hsla(50,50%,75%,0.06) 50%, transparent 65%)",
        filter: "blur(22px)",
        animation: "loginOrbRadiate 5s ease-in-out infinite",
      }} />
      {/* Main orb body — exact copy of login orb */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden",
        background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.92) 0%, rgba(248,250,255,0.75) 20%, rgba(240,245,255,0.55) 45%, rgba(225,235,250,0.4) 70%, rgba(210,220,245,0.32) 100%)",
        boxShadow: "inset 0 0 5px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.12)",
      }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 75% 65% at 28% 25%, hsla(260,85%,68%,0.6) 0%, hsla(230,85%,72%,0.35) 30%, transparent 60%)", animation: "loginOrbSwirl 8s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 55% 70% at 18% 55%, hsla(185,90%,55%,0.65) 0%, hsla(170,85%,60%,0.3) 35%, transparent 65%)", animation: "loginOrbSwirlReverse 10s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 50% 50% at 30% 75%, hsla(140,80%,52%,0.5) 0%, hsla(120,70%,58%,0.22) 40%, transparent 65%)", animation: "loginOrbSwirl 12s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 60% 45% at 50% 80%, hsla(48,85%,60%,0.5) 0%, hsla(40,80%,65%,0.22) 40%, transparent 65%)", animation: "loginOrbSwirlReverse 9s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 50% 65% at 78% 60%, hsla(20,85%,58%,0.55) 0%, hsla(10,80%,62%,0.28) 35%, transparent 60%)", animation: "loginOrbSwirl 11s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 65% 55% at 72% 28%, hsla(330,85%,62%,0.5) 0%, hsla(310,75%,66%,0.25) 35%, transparent 60%)", animation: "loginOrbSwirlReverse 7s linear infinite" }} />
        {/* Rainbow rim ring */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "conic-gradient(from -30deg, hsla(0,90%,60%,0.65) 0%, hsla(30,90%,62%,0.6) 8%, hsla(55,90%,60%,0.55) 14%, hsla(100,85%,55%,0.5) 22%, hsla(160,90%,55%,0.55) 30%, hsla(195,90%,58%,0.6) 38%, hsla(220,90%,60%,0.65) 46%, hsla(260,90%,62%,0.6) 54%, hsla(290,85%,65%,0.55) 62%, hsla(325,90%,62%,0.55) 70%, hsla(350,90%,60%,0.6) 80%, hsla(10,90%,58%,0.6) 90%, hsla(0,90%,60%,0.65) 100%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)",
          maskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)",
          animation: "loginOrbSwirl 18s linear infinite",
        }} />
        {/* Rotating rainbow overlay wash */}
        <div style={{
          position: "absolute", inset: "-35%", borderRadius: "50%",
          background: "conic-gradient(from 0deg, hsla(0,70%,75%,0.2) 0%, hsla(45,70%,72%,0.22) 12%, hsla(90,60%,70%,0.18) 24%, hsla(160,65%,72%,0.2) 36%, hsla(210,70%,74%,0.22) 48%, hsla(260,65%,76%,0.2) 60%, hsla(310,60%,74%,0.18) 72%, hsla(340,65%,72%,0.2) 84%, hsla(0,70%,75%,0.2) 100%)",
          animation: "loginOrbSwirlReverse 14s linear infinite",
          mixBlendMode: "overlay" as const, opacity: 0.9,
        }} />
        {/* Glass core + highlights */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 45% 45%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 55% 45% at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0.15) 50%, transparent 70%)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 28% 22% at 72% 72%, rgba(255,255,255,0.35) 0%, rgba(230,240,255,0.15) 40%, transparent 70%)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "inset 0 0 3px rgba(0,0,0,0.15), inset 0 0 1px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.12)" }} />
        <div style={{ position: "absolute", inset: 1, borderRadius: "50%", border: "0.5px solid rgba(255,255,255,0.3)", pointerEvents: "none" as const }} />
      </div>
      {/* Blue rim ring */}
      <div style={{
        position: "absolute", inset: -4, borderRadius: "50%",
        border: "2px solid hsla(215,70%,60%,0.55)",
        boxShadow: "0 0 12px hsla(215,65%,55%,0.25), 0 0 25px hsla(215,60%,60%,0.12), inset 0 0 8px hsla(215,60%,70%,0.15)",
      }} />
    </div>
  );
};

interface NotifData { title: string; subtitle: string; time: string; }
const NotificationCard = ({ notification, onTap, onDismiss }: { notification: NotifData; onTap: () => void; onDismiss: () => void }) => (
  <div style={{
    margin: "16px 20px 0", padding: "16px 18px", background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
    borderRadius: 14, display: "flex", alignItems: "flex-start", gap: 14,
    animation: "notifSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1)", cursor: "pointer", transition: "background 0.2s",
  }}
    onClick={onTap}
    onMouseEnter={e => (e.currentTarget.style.background = "rgba(192,230,137,0.12)")}
    onMouseLeave={e => (e.currentTarget.style.background = C.tealGlow)}
  >
    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SophiaWhiteOrb size={32} animate={false} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal, boxShadow: `0 0 8px ${C.teal}`, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>{notification.title}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.5 }}>{notification.subtitle}</div>
      <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>{notification.time}</div>
    </div>
    <button onClick={e => { e.stopPropagation(); onDismiss(); }} style={{
      background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4,
    }}>×</button>
  </div>
);

const TranscriptLine = ({ from, text, isLive }: { from: string; text: string; isLive?: boolean }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "fadeSlide 0.3s ease", padding: "6px 0" }}>
    <div style={{
      width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2,
      background: from === "sophia" ? C.tealDeep : C.hoverBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 700, color: from === "sophia" ? C.teal : C.textDim,
    }}>
      {from === "sophia" ? "S" : "Y"}
    </div>
    <div style={{ fontSize: 13.5, color: isLive ? C.textDim : C.text, lineHeight: 1.6, fontStyle: isLive ? "italic" : "normal" }}>
      {text}
      {isLive && <span style={{ display: "inline-block", width: 4, height: 14, background: C.teal, marginLeft: 4, borderRadius: 1, animation: "pulse 1s ease infinite", verticalAlign: "middle" }} />}
    </div>
  </div>
);

// ─── Growth Rings ───
const GrowthRings = ({ rings }: { rings: { label: string; detail: string; progress: number; color: string; bgColor: string }[] }) => {
  const size = 160;
  const cx = size / 2, cy = size / 2, strokeWidth = 12, gap = 4;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => {
          const radius = size / 2 - strokeWidth / 2 - (strokeWidth + gap) * i - 10;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference * (1 - ring.progress);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke={ring.bgColor || "rgba(227,222,216,0.04)"} strokeWidth={strokeWidth} strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke={ring.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 6px ${ring.color}60)`, transition: "stroke-dashoffset 1s ease" }} />
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, width: "100%" }}>
        {rings.map((ring, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: ring.color, boxShadow: `0 0 6px ${ring.color}50`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{ring.label}</div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>{ring.detail}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ring.color, fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(ring.progress * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Info Transparency ───
const InfoTransparency = () => {
  const flows = [
    { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>, label: "Coaching conversations", dest: "Private to you" },
    { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>, label: "Growth rings", dest: "Private to you" },
    { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /></svg>, label: "Studio dynamics", dest: "Aggregated — no individual data" },
    { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>, label: "Meeting audio", dest: "Deleted after processing" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {flows.map((f, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
          borderBottom: i < flows.length - 1 ? "1px solid rgba(227,222,216,0.05)" : "none",
        }}>
          <div style={{ width: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{f.icon}</div>
          <div style={{ flex: 1, fontSize: 11.5, color: C.textSec, fontWeight: 500, minWidth: 0 }}>{f.label}</div>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 500, letterSpacing: 0.3, textAlign: "right", flexShrink: 0, maxWidth: 80, lineHeight: 1.3 }}>{f.dest}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Insights Timeline ───
const InsightsTimeline = ({ studioId }: { studioId: string }) => {
  const [timeframe, setTimeframe] = useState<"weeks" | "months" | "quarters">("weeks");
  const data = STUDIO_DATA[studioId];
  const periods = data ? [...data[timeframe]].reverse() : [];

  const warmthColor = (w: number) => w >= 0.6 ? C.teal : w >= 0.4 ? C.amber : C.red;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Timeframe switcher */}
      <div style={{ display: "flex", gap: 4 }}>
        {(["weeks", "months", "quarters"] as const).map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)} style={{
            flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 600,
            textTransform: "capitalize", letterSpacing: 0.3, cursor: "pointer",
            fontFamily: "'Tomorrow', sans-serif",
            background: timeframe === tf ? C.tealGlow : "transparent",
            border: `1px solid ${timeframe === tf ? C.tealBorder : C.border}`,
            color: timeframe === tf ? C.teal : C.textDim,
            transition: "all 0.2s",
          }}>{tf}</button>
        ))}
      </div>

      {/* Timeline cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {periods.map((period, i) => (
          <div key={i} style={{
            padding: "12px 14px", borderRadius: 10,
            background: C.hoverBg,
            borderLeft: `2px solid ${warmthColor(period.warmth)}`,
            borderTop: `1px solid ${C.border}`,
            borderRight: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{period.label}</div>
            {period.insight && (
              <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.55, fontStyle: "italic", marginBottom: 8 }}>
                &ldquo;{period.insight.slice(0, 120)}{period.insight.length > 120 ? "…" : ""}&rdquo;
              </div>
            )}
            {period.start?.[0] && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: "#7ED68A", marginTop: 2, flexShrink: 0 }}>+</span>
                <div style={{ fontSize: 11, color: C.tealMuted, lineHeight: 1.5 }}>{period.start[0]}</div>
              </div>
            )}
            {period.stop?.[0] && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ fontSize: 9, color: C.amber, marginTop: 2, flexShrink: 0 }}>×</span>
                <div style={{ fontSize: 11, color: C.amber, lineHeight: 1.5 }}>{period.stop[0]}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Prompt Suggestions ───
const PROMPT_SUGGESTIONS = [
  { title: "Debrief my last meeting", desc: "Get coaching insights from your most recent session" },
  { title: "What should I focus on?", desc: "Surface your highest-leverage growth area right now" },
  { title: "Work on my growth edge", desc: "Practice holding space during tension" },
  { title: "Team dynamics overview", desc: "How is your team evolving together?" },
];

// ─── SOPHIA Chat ───
type ConsentState = { recording: boolean; patterns: boolean; coaching: boolean; aggregation: boolean };

const SESSION_MESSAGES: Record<string, { from: string; text: string; time: string }[]> = {
  s2: [
    { from: "sophia", text: "I've been looking at patterns across your last several meetings and something stood out about your leadership style.", time: "9:15 AM" },
    { from: "sophia", text: "You're naturally collaborative in brainstorming contexts \u2014 you ask great open questions and create space for ideas. But in decision-making moments, you shift to a more directive style.\n\nThis isn't necessarily bad, but your team may be reading it as: \"Ideas are welcome, but I'll decide.\"", time: "9:15 AM" },
    { from: "user", text: "Interesting. I hadn't noticed that shift. Is it consistent?", time: "9:18 AM" },
    { from: "sophia", text: "Very consistent. In 4 of your last 5 meetings, the pattern appears. The team generates options freely, then when it's time to commit, you summarise and choose.\n\nWhat if you tried: \"Which of these options does the team feel strongest about?\" before offering your own view?", time: "9:18 AM" },
  ],
  s3: [
    { from: "sophia", text: "I observed your product standup today. A few dynamics worth noting.", time: "Yesterday" },
    { from: "sophia", text: "Jordan gave a status update that was clearly rehearsed \u2014 polished, no pauses. But when Priya asked a follow-up question, Jordan's tone shifted noticeably. There might be some tension between them around ownership of the new feature.\n\nDid you pick up on that?", time: "Yesterday" },
    { from: "user", text: "Actually yeah, I sensed something was off but I didn't want to call it out in front of everyone.", time: "Yesterday" },
    { from: "sophia", text: "That instinct to protect the space was good. But this might be worth a quiet 1:1 check-in with each of them separately. Small tensions like this tend to grow if left unaddressed.\n\nWant me to flag it if I see the pattern again in the next standup?", time: "Yesterday" },
  ],
  s4: [
    { from: "sophia", text: "The Creative Review had some strong moments today. The team energy was high and the feedback was constructive.", time: "Yesterday" },
    { from: "sophia", text: "One thing I noticed: when Emma presented her concept, Liam's feedback was quite direct and Emma went quiet for the rest of the session. The quality of her earlier contributions suggests she had more to offer.\n\nThis is a common dynamic in creative teams \u2014 directness can unintentionally shut down the people who need psychological safety to share.", time: "Yesterday" },
    { from: "user", text: "I noticed that too. Should I talk to Liam about it?", time: "Yesterday" },
  ],
  s5: [
    { from: "sophia", text: "Before your 1:1 with Jordan, here are some patterns I've noticed that might be useful.", time: "Feb 28" },
    { from: "sophia", text: "Jordan has been taking on more initiative \u2014 raising blockers early, proposing solutions instead of just flagging problems. This is real growth from where they were a month ago.\n\nBut I've also noticed they seem hesitant to push back on your suggestions. In 3 of your last 4 interactions, Jordan agreed quickly even when their body language suggested uncertainty.", time: "Feb 28" },
    { from: "user", text: "That's really helpful context. I want to encourage them to speak up more.", time: "Feb 28" },
  ],
  s6: [
    { from: "sophia", text: "I've been tracking trust-building patterns across your Sales team over the past two weeks.", time: "Feb 27" },
    { from: "sophia", text: "The team's willingness to disagree openly has increased \u2014 that's a strong signal. Rachel and David had a genuine debate about pricing strategy that was respectful and productive.\n\nThe team is also starting to solve problems without looking to you first, which connects directly to your goal of building a team that runs without you.", time: "Feb 27" },
  ],
  s7: [
    { from: "sophia", text: "Some observations from the creative campaign collaboration session.", time: "Feb 26" },
    { from: "sophia", text: "The cross-functional energy between Sales and Creative was noticeably better this time. Zoe and Rachel found common ground on messaging much faster than in previous sessions.\n\nOne area to watch: Ben tends to stay quiet when the conversation moves fast. He had a strong idea about audience targeting that almost got lost \u2014 Liam caught it and amplified it, which was a great team dynamic.", time: "Feb 26" },
  ],
  s8: [
    { from: "sophia", text: "All-Hands meetings are always interesting to observe. Here's what I saw.", time: "Feb 25" },
    { from: "sophia", text: "Your opening set the right tone \u2014 transparent about challenges while staying optimistic. The team responded well to your honesty about the Q1 numbers.\n\nI noticed the Q&A section was shorter than usual though. Only two people asked questions, and both were from leadership. The rest of the team may need more prompting to feel safe asking questions in that large a group.", time: "Feb 25" },
  ],
};

const SophiaChat = ({ activeStudio, isNewConversation, activeSessionId, onStartConversation, consent, onToggleConsent }: { activeStudio: Studio; isNewConversation: boolean; activeSessionId: string | null; onStartConversation: (title?: string) => Promise<string>; consent: ConsentState; onToggleConsent: (key: keyof ConsentState) => void }) => {
  const { mode: themeMode } = useThemeMode();
  const isDark = themeMode === "dark";
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "speaking">("idle");
  const [showNotif, setShowNotif] = useState(true);
  const [showPanel, setShowPanel] = useState(true);
  const [goalSet, setGoalSet] = useState(false);
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);

  // Auto-set goal from profile motivation
  useEffect(() => {
    if (coachProfile?.motivation && Object.keys(coachProfile.motivation).length > 0) {
      setGoalSet(true);
    }
  }, [coachProfile]);

  const [input, setInput] = useState("");
  const [started, setStarted] = useState(!isNewConversation);
  const endRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const [isTyping, setIsTyping] = useState(false);
  const [msgsLoading, setMsgsLoading] = useState(false);

  // Fetch coach profile for right sidebar (Key Goal / Working On)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile();
        if (!cancelled) setCoachProfile(profile);
      } catch {
        // Profile may not exist yet — that's ok
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // INITIAL_MSGS removed — messages now fetched from API
  const _INITIAL_MSGS_REMOVED = useRef([
    { from: "sophia", text: "Good session with the Sales team today. The energy was noticeably different \u2014 two of your reps were building on each other\u2019s ideas instead of pitching separately. That\u2019s new.", time: "10:42 AM" },
    { from: "sophia", text: "I noticed something worth exploring. When a team member brought up the issue with lead quality, the conversation shifted \u2014 you jumped in pretty quickly with a solution. The room went quiet after that.\n\nI\u2019m curious about what was happening for you in that moment.", time: "10:42 AM" },
    { from: "user", text: "Honestly, I just wanted to keep things moving. We were running long and I could feel people checking out.", time: "10:44 AM" },
    { from: "sophia", text: "That instinct to keep momentum makes sense \u2014 especially when you\u2019re running a business and every minute counts. But here\u2019s what I saw: the person who raised it was about to get support from the room. Others were leaning in, nodding.\n\nWhen you solved it for them, you removed the need for them to solve it together. The efficiency gain cost you a trust-building moment.", time: "10:44 AM" },
    { from: "user", text: "Damn. Yeah, I do that a lot, don\u2019t I?", time: "10:46 AM" },
    { from: "sophia", text: "You do. I\u2019ve seen it in three of the last four meetings. The pattern is consistent \u2014 you create openness early, then close it when tension arrives.\n\nThe good news is that the opening is genuine. Your team trusts you because of how you start these conversations. The next edge for you is holding that space through the uncomfortable parts too.\n\nWould you like to explore what that \u201cI need to fix this\u201d impulse feels like when it shows up? Catching it earlier could change everything.", time: "10:46 AM" },
    { from: "user", text: "Yeah, let\u2019s do that. I think it\u2019s connected to something deeper \u2014 like if I don\u2019t fix it, it reflects badly on me as the leader.", time: "10:48 AM" },
    { from: "sophia", text: "That\u2019s a really honest observation, and I think you\u2019re onto something important. There\u2019s a belief underneath: \u201cIf my team struggles, it means I\u2019m failing.\u201d\n\nBut what if the opposite is true? What if letting them struggle together \u2014 and find their own answers \u2014 is actually the highest form of leadership you can offer right now?", time: "10:48 AM" },
    { from: "user", text: "That\u2019s hard to hear but I know you\u2019re right. I think I need to sit with that one.", time: "10:50 AM" },
    { from: "sophia", text: "Take your time with it. Growth isn\u2019t about forcing change \u2014 it\u2019s about noticing what\u2019s already shifting.\n\nHere\u2019s what I\u2019d suggest: in your next meeting, pick one moment where you feel the urge to jump in, and instead just pause for five seconds. See what happens. You might be surprised by what your team does with that space.", time: "10:50 AM" },
  ]).current;

  // Fetch messages from API when session changes
  useEffect(() => {
    if (isNewConversation) {
      setStarted(false);
      setMsgs([]);
      return;
    }
    if (!activeSessionId) return;
    setStarted(true);
    let cancelled = false;
    setMsgsLoading(true);
    (async () => {
      try {
        const data = await getSessionMessages(activeSessionId);
        if (cancelled) return;
        const mapped = data.messages.map((m: CoachMessage) => ({
          from: m.role === 'assistant' ? 'sophia' : 'user',
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        }));
        setMsgs(mapped);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        setMsgs([]);
      } finally {
        if (!cancelled) setMsgsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isNewConversation, activeSessionId]);

  const [notification] = useState<NotifData>({
    title: "New coaching insights",
    subtitle: "I noticed some patterns in today's pipeline review I'd love to explore with you.",
    time: `${activeStudio.name} · Today, 10:30 AM`,
  });

  const [msgs, setMsgs] = useState<{ from: string; text: string; time: string }[]>([]);

  const [transcript, setTranscript] = useState<{ from: string; text: string }[]>([]);
  const [liveText, setLiveText] = useState("");

  const growthRings = [
    { label: "Letting Go", detail: "Trusting your team to solve problems", progress: 0.38, color: "#C0E689", bgColor: "rgba(192,230,137,0.08)" },
    { label: "Active Listening", detail: "Holding space before responding", progress: 0.52, color: "#D4A34A", bgColor: "rgba(212,163,74,0.08)" },
    { label: "Emotional Awareness", detail: "Noticing your patterns under pressure", progress: 0.61, color: "#A9A48E", bgColor: "rgba(169,164,142,0.08)" },
  ];

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    const t = setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
      } else {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [msgs, isTyping]);
  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); }, [transcript, liveText]);

  useEffect(() => {
    if (mode !== "voice") return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => { timeouts.push(setTimeout(fn, ms)); };
    setVoiceState("listening");
    t(() => setLiveText("I think the part that\u2019s hard is..."), 2000);
    t(() => {
      setLiveText("");
      setTranscript(prev => [...prev, { from: "user", text: "I think the part that\u2019s hard is knowing when to step in and when to let it go." }]);
      setVoiceState("speaking");
    }, 5000);
    t(() => {
      setTranscript(prev => [...prev, { from: "sophia", text: "That\u2019s the tension, isn\u2019t it? You care deeply about the outcome, and that care looks like control when the stakes feel high." }]);
      setVoiceState("listening");
    }, 9000);
    return () => timeouts.forEach(clearTimeout);
  }, [mode]);

  const startWithPrompt = async (prompt: string) => {
    setStarted(true);
    setMsgs([{ from: "user", text: prompt, time: "now" }]);
    setIsTyping(true);
    try {
      const sessionId = await onStartConversation(prompt.length > 40 ? prompt.substring(0, 37) + "..." : prompt);
      const response = await sendMessage(sessionId, prompt);
      setMsgs(m => [...m, { from: "sophia", text: response.response, time: "now" }]);
    } catch (err) {
      console.error('Failed to start with prompt:', err);
      setMsgs(m => [...m, { from: "sophia", text: "I'm having trouble connecting right now. Please try again.", time: "now" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const startFromInsight = async () => {
    setStarted(true);
    setShowNotif(false);
    const promptText = "I'd like to explore the patterns you noticed in today's pipeline review.";
    setMsgs([{ from: "user", text: promptText, time: "now" }]);
    setIsTyping(true);
    try {
      const sessionId = await onStartConversation("Pipeline review coaching");
      const response = await sendMessage(sessionId, promptText);
      setMsgs(m => [...m, { from: "sophia", text: response.response, time: "now" }]);
    } catch (err) {
      console.error('Failed to start from insight:', err);
      setMsgs(m => [...m, { from: "sophia", text: "I'm having trouble connecting right now. Please try again.", time: "now" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    if (!started) {
      await startWithPrompt(text);
      return;
    }
    if (!activeSessionId) return;
    setMsgs(m => [...m, { from: "user", text, time: "now" }]);
    setIsTyping(true);
    try {
      const response = await sendMessage(activeSessionId, text);
      setMsgs(m => [...m, { from: "sophia", text: response.response, time: "now" }]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setMsgs(m => [...m, { from: "sophia", text: "I'm having trouble connecting right now. Please try again.", time: "now" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const enterVoiceMode = () => {
    setTranscript([
      { from: "sophia", text: "I noticed you held back twice during the timeline discussion today. What was going on for you in those moments?" },
      { from: "user", text: "I think I was worried about taking over again. I know I tend to do that." },
      { from: "sophia", text: "That awareness is the breakthrough. You\u2019re noticing the impulse before it drives the behaviour \u2014 that\u2019s exactly where growth happens." },
    ]);
    setLiveText("");
    setStarted(true);
    setMode("voice");
    setShowNotif(false);
    if (!started) onStartConversation("Voice session");
  };

  const exitVoiceMode = () => { setVoiceState("idle"); setLiveText(""); setMode("text"); };

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", position: "relative", overflow: "hidden" }}>

      {/* Centre — Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", background: C.panelBg }}>
        {showNotif && mode === "text" && (
          <NotificationCard notification={notification} onTap={() => setShowNotif(false)} onDismiss={() => setShowNotif(false)} />
        )}

        {mode === "text" && !started && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
            <div style={{ textAlign: "center", maxWidth: 720, width: "100%" }}>
              {/* Logo + greeting inline */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 40 }}>
                <SophiaWhiteOrb size={44} animate={false} />
                <div style={{ fontSize: 28, fontWeight: 600, color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>
                  Hey {USER.name.split(" ")[0]}, how can I help?
                </div>
              </div>

              {/* Large input box — Claude-style container */}
              <div style={{
                border: `1px solid ${C.border}`, borderRadius: 20,
                background: C.inputBg, padding: 0, marginBottom: 20,
                display: "flex", flexDirection: "column",
                transition: "border-color 0.2s",
              }}
                onFocus={() => {}}
              >
                <textarea
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="How can I help you today?"
                  rows={3}
                  style={{
                    width: "100%", padding: "20px 24px 12px", borderRadius: "20px 20px 0 0",
                    border: "none", background: "transparent",
                    color: C.text, fontSize: 15, resize: "none", outline: "none",
                    lineHeight: 1.6, fontFamily: "'Tomorrow', sans-serif",
                    boxSizing: "border-box",
                  }}
                />
                {/* Bottom toolbar inside the box */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 14px" }}>
                  {/* Left: add files */}
                  <button style={{
                    width: 36, height: 36, borderRadius: 10, cursor: "pointer",
                    background: "transparent", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.hoverBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.8" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  {/* Right: voice + send */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={enterVoiceMode} style={{
                      width: 36, height: 36, borderRadius: 10, cursor: "pointer",
                      background: "transparent", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.hoverBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                        <path d="M19 10v2a7 7 0 01-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    {input.trim() && (
                      <button onClick={send} style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: C.teal, border: "none",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.25s",
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0C" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Prompt pills — single flat row below */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {PROMPT_SUGGESTIONS.map((p, i) => (
                  <button key={i} onClick={() => startWithPrompt(p.title)} style={{
                    padding: "10px 20px", borderRadius: 14, cursor: "pointer",
                    background: C.hoverBg, border: `1px solid ${C.border}`,
                    color: C.textDim, fontSize: 13, fontWeight: 500,
                    transition: "all 0.2s", whiteSpace: "nowrap",
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.activeBg; e.currentTarget.style.borderColor = C.tealBorder; e.currentTarget.style.color = C.text; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.hoverBg; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === "text" && started && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden",
          }}>
            <div ref={chatScrollRef} className="sophia-chat-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "24px 24px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
                {msgs.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start", animation: `fadeSlide 0.35s ease ${Math.min(i * 0.04, 0.3)}s both`, marginBottom: 6 }}>
                    {m.from === "sophia" && (
                      <div style={{ marginRight: 12, marginTop: 4, flexShrink: 0 }}>
                        <SophiaWhiteOrb size={28} animate={false} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: "82%",
                      padding: m.from === "user" ? "12px 18px" : "2px 0",
                      borderRadius: m.from === "user" ? "20px 4px 20px 20px" : 0,
                      background: m.from === "user" ? C.headerBg : "transparent",
                      border: m.from === "user" ? `1px solid ${C.border}` : "none",
                      color: C.text, fontSize: 14.5, lineHeight: 1.75, whiteSpace: "pre-wrap",
                    }}>
                      {m.text}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: m.from === "user" ? "flex-end" : "flex-start", gap: 4, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: C.textDim, opacity: 0.6 }}>{m.time}</span>
                        {m.from === "sophia" && (
                          <span style={{ display: "inline-flex", gap: 2, marginLeft: 8 }}>
                            {[
                              <svg key="up" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.76a2 2 0 001.79-1.11L12 2h0a3.13 3.13 0 013 3.88z" /></svg>,
                              <svg key="down" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H20a2 2 0 012 2v8a2 2 0 01-2 2h-2.76a2 2 0 00-1.79 1.11L12 22h0a3.13 3.13 0 01-3-3.88z" /></svg>,
                            ].map((icon, j) => (
                              <button key={j} style={{
                                width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                                opacity: 0.35, transition: "all 0.2s", padding: 0,
                              }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; e.currentTarget.style.background = C.hoverBg; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = "0.35"; e.currentTarget.style.background = "transparent"; }}
                              >{icon}</button>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 6 }}>
                    <div style={{ marginRight: 12, marginTop: 4, flexShrink: 0 }}>
                      <SophiaWhiteOrb size={28} animate={true} />
                    </div>
                    <div style={{ padding: "12px 18px", color: C.textDim, fontSize: 14.5 }}>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <span style={{ animation: "pulse 1.4s infinite", animationDelay: "0s" }}>.</span>
                        <span style={{ animation: "pulse 1.4s infinite", animationDelay: "0.2s" }}>.</span>
                        <span style={{ animation: "pulse 1.4s infinite", animationDelay: "0.4s" }}>.</span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>
            {/* Input area — Claude-style unified container */}
            <div style={{ padding: "12px 24px 20px" }}>
              <div style={{ maxWidth: 720, width: "100%", margin: "0 auto" }}>
                <div style={{
                  display: "flex", alignItems: "flex-end",
                  border: `1px solid ${C.border}`, borderRadius: 26,
                  background: C.inputBg, padding: "10px 8px 10px 16px",
                  transition: "border-color 0.2s",
                }}
                  onFocus={() => {}}
                >
                  {/* Attach file button — inside container */}
                  <button style={{
                    width: 36, height: 36, borderRadius: 10, cursor: "pointer",
                    background: "transparent", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "all 0.2s", opacity: 0.5,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.8" strokeLinecap="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <textarea
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Talk to SOPHIA..."
                    rows={2}
                    style={{
                      flex: 1, padding: "6px 10px", borderRadius: 0,
                      border: "none", background: "transparent",
                      color: C.text, fontSize: 14.5, resize: "none", outline: "none",
                      lineHeight: 1.5, fontFamily: "'Tomorrow', sans-serif",
                      minHeight: 44,
                    }}
                  />
                  <button onClick={enterVoiceMode} style={{
                    width: 36, height: 36, borderRadius: "50%", background: "transparent",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0,
                    opacity: 0.5,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; }}
                  >
                    <MicIcon size={18} color={C.teal} />
                  </button>
                  <button onClick={send} style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: input.trim() ? C.teal : "transparent",
                    border: "none", cursor: input.trim() ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.25s", flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#0A0A0C" : C.textDim} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "voice" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", animation: "voiceEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            background: isDark
              ? "linear-gradient(170deg, #231f20 0%, hsl(215,20%,14%) 25%, #231f20 45%, hsl(210,18%,16%) 65%, #231f20 85%, hsl(215,15%,13%) 100%)"
              : "linear-gradient(170deg, #ffffff 0%, hsl(200,60%,93%) 25%, #ffffff 45%, hsl(205,55%,91%) 65%, #ffffff 85%, hsl(200,50%,94%) 100%)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Soft blue ambient glow */}
            <div style={{
              position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)",
              width: 600, height: 600, borderRadius: "50%",
              background: isDark
                ? "radial-gradient(circle, hsla(215,40%,30%,0.35) 0%, hsla(210,30%,20%,0.15) 50%, transparent 70%)"
                : "radial-gradient(circle, hsla(215,50%,85%,0.5) 0%, hsla(210,40%,90%,0.2) 50%, transparent 70%)",
              filter: "blur(80px)", pointerEvents: "none",
            }} />
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", position: "relative", zIndex: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: voiceState === "listening" ? C.teal : voiceState === "speaking" ? C.amber : C.textDim,
                  boxShadow: voiceState !== "idle" ? `0 0 10px ${voiceState === "listening" ? C.teal : C.amber}` : "none",
                  animation: voiceState !== "idle" ? "pulse 1.5s ease infinite" : "none",
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 500, letterSpacing: 0.5,
                  color: voiceState === "listening" ? C.teal : voiceState === "speaking" ? C.amber : C.textDim,
                }}>
                  {voiceState === "listening" ? "Listening..." : voiceState === "speaking" ? "SOPHIA is speaking" : "Voice mode"}
                </span>
              </div>
              <button onClick={exitVoiceMode} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10,
                background: "rgba(212,90,90,0.06)", border: "1px solid rgba(212,90,90,0.2)",
                color: C.red, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif", cursor: "pointer",
              }}>End Voice</button>
            </div>
            {/* Centered orb */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
              <VoiceOrb listening={voiceState === "listening"} speaking={voiceState === "speaking"} />
            </div>
            {/* Transcript at bottom */}
            <div ref={transcriptRef} style={{
              maxHeight: 180, overflowY: "auto", padding: "0 24px 24px", position: "relative", zIndex: 2,
            }}>
              {transcript.map((t, i) => (
                <TranscriptLine key={i} from={t.from} text={t.text} />
              ))}
              {liveText && <TranscriptLine from="user" text={liveText} isLive />}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel Toggle */}
      <button onClick={() => setShowPanel(!showPanel)} style={{
        position: "absolute", right: showPanel ? 308 : 8, top: 12, zIndex: 10,
        width: 36, height: 36, borderRadius: 10, cursor: "pointer",
        background: showPanel ? C.tealGlow : C.card, border: `1px solid ${showPanel ? C.tealBorder : C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showPanel ? C.teal : C.textDim} strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>

      {/* Right Panel — Goal + Rings + Latest Insight */}
      <div style={{
        width: showPanel ? 300 : 0, flexShrink: 0,
        borderLeft: showPanel ? `1px solid ${C.border}` : "none",
        overflowY: showPanel ? "auto" : "hidden",
        background: C.panelBg, transition: "all 0.35s ease",
        padding: showPanel ? "24px 20px" : "24px 0",
        opacity: showPanel ? 1 : 0,
      }}>
        {/* Key Goal */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
            <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Key Goal</div>
          </div>
          {!goalSet ? (
            <button
              onClick={() => setGoalSet(true)}
              style={{
                width: "100%", padding: "18px 16px", borderRadius: 14,
                background: "transparent", border: `1.5px dashed ${C.tealBorder}`,
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.tealGlow; e.currentTarget.style.borderColor = C.teal; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.tealBorder; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.teal, fontFamily: "'Tomorrow', sans-serif" }}>Set a goal</div>
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4, textAlign: "center" }}>
                Define one clear goal and the steps to get there
              </div>
            </button>
          ) : (
            <div style={{
              padding: "14px 16px", borderRadius: 14,
              background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
              animation: "fadeIn 0.4s ease",
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4, lineHeight: 1.4 }}>
                {(coachProfile?.motivation as Record<string, string>)?.goal || "More time at home with family"}
              </div>
              <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
                {(coachProfile?.motivation as Record<string, string>)?.description || "Build a team that runs without you."}
              </div>
            </div>
          )}
        </div>

        {/* Working On — 3 actions when goal set, or Growth Rings */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 14 }}>Working On</div>
          {goalSet ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, animation: "fadeIn 0.4s ease" }}>
              {(
                (coachProfile?.preferences?.custom_preferences?.working_on as { label: string; desc: string }[]) || [
                  { label: "Set clear boundaries", desc: "Define work hours and protect personal time" },
                  { label: "Delegate more effectively", desc: "Empower your team to own decisions" },
                  { label: "Block focus time for family", desc: "Schedule non-negotiable family time weekly" },
                ]
              ).map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 12px", borderRadius: 10,
                  background: C.hoverBg, border: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    border: `1.5px solid ${C.tealBorder}`, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: C.teal,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <GrowthRings rings={growthRings} />
          )}
        </div>

        <div style={{ height: 1, background: C.border, margin: "0 0 20px" }} />

        {/* Latest Insight — clickable to start coaching chat */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, boxShadow: `0 0 8px ${C.teal}60` }} />
            <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Latest Insight</div>
          </div>
          <div
            onClick={startFromInsight}
            style={{
              padding: "14px 16px", borderRadius: 14,
              background: C.hoverBg, border: `1px solid ${C.border}`,
              cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.tealBorder; e.currentTarget.style.background = C.activeBg; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.hoverBg; }}
          >
            <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.6, marginBottom: 8 }}>
              {notification.subtitle}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, color: C.textDim }}>{notification.time}</div>
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 600, letterSpacing: 0.3 }}>Explore</div>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: C.border, margin: "0 0 20px" }} />

        {/* Insights Timeline */}
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 14 }}>Recent Insights</div>
        <InsightsTimeline studioId={activeStudio.id} />
      </div>
    </div>
  );
};

// ─── Profile Page ───
const AVATAR_COLORS = [
  { color: "#4A90D9", label: "Blue" },
  { color: "#5B7FFF", label: "Indigo" },
  { color: "#7C5CFC", label: "Violet" },
  { color: "#A855F7", label: "Purple" },
  { color: "#EC4899", label: "Pink" },
  { color: "#F43F5E", label: "Rose" },
  { color: "#F97316", label: "Orange" },
  { color: "#EAB308", label: "Gold" },
  { color: "#22C55E", label: "Green" },
  { color: "#14B8A6", label: "Teal" },
  { color: "#64748B", label: "Slate" },
  { color: "#78716C", label: "Stone" },
];

const ProfilePage = ({ onNavigateStudio, consent, onToggleConsent, onSignOut, avatarImage, avatarColor, onAvatarImageChange, onAvatarColorChange }: { onNavigateStudio: (id: string) => void; consent: ConsentState; onToggleConsent: (key: keyof ConsentState) => void; onSignOut: () => void; avatarImage: string | null; avatarColor: string | null; onAvatarImageChange: (img: string | null) => void; onAvatarColorChange: (color: string | null) => void }) => {
  const { userProfile, isLoading: profileLoading } = useCurrentUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);

  // Sync local state when profile data arrives
  useEffect(() => {
    if (userProfile) {
      setName(`${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'User');
      setEmail(userProfile.email || '');
    }
  }, [userProfile]);
  const [vpStep, setVpStep] = useState<"done" | "none" | "recording" | "processing">("done");
  const [timer, setTimer] = useState(30);
  const [bars, setBars] = useState(Array(50).fill(0.1));
  const [coachingOn, setCoachingOn] = useState(true);
  const [notifOn, setNotifOn] = useState(true);

  // Load preferences from coach profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile();
        if (cancelled) return;
        const prefs = profile.preferences?.custom_preferences as Record<string, boolean> | undefined;
        if (prefs) {
          if (typeof prefs.insights_after_meetings === 'boolean') setCoachingOn(prefs.insights_after_meetings);
          if (typeof prefs.notifications === 'boolean') setNotifOn(prefs.notifications);
        }
      } catch {
        // Profile may not exist yet
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToggleCoaching = async () => {
    const newVal = !coachingOn;
    setCoachingOn(newVal);
    try { await updatePreference('insights_after_meetings', newVal, 'global'); }
    catch (err) { console.error('Failed to save preference:', err); setCoachingOn(!newVal); }
  };

  const handleToggleNotif = async () => {
    const newVal = !notifOn;
    setNotifOn(newVal);
    try { await updatePreference('notifications', newVal, 'global'); }
    catch (err) { console.error('Failed to save preference:', err); setNotifOn(!newVal); }
  };

  useEffect(() => {
    if (vpStep === "recording") {
      const iv = setInterval(() => {
        setTimer(t => {
          if (t <= 1) { clearInterval(iv); setVpStep("processing"); setTimeout(() => setVpStep("done"), 2200); return 0; }
          return t - 1;
        });
        setBars(Array(50).fill(0).map(() => 0.12 + Math.random() * 0.75));
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [vpStep]);

  const passage = "The team gathered early that morning, each person bringing their own perspective to the table. Some spoke with quiet confidence, others with visible enthusiasm. What mattered most wasn\u2019t who spoke loudest, but that every voice found its place in the conversation.";

  const Field = ({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} disabled={!editing || disabled}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 10,
          border: `1px solid ${editing && !disabled ? C.tealBorder : C.border}`,
          background: editing && !disabled ? "rgba(24,28,20,0.7)" : C.card,
          color: C.text, fontSize: 15, fontFamily: "'Tomorrow', sans-serif", outline: "none", transition: "all 0.2s",
          opacity: disabled ? 0.5 : 1,
        }} />
    </div>
  );

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <div onClick={onToggle} style={{
      width: 48, height: 26, borderRadius: 13, cursor: "pointer",
      background: on ? C.teal : "rgba(24,28,20,0.7)", position: "relative",
      transition: "background 0.25s", border: `1px solid ${on ? C.teal : C.border}`,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "#E3DED8",
        position: "absolute", top: 2, left: on ? 25 : 3, transition: "left 0.25s",
      }} />
    </div>
  );

  if (profileLoading && !name) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "28px 24px", width: "100%", overflowY: "auto", flex: 1 }}>
        <div style={{ background: C.card, borderRadius: 18, padding: 28, border: `1px solid ${C.border}` }}>
          {[200, 160, 120].map((w, i) => (
            <div key={i} style={{ height: 16, width: w, background: C.hoverBg, borderRadius: 8, marginBottom: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "28px 24px", width: "100%", overflowY: "auto", flex: 1 }}>
      {/* Profile Card */}
      <div style={{
        background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 18, padding: 28,
        border: `1px solid ${C.tealBorder}`, marginBottom: 24, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.teal}, transparent)` }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name={name || "User"} size={52} image={avatarImage} bgColor={avatarColor} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{name}</div>
              <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>{email}</div>
            </div>
          </div>
          <button onClick={() => setEditing(!editing)} style={{
            padding: "8px 20px", borderRadius: 8, cursor: "pointer",
            background: editing ? C.teal : "transparent", border: `1px solid ${editing ? C.teal : C.tealBorder}`,
            color: editing ? "#0A0A0C" : C.teal, fontSize: 13, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
          }}>
            {editing ? "Save" : "Edit"}
          </button>
        </div>
        <Field label="Full Name" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={() => {}} disabled />
      </div>

      {/* Profile Picture */}
      <div style={{
        background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 18, padding: 28,
        border: `1px solid ${C.tealBorder}`, marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 20 }}>Profile Picture</div>

        {/* Preview */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <Avatar name={name} size={80} image={avatarImage} bgColor={avatarColor} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              {avatarImage ? "Custom Photo" : avatarColor ? "Custom Colour" : "Default"}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
              Choose a colour or upload a photo to personalise your avatar
            </div>
            {(avatarImage || avatarColor) && (
              <button onClick={() => { onAvatarImageChange(null); onAvatarColorChange(null); }} style={{
                marginTop: 8, padding: "5px 14px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: `1px solid rgba(212,90,90,0.25)`,
                color: "#D45A5A", fontSize: 11, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
              }}>Reset to Default</button>
            )}
          </div>
        </div>

        {/* Colour Swatches */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Choose a Colour</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {AVATAR_COLORS.map(({ color, label }) => (
              <button key={color} onClick={() => { onAvatarColorChange(color); onAvatarImageChange(null); }}
                title={label}
                style={{
                  width: 36, height: 36, borderRadius: "50%", cursor: "pointer",
                  background: color, border: avatarColor === color ? "3px solid #fff" : "2px solid transparent",
                  boxShadow: avatarColor === color ? `0 0 0 2px ${C.teal}, 0 2px 8px rgba(0,0,0,0.2)` : "0 1px 4px rgba(0,0,0,0.15)",
                  transition: "all 0.2s", transform: avatarColor === color ? "scale(1.1)" : "scale(1)",
                }}
                onMouseEnter={e => { if (avatarColor !== color) e.currentTarget.style.transform = "scale(1.08)"; }}
                onMouseLeave={e => { if (avatarColor !== color) e.currentTarget.style.transform = "scale(1)"; }}
              />
            ))}
          </div>
        </div>

        {/* Upload Image */}
        <div>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Or Upload a Photo</div>
          <input
            type="file"
            accept="image/*"
            id="avatar-upload"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  onAvatarImageChange(ev.target?.result as string);
                  onAvatarColorChange(null);
                };
                reader.readAsDataURL(file);
              }
              e.target.value = "";
            }}
          />
          <button
            onClick={() => document.getElementById("avatar-upload")?.click()}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
              borderRadius: 10, cursor: "pointer", width: "100%",
              background: C.hoverBg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 13, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.teal; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {avatarImage ? "Change Photo" : "Upload Photo"}
          </button>
        </div>
      </div>

      {/* Voice Print */}
      <div style={{
        background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 18, padding: 28,
        border: `1px solid ${C.tealBorder}`, marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 20 }}>Voice Print</div>

        {vpStep === "done" && (
          <div style={{ animation: "fadeSlide 0.4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", background: C.tealGlow,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>Voice Print Active</div>
                <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2 }}>Created Feb 15, 2026 · SOPHIA recognises your voice</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setVpStep("none"); setTimer(30); }} style={{
                padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                background: "transparent", border: `1px solid ${C.tealBorder}`,
                color: C.teal, fontSize: 13, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
              }}>Re-record</button>
              <button style={{
                padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                background: `rgba(212,90,90,0.08)`, border: `1px solid rgba(212,90,90,0.25)`,
                color: C.red, fontSize: 13, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
              }}>Delete Voice Print</button>
            </div>
          </div>
        )}

        {vpStep === "none" && (
          <div style={{ animation: "fadeSlide 0.4s ease", textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
              background: "linear-gradient(145deg, rgba(192,230,137,0.12), rgba(192,230,137,0.04))",
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px rgba(192,230,137,0.25)",
            }}>
              <MicIcon size={32} color="#E3DED8" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 400, fontFamily: "'Josefin Sans', sans-serif", letterSpacing: 0.3, color: C.text, marginBottom: 8 }}>Create Your Voice Print</div>
            <div style={{ fontSize: 14, color: C.textSec, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 24px" }}>
              Read a short passage aloud for 30 seconds. SOPHIA will use your unique voice signature to recognise you in meetings.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", marginBottom: 24 }}>
              {["Your voice creates a unique mathematical signature", "Raw audio is deleted after processing", "The signature cannot recreate your voice", "You can delete it permanently at any time"].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span style={{ fontSize: 13.5, color: C.text }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setVpStep("recording")} style={{
              width: "100%", padding: 15, borderRadius: 10, cursor: "pointer",
              background: `linear-gradient(135deg, rgba(192,230,137,0.15), ${C.teal})`,
              border: "none", color: "#0A0A0C", fontSize: 15, fontWeight: 600,
              fontFamily: "'Tomorrow', sans-serif", boxShadow: "0 4px 20px rgba(192,230,137,0.3)",
            }}>Begin Recording</button>
          </div>
        )}

        {vpStep === "recording" && (
          <div style={{ animation: "fadeSlide 0.4s ease", textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: C.teal, fontFamily: "'Josefin Sans', sans-serif", marginBottom: 4 }}>{timer}s</div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>Keep reading aloud...</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2.5, height: 60, marginBottom: 20 }}>
              {bars.map((a, i) => (
                <div key={i} style={{
                  width: 3.5, height: `${a * 55}px`, borderRadius: 2,
                  background: C.teal, transition: "height 0.12s ease", opacity: 0.45 + a * 0.55,
                }} />
              ))}
            </div>
            <div style={{
              background: C.elevated, borderRadius: 12, padding: 20,
              border: `1px solid ${C.tealBorder}`, textAlign: "left", marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, color: C.teal, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 10 }}>Read this passage</div>
              <p style={{ fontSize: 14.5, color: C.text, lineHeight: 1.8, margin: 0, fontStyle: "italic" }}>&ldquo;{passage}&rdquo;</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#D45A5A", animation: "pulse 1.4s ease infinite", boxShadow: "0 0 10px #D45A5A" }} />
              <span style={{ fontSize: 12, color: "#D45A5A" }}>Recording</span>
            </div>
          </div>
        )}

        {vpStep === "processing" && (
          <div style={{ animation: "fadeSlide 0.3s ease", textAlign: "center", padding: "30px 0" }}>
            <div style={{
              width: 50, height: 50, borderRadius: "50%", margin: "0 auto 20px",
              border: `3px solid ${C.tealBorder}`, borderTopColor: C.teal, animation: "spin 0.9s linear infinite",
            }} />
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: 0.3, color: C.text, marginBottom: 6 }}>Creating your Voice Print</div>
            <div style={{ fontSize: 13, color: C.textDim }}>Extracting your unique voice signature...</div>
          </div>
        )}
      </div>

      {/* Your Studios */}
      <div style={{
        background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 18, padding: 28,
        border: "1px solid rgba(255,255,255,0.04)", marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>Your Spaces</div>
        {Object.values(STUDIOS).map(s => (
          <button key={s.id} onClick={() => onNavigateStudio(s.id)} style={{
            display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 0",
            background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
            cursor: "pointer", fontFamily: "'Tomorrow', sans-serif", textAlign: "left",
          }}>
            <RainbowOrb studioId={s.id} warmth={s.warmth} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{s.members.length} members</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        ))}
      </div>

      {/* Preferences */}
      <div style={{
        background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 18, padding: 28,
        border: "1px solid rgba(255,255,255,0.04)", marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>Preferences</div>
        {[
          { label: "Insights after meetings", desc: "SOPHIA will offer reflections after each meeting", on: coachingOn, toggle: handleToggleCoaching },
          { label: "Notifications", desc: "Get notified about new coaching insights", on: notifOn, toggle: handleToggleNotif },
        ].map((pref, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{pref.label}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{pref.desc}</div>
            </div>
            <Toggle on={pref.on} onToggle={pref.toggle} />
          </div>
        ))}
      </div>

      {/* Consent */}
      <div style={{
        background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 18, padding: 28,
        border: `1px solid ${C.tealBorder}`, marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 6 }}>Your Consent</div>
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 18 }}>All consent is required to use SOPHIA. You can revoke access at any time by contacting support.</div>
        {[
          { label: "Meeting recording", desc: "Allow SOPHIA to listen to meetings you invite her to" },
          { label: "Pattern analysis", desc: "Identify communication patterns across your meetings" },
          { label: "Coaching insights", desc: "Receive personalised coaching based on meeting analysis" },
          { label: "Team aggregation", desc: "Contribute anonymised data to team-level dynamics scores" },
        ].map((c, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0",
            borderBottom: i < 3 ? `1px solid rgba(227,222,216,0.05)` : "none",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{c.label}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{c.desc}</div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.teal,
              padding: "4px 12px", borderRadius: 8,
              background: `${C.teal}15`, flexShrink: 0,
            }}>Active</div>
          </div>
        ))}
      </div>

      {/* Info Transparency */}
      <div style={{
        background: C.card, backdropFilter: "blur(20px) saturate(1.2)", borderRadius: 18, padding: 28,
        border: "1px solid rgba(255,255,255,0.04)", marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>Data Transparency</div>
        <InfoTransparency />
      </div>

      {/* Sign Out */}
      <div style={{ padding: "24px 28px 32px" }}>
        <button
          onClick={onSignOut}
          style={{
            width: "100%", padding: "12px 20px",
            background: "rgba(212,90,90,0.08)",
            border: `1px solid rgba(212,90,90,0.2)`,
            borderRadius: 12, cursor: "pointer",
            fontSize: 13, fontWeight: 500, color: "#D45A5A",
            fontFamily: "'Tomorrow', sans-serif",
            transition: "all 0.2s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,90,90,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(212,90,90,0.08)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
};

// ─── Calendar View ───
const MOCK_MEETINGS = [
  { id: "m1", name: "Sales Pipeline Review", date: "Today", time: "2:00 PM – 3:00 PM", timeShort: "2:00 PM", day: "Mon", hour: 14, duration: 1, space: "Sales Team", spaceKey: "sales", participants: ["Mike Torres", "Rachel Kim", "David Chen", "Lisa Okonkwo", "Sam Rivera"], sophiaEnabled: true, hasTranscript: true },
  { id: "m2", name: "Product Standup", date: "Tomorrow", time: "9:00 AM – 9:30 AM", timeShort: "9:00 AM", day: "Tue", hour: 9, duration: 0.5, space: "Product Buildout", spaceKey: "product", participants: ["Jordan Reeves", "Priya Sharma", "Alex Tran", "Nina Kovalenko"], sophiaEnabled: false, hasTranscript: false },
  { id: "m3", name: "Campaign Brainstorm", date: "Tomorrow", time: "2:00 PM – 3:30 PM", timeShort: "2:00 PM", day: "Tue", hour: 14, duration: 1.5, space: "Creative", spaceKey: "creative", participants: ["Zoe Nakamura", "Liam Okafor", "Emma Costa", "Ben Harper"], sophiaEnabled: true, hasTranscript: false },
  { id: "m4", name: "All-Hands", date: "Wed, Mar 4", time: "10:00 AM – 11:00 AM", timeShort: "10:00 AM", day: "Wed", hour: 10, duration: 1, space: "Company", spaceKey: "company", participants: ["All members"], sophiaEnabled: false, hasTranscript: false },
  { id: "m5", name: "1:1 with Product Lead", date: "Wed, Mar 4", time: "3:00 PM – 3:30 PM", timeShort: "3:00 PM", day: "Wed", hour: 15, duration: 0.5, space: "Product Buildout", spaceKey: "product", participants: ["Jordan Reeves"], sophiaEnabled: true, hasTranscript: false },
  { id: "m6", name: "Creative Review", date: "Thu, Mar 5", time: "11:00 AM – 12:00 PM", timeShort: "11:00 AM", day: "Thu", hour: 11, duration: 1, space: "Creative", spaceKey: "creative", participants: ["Zoe Nakamura", "Liam Okafor", "Emma Costa"], sophiaEnabled: false, hasTranscript: false },
];

const WEEK_DAYS = [
  { key: "Mon", label: "Mon", date: 2, isToday: true },
  { key: "Tue", label: "Tue", date: 3, isToday: false },
  { key: "Wed", label: "Wed", date: 4, isToday: false },
  { key: "Thu", label: "Thu", date: 5, isToday: false },
  { key: "Fri", label: "Fri", date: 6, isToday: false },
];

const SPACE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  sales: { bg: "rgba(20, 180, 120, 0.08)", border: "rgba(20, 180, 120, 0.2)", text: "hsl(20, 75%, 68%)" },
  product: { bg: "rgba(80, 160, 220, 0.08)", border: "rgba(80, 160, 220, 0.2)", text: "hsl(210, 65%, 68%)" },
  creative: { bg: "rgba(180, 100, 220, 0.08)", border: "rgba(180, 100, 220, 0.2)", text: "hsl(270, 55%, 70%)" },
  company: { bg: "rgba(192, 230, 137, 0.06)", border: "rgba(192, 230, 137, 0.15)", text: C.teal },
};

interface CalendarMeeting {
  id: string; name: string; date: string; time: string; timeShort: string;
  day: string; hour: number; duration: number; space: string; spaceKey: string;
  participants: string[]; sophiaEnabled: boolean; hasTranscript: boolean;
}

// Generate week days from a given Monday
const generateWeekDays = (monday: Date) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const today = new Date(); today.setHours(0,0,0,0);
  return days.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { key: label, label, date: d.getDate(), isToday: d.toDateString() === today.toDateString(), fullDate: d };
  });
};

// Get the Monday of the current week
const getMonday = (d: Date) => {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff); return dt;
};

// Map CalendarEventDTO → CalendarMeeting
const mapCalendarEvent = (ev: CalendarEventDTO): CalendarMeeting => {
  const start = new Date(ev.start_time);
  const end = new Date(ev.end_time);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeStr = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return {
    id: ev.id,
    name: ev.title || 'Untitled',
    date: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: `${timeStr(start)} – ${timeStr(end)}`,
    timeShort: timeStr(start),
    day: days[start.getDay()],
    hour: start.getHours(),
    duration: Math.max(0.5, (end.getTime() - start.getTime()) / 3600000),
    space: ev.platform || 'Meeting',
    spaceKey: (ev.platform || 'company').toLowerCase(),
    participants: [],
    sophiaEnabled: ev.is_promoted,
    hasTranscript: ev.meeting_id !== null,
  };
};

const CalendarView = () => {
  const { getApiToken } = useSophiaAuth();
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<CalendarMeeting | null>(null);
  const [recState, setRecState] = useState<"idle" | "recording" | "processing" | "done">("idle");
  const [recTimer, setRecTimer] = useState(0);
  const [recBars, setRecBars] = useState(Array(40).fill(0.1));
  const [uploadState, setUploadState] = useState<"none" | "uploading" | "done">("none");
  const [weekOffset, setWeekOffset] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const weekDays = generateWeekDays(monday);
  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${friday.toLocaleDateString('en-US', { day: 'numeric' })}, ${friday.getFullYear()}`;

  // Check calendar status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const status = await getCalendarStatus(token);
        const connected = Object.entries(status.providers).find(([, v]) => v.connected);
        if (connected && !cancelled) {
          setCalendarConnected(true);
          setConnectedProvider(connected[0]);
        }
      } catch { /* no calendar connected */ }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // Fetch events when connected or week changes
  useEffect(() => {
    if (!calendarConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const startDate = monday.toISOString().split('T')[0];
        const endDate = new Date(friday.getTime() + 86400000).toISOString().split('T')[0];
        const events = await getCalendarEvents(token, startDate, endDate);
        if (!cancelled) setMeetings(events.map(mapCalendarEvent));
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [calendarConnected, weekOffset, getApiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recState === "recording") {
      const iv = setInterval(() => {
        setRecTimer(t => t + 1);
        setRecBars(Array(40).fill(0).map(() => 0.12 + Math.random() * 0.78));
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [recState]);

  const handleConnect = async (provider: string) => {
    try {
      const token = await getApiToken();
      if (!token) return;
      const result = await connectCalendar(provider, token);
      if (result.auth_url) window.location.href = result.auth_url;
    } catch (err) {
      console.error('Calendar connect failed:', err);
      // Fallback: just show connected state for demo
      setCalendarConnected(true);
      setConnectedProvider(provider);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedProvider) { setCalendarConnected(false); return; }
    try {
      const token = await getApiToken();
      if (token) await disconnectCalendar(connectedProvider, token);
    } catch (err) { console.error('Disconnect failed:', err); }
    setCalendarConnected(false);
    setConnectedProvider(null);
    setMeetings([]);
  };

  const startRecording = () => { setRecState("recording"); setRecTimer(0); };
  const stopRecording = () => {
    setRecState("processing");
    setTimeout(() => { setRecState("done"); setTimeout(() => setRecState("idle"), 3000); }, 2000);
  };
  const handleUpload = async (file?: File) => {
    const f = file || fileInputRef.current?.files?.[0];
    if (!f) { fileInputRef.current?.click(); return; }
    setUploadState("uploading");
    try {
      const token = await getApiToken();
      if (token) await uploadMeeting(f, f.name.replace(/\.[^.]+$/, ''), token);
      setUploadState("done");
      setTimeout(() => setUploadState("none"), 3000);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadState("none");
    }
  };
  const formatRecTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleSophia = (id: string) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, sophiaEnabled: !m.sophiaEnabled } : m));
  };

  const deleteMeeting = (id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };

  // Group meetings by day
  const dayMeetings = (dayKey: string) => meetings.filter(m => m.day === dayKey).sort((a, b) => a.hour - b.hour);

  const getSpaceColor = (key: string) => SPACE_COLORS[key] || SPACE_COLORS.company;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", width: "100%", overflowY: "auto", flex: 1 }}>
      {/* Connect / Sync Section */}
      {!calendarConnected ? (
        <div style={{
          background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
          border: "1px solid rgba(192,230,137,0.1)", borderRadius: 18, padding: "32px",
          textAlign: "center", marginBottom: 24,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 16 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            <line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Josefin Sans', sans-serif", color: C.text, marginBottom: 8 }}>Connect Your Calendar</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, maxWidth: 400, margin: "0 auto 24px" }}>
            Sync your calendar so SOPHIA can join your meetings and provide real-time coaching insights.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => handleConnect('google_calendar')} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 10, cursor: "pointer",
              background: C.hoverBg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 14, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google Calendar
            </button>
            <button onClick={() => handleConnect('outlook_calendar')} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 10, cursor: "pointer",
              background: C.hoverBg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 14, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#0078D4"/><text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">O</text></svg>
              Outlook
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header Bar: Status + Actions */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, boxShadow: `0 0 6px ${C.teal}` }} />
              <span style={{ fontSize: 13, color: C.teal, fontWeight: 500 }}>{connectedProvider === 'outlook_calendar' ? 'Outlook' : 'Google'} Calendar synced</span>
              <button onClick={handleDisconnect} style={{
                background: "none", border: "none", color: C.textDim, fontSize: 11, cursor: "pointer",
                fontFamily: "'Tomorrow', sans-serif", textDecoration: "underline", marginLeft: 6,
              }}>Disconnect</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Record Now Button */}
              <button onClick={startRecording} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                background: recState === "recording" ? "rgba(212,90,90,0.12)" : C.tealGlow,
                border: `1px solid ${recState === "recording" ? "rgba(212,90,90,0.25)" : C.tealBorder}`,
                color: recState === "recording" ? "#d45a5a" : C.teal, fontSize: 12, fontWeight: 600,
                fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
              }}>
                {recState === "recording" ? (
                  <>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#d45a5a", animation: "pulse 1.2s ease-in-out infinite" }} />
                    Recording {formatRecTimer(recTimer)}
                  </>
                ) : recState === "processing" ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 11-6.22-8.56" />
                    </svg>
                    Processing...
                  </>
                ) : recState === "done" ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Saved
                  </>
                ) : (
                  <>
                    <MicIcon size={14} color={C.teal} />
                    Record Now
                  </>
                )}
              </button>
              {/* Upload Transcript Button */}
              <input ref={fileInputRef} type="file" accept=".mp3,.mp4,.wav,.txt,.vtt,.webm" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
              <button onClick={() => handleUpload()} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                background: uploadState === "done" ? C.tealGlow : C.hoverBg,
                border: `1px solid ${uploadState === "done" ? C.tealBorder : C.border}`,
                color: uploadState === "done" ? C.teal : C.textSec, fontSize: 12, fontWeight: 500,
                fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
              }}
                onMouseEnter={e => { if (uploadState === "none") { e.currentTarget.style.borderColor = C.tealBorder; e.currentTarget.style.color = C.teal; }}}
                onMouseLeave={e => { if (uploadState === "none") { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSec; }}}
              >
                {uploadState === "uploading" ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 11-6.22-8.56" />
                    </svg>
                    Uploading...
                  </>
                ) : uploadState === "done" ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Uploaded
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Week Navigation */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16,
          }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, padding: "4px 8px", fontFamily: "'Tomorrow', sans-serif" }}>&lsaquo;</button>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.text, letterSpacing: 0.5 }}>{weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : ''}: {weekLabel}</span>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, padding: "4px 8px", fontFamily: "'Tomorrow', sans-serif" }}>&rsaquo;</button>
          </div>

          {/* Calendar Grid + Detail Panel */}
          <div style={{ display: "flex", gap: 16 }}>
            {/* 5-Day Grid */}
            <div style={{
              flex: 1, display: "flex",
              background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
              borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              {weekDays.map((wd, di) => {
                const mts = dayMeetings(wd.key);
                return (
                  <div key={wd.key} style={{
                    flex: 1, minWidth: 0,
                    borderRight: di < 4 ? `1px solid ${C.border}` : "none",
                    background: wd.isToday ? C.tealGlow : "transparent",
                  }}>
                    {/* Day Header */}
                    <div style={{
                      padding: "14px 10px 10px", textAlign: "center",
                      borderBottom: `1px solid ${C.border}`,
                    }}>
                      <div style={{ fontSize: 11, color: wd.isToday ? C.teal : C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                        {wd.label}
                      </div>
                      <div style={{
                        fontSize: 20, fontWeight: 600, fontFamily: "'Josefin Sans', sans-serif",
                        color: wd.isToday ? C.teal : C.textSec,
                        ...(wd.isToday ? { width: 34, height: 34, lineHeight: "34px", borderRadius: "50%", background: C.tealGlow, margin: "0 auto" } : {}),
                      }}>
                        {wd.date}
                      </div>
                    </div>
                    {/* Meeting Blocks */}
                    <div style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 8, minHeight: 320 }}>
                      {mts.map(m => {
                        const sc = getSpaceColor(m.spaceKey);
                        const isSelected = selectedMeeting?.id === m.id;
                        return (
                          <div key={m.id} onClick={() => setSelectedMeeting(isSelected ? null : m)}
                            style={{
                              padding: "10px 10px", borderRadius: 10, cursor: "pointer",
                              background: isSelected ? sc.bg : C.hoverBg,
                              border: `1px solid ${isSelected ? sc.border : C.border}`,
                              borderLeft: `3px solid ${m.sophiaEnabled ? C.teal : sc.border}`,
                              transition: "all 0.2s",
                              minHeight: Math.max(m.duration * 56, 56),
                            }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>{m.timeShort}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {m.sophiaEnabled && (
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, boxShadow: `0 0 4px ${C.teal}`, flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: 9, color: C.textDim }}>{m.participants.length === 1 ? "1:1" : `${m.participants.length}`}</span>
                              {m.hasTranscript && (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 2 }}>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {mts.length === 0 && (
                        <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginTop: 40, fontStyle: "italic" }}>No meetings</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail Panel */}
            {selectedMeeting && (
              <div style={{
                width: 280, flexShrink: 0,
                background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
                borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
                padding: "24px 20px", animation: "fadeSlide 0.3s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.text, lineHeight: 1.3, flex: 1 }}>{selectedMeeting.name}</div>
                  <button onClick={() => setSelectedMeeting(null)} style={{
                    background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, padding: "0 0 0 8px", lineHeight: 1, fontFamily: "'Tomorrow', sans-serif",
                  }}>&times;</button>
                </div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>{selectedMeeting.date} · {selectedMeeting.time}</div>
                <div style={{
                  display: "inline-block", fontSize: 10, color: getSpaceColor(selectedMeeting.spaceKey).text,
                  padding: "3px 10px", borderRadius: 6,
                  background: getSpaceColor(selectedMeeting.spaceKey).bg,
                  border: `1px solid ${getSpaceColor(selectedMeeting.spaceKey).border}`,
                  marginBottom: 18,
                }}>{selectedMeeting.space}</div>

                {/* Participants */}
                <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>Participants</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {selectedMeeting.participants.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={p} size={22} />
                      <span style={{ fontSize: 12, color: C.text }}>{p}</span>
                    </div>
                  ))}
                </div>

                {/* SOPHIA Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                  <div onClick={() => toggleSophia(selectedMeeting.id)} style={{
                    width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                    background: selectedMeeting.sophiaEnabled ? C.teal : C.card, position: "relative",
                    transition: "background 0.25s", border: `1px solid ${selectedMeeting.sophiaEnabled ? C.teal : C.border}`,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#E3DED8",
                      position: "absolute", top: 2, left: selectedMeeting.sophiaEnabled ? 23 : 3, transition: "left 0.25s",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: selectedMeeting.sophiaEnabled ? C.teal : C.textDim, fontWeight: 500 }}>
                    {selectedMeeting.sophiaEnabled ? "SOPHIA will join" : "Bring SOPHIA"}
                  </span>
                </div>

                {/* Upload Transcript for this meeting */}
                <button style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, cursor: "pointer", width: "100%", justifyContent: "center",
                  background: selectedMeeting.hasTranscript ? C.tealGlow : C.hoverBg,
                  border: `1px solid ${selectedMeeting.hasTranscript ? C.tealBorder : C.border}`,
                  color: selectedMeeting.hasTranscript ? C.teal : C.textDim, fontSize: 11, fontWeight: 500,
                  fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {selectedMeeting.hasTranscript ? "Transcript uploaded" : "Upload transcript"}
                </button>

                {/* Delete Meeting */}
                <button onClick={() => deleteMeeting(selectedMeeting.id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, cursor: "pointer", width: "100%", justifyContent: "center",
                  background: "transparent", border: `1px solid rgba(180,60,60,0.15)`,
                  color: C.textDim, fontSize: 11, fontWeight: 500,
                  fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s", marginTop: 8,
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#d45a5a"; e.currentTarget.style.borderColor = "rgba(212,90,90,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.borderColor = "rgba(180,60,60,0.15)"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Remove meeting
                </button>
              </div>
            )}
          </div>

          {/* Recording Overlay */}
          {recState === "recording" && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10,10,12,0.85)", backdropFilter: "blur(12px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, animation: "fadeSlide 0.3s ease",
            }}>
              <div style={{
                background: C.card, borderRadius: 24, padding: "48px 56px",
                border: `1px solid rgba(212,90,90,0.15)`, textAlign: "center",
                maxWidth: 440, width: "100%",
                boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
              }}>
                {/* Pulsing mic icon */}
                <div style={{
                  width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
                  background: "rgba(212,90,90,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 40px rgba(212,90,90,0.2)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d45a5a", boxShadow: "0 0 12px rgba(212,90,90,0.6)" }} />
                </div>

                {/* Timer */}
                <div style={{ fontSize: 36, fontWeight: 300, color: C.text, fontFamily: "'Tomorrow', monospace", marginBottom: 8, letterSpacing: 3 }}>
                  {formatRecTimer(recTimer)}
                </div>
                <div style={{ fontSize: 13, color: "#d45a5a", fontWeight: 500, marginBottom: 28, letterSpacing: 0.5 }}>Recording in progress</div>

                {/* Audio bars */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, height: 48, marginBottom: 32 }}>
                  {recBars.map((h, i) => (
                    <div key={i} style={{
                      width: 3, borderRadius: 2, transition: "height 0.15s ease",
                      height: `${h * 48}px`,
                      background: i % 3 === 0 ? "rgba(212,90,90,0.5)" : `rgba(192,230,137,${0.2 + h * 0.4})`,
                    }} />
                  ))}
                </div>

                {/* Stop button */}
                <button onClick={stopRecording} style={{
                  padding: "14px 40px", borderRadius: 12, cursor: "pointer",
                  background: "rgba(212,90,90,0.12)", border: "1px solid rgba(212,90,90,0.25)",
                  color: "#d45a5a", fontSize: 14, fontWeight: 600,
                  fontFamily: "'Tomorrow', sans-serif", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 8, margin: "0 auto",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,90,90,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(212,90,90,0.12)"; }}
                >
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: "#d45a5a" }} />
                  Stop Recording
                </button>
              </div>
            </div>
          )}

          {/* Processing Overlay */}
          {recState === "processing" && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10,10,12,0.85)", backdropFilter: "blur(12px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, animation: "fadeSlide 0.3s ease",
            }}>
              <div style={{
                background: C.card, borderRadius: 24, padding: "48px 56px",
                border: `1px solid ${C.border}`, textAlign: "center",
                maxWidth: 400, width: "100%",
                boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite", marginBottom: 20 }}>
                  <path d="M21 12a9 9 0 11-6.22-8.56" />
                </svg>
                <div style={{ fontSize: 16, fontWeight: 500, color: C.text, fontFamily: "'Josefin Sans', sans-serif", marginBottom: 8 }}>Processing transcript</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>SOPHIA is transcribing and analysing the recording...</div>
              </div>
            </div>
          )}

          {/* Done Overlay (brief) */}
          {recState === "done" && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10,10,12,0.85)", backdropFilter: "blur(12px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, animation: "fadeSlide 0.3s ease",
            }}>
              <div style={{
                background: C.card, borderRadius: 24, padding: "48px 56px",
                border: `1px solid ${C.tealBorder}`, textAlign: "center",
                maxWidth: 400, width: "100%",
                boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", margin: "0 auto 20px",
                  background: C.tealGlow, display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 30px rgba(192,230,137,0.15)`,
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, color: C.teal, fontFamily: "'Josefin Sans', sans-serif", marginBottom: 8 }}>Transcript saved</div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>Your recording has been transcribed and is ready for SOPHIA to analyse.</div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};

// ─── Studio View (Record & Upload) ───
const MOCK_PAST_RECORDINGS = [
  { id: "r1", name: "Sales Pipeline Review", date: "Today, 2:00 PM", duration: "58 min", space: "Sales Team", spaceKey: "sales", status: "transcribed" as const },
  { id: "r2", name: "Product Sprint Retro", date: "Feb 28, 3:00 PM", duration: "32 min", space: "Product Buildout", spaceKey: "product", status: "transcribed" as const },
  { id: "r3", name: "Creative Kickoff", date: "Feb 27, 10:00 AM", duration: "45 min", space: "Creative", spaceKey: "creative", status: "transcribed" as const },
  { id: "r4", name: "1:1 with Product Lead", date: "Feb 26, 3:00 PM", duration: "28 min", space: "Product Buildout", spaceKey: "product", status: "analysed" as const },
  { id: "r5", name: "All-Hands Recap", date: "Feb 25, 11:00 AM", duration: "52 min", space: "Company", spaceKey: "company", status: "analysed" as const },
];

const RecordStudioView = () => {
  const { getApiToken } = useSophiaAuth();
  const [recState, setRecState] = useState<"idle" | "recording" | "processing" | "done">("idle");
  const [recTimer, setRecTimer] = useState(0);
  const [recBars, setRecBars] = useState(Array(50).fill(0.1));
  const [uploadState, setUploadState] = useState<"none" | "uploading" | "done">("none");
  const [pastRecordings, setPastRecordings] = useState<Array<{ id: string; name: string; date: string; duration: string; space: string; spaceKey: string; status: 'transcribed' | 'analysed' }>>(
    MOCK_PAST_RECORDINGS
  );
  const studioFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Fetch past recordings from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const apiMeetings = await getMeetings(token);
        if (cancelled) return;
        setPastRecordings(apiMeetings.map(m => ({
          id: String(m.meeting_id),
          name: m.title || 'Untitled',
          date: new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          duration: '—',
          space: m.source_platform || 'Upload',
          spaceKey: (m.source_platform || 'company').toLowerCase(),
          status: m.processed_status === 'completed' ? 'analysed' as const : 'transcribed' as const,
        })));
      } catch { /* keep mock fallback */ }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  useEffect(() => {
    if (recState === "recording") {
      const iv = setInterval(() => {
        setRecTimer(t => t + 1);
        setRecBars(Array(50).fill(0).map(() => 0.12 + Math.random() * 0.78));
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [recState]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setRecState("processing");
        try {
          const token = await getApiToken();
          if (token) {
            await uploadMeeting(file, `Recording ${new Date().toLocaleString()}`, token);
            // Refresh list
            const apiMeetings = await getMeetings(token);
            setPastRecordings(apiMeetings.map(m => ({
              id: String(m.meeting_id),
              name: m.title || 'Untitled',
              date: new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              duration: '—',
              space: m.source_platform || 'Upload',
              spaceKey: (m.source_platform || 'company').toLowerCase(),
              status: m.processed_status === 'completed' ? 'analysed' as const : 'transcribed' as const,
            })));
          }
          setRecState("done");
          setTimeout(() => setRecState("idle"), 3000);
        } catch (err) {
          console.error('Upload recording failed:', err);
          setRecState("idle");
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecState("recording");
      setRecTimer(0);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  const handleUpload = async (file?: File) => {
    const f = file || studioFileInputRef.current?.files?.[0];
    if (!f) { studioFileInputRef.current?.click(); return; }
    setUploadState("uploading");
    try {
      const token = await getApiToken();
      if (token) {
        await uploadMeeting(f, f.name.replace(/\.[^.]+$/, ''), token);
        // Refresh list
        const apiMeetings = await getMeetings(token);
        setPastRecordings(apiMeetings.map(m => ({
          id: String(m.meeting_id),
          name: m.title || 'Untitled',
          date: new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          duration: '—',
          space: m.source_platform || 'Upload',
          spaceKey: (m.source_platform || 'company').toLowerCase(),
          status: m.processed_status === 'completed' ? 'analysed' as const : 'transcribed' as const,
        })));
      }
      setUploadState("done");
      setTimeout(() => setUploadState("none"), 3000);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadState("none");
    }
  };

  const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const getSpaceColor = (key: string) => SPACE_COLORS[key] || SPACE_COLORS.company;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px", width: "100%", overflowY: "auto", flex: 1 }}>

      {/* Record + Upload Action Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {/* Record Now Card */}
        <div style={{
          flex: 1, background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
          borderRadius: 18, padding: "28px 24px",
          border: `1px solid ${recState === "recording" ? "rgba(212,90,90,0.2)" : "rgba(192,230,137,0.08)"}`,
          transition: "all 0.3s",
        }}>
          {recState === "idle" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: "linear-gradient(145deg, rgba(192,230,137,0.12), rgba(192,230,137,0.04))",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 30px rgba(192,230,137,0.15)",
              }}>
                <MicIcon size={28} color={C.teal} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, fontFamily: "'Josefin Sans', sans-serif", color: C.text, marginBottom: 6 }}>Record Meeting</div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 20 }}>
                Capture a live meeting. SOPHIA will transcribe and analyse the conversation.
              </div>
              <button onClick={startRecording} style={{
                width: "100%", padding: "13px 24px", borderRadius: 10, cursor: "pointer",
                background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                color: C.teal, fontSize: 14, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <MicIcon size={15} color={C.teal} />
                Start Recording
              </button>
            </div>
          )}

          {recState === "recording" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: "rgba(212,90,90,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 30px rgba(212,90,90,0.15)",
              }}>
                <MicIcon size={28} color={C.red} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.text, fontFamily: "'Josefin Sans', sans-serif", marginBottom: 4 }}>{formatTimer(recTimer)}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.red, animation: "pulse 1.4s ease infinite", boxShadow: `0 0 8px ${C.red}` }} />
                <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>Recording</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, height: 44, marginBottom: 20 }}>
                {recBars.map((a, i) => (
                  <div key={i} style={{
                    width: 3, height: `${a * 40}px`, borderRadius: 2,
                    background: C.red, transition: "height 0.12s ease", opacity: 0.4 + a * 0.6,
                  }} />
                ))}
              </div>
              <button onClick={stopRecording} style={{
                width: "100%", padding: "13px 24px", borderRadius: 10, cursor: "pointer",
                background: "rgba(212,90,90,0.12)", border: `1px solid rgba(212,90,90,0.25)`,
                color: C.red, fontSize: 14, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
              }}>Stop Recording</button>
            </div>
          )}

          {recState === "processing" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", margin: "0 auto 16px",
                border: `3px solid ${C.tealBorder}`, borderTopColor: C.teal, animation: "spin 0.9s linear infinite",
              }} />
              <div style={{ fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 4 }}>Processing transcript...</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Extracting meeting insights</div>
            </div>
          )}

          {recState === "done" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px",
                background: C.tealGlow, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: C.teal, marginBottom: 4 }}>Transcript saved</div>
              <div style={{ fontSize: 12, color: C.textDim }}>SOPHIA will analyse this meeting</div>
            </div>
          )}
        </div>

        {/* Upload Transcript Card */}
        <div style={{
          flex: 1, background: C.card, backdropFilter: "blur(28px) saturate(1.2)",
          borderRadius: 18, padding: "28px 24px",
          border: `1px solid ${uploadState === "done" ? C.tealBorder : C.border}`,
          transition: "all 0.3s",
        }}>
          {uploadState === "none" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: C.hoverBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px dashed ${C.border}`,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, fontFamily: "'Josefin Sans', sans-serif", color: C.text, marginBottom: 6 }}>Upload Transcript</div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: 20 }}>
                Upload a meeting recording or transcript file for SOPHIA to analyse.
              </div>
              <input ref={studioFileInputRef} type="file" accept=".mp3,.mp4,.wav,.txt,.vtt,.webm" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
              <button onClick={() => handleUpload()} style={{
                width: "100%", padding: "13px 24px", borderRadius: 10, cursor: "pointer",
                background: C.hoverBg, border: `1px solid ${C.border}`,
                color: C.textDim, fontSize: 14, fontWeight: 500, fontFamily: "'Tomorrow', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Choose File
              </button>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 10 }}>Supports .mp3, .mp4, .wav, .txt, .vtt, .webm</div>
            </div>
          )}

          {uploadState === "uploading" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", margin: "0 auto 16px",
                border: `3px solid ${C.tealBorder}`, borderTopColor: C.teal, animation: "spin 0.9s linear infinite",
              }} />
              <div style={{ fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 4 }}>Uploading transcript...</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Processing your meeting file</div>
            </div>
          )}

          {uploadState === "done" && (
            <div style={{ textAlign: "center", animation: "fadeSlide 0.3s ease", padding: "16px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px",
                background: C.tealGlow, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: C.teal, marginBottom: 4 }}>Transcript uploaded</div>
              <div style={{ fontSize: 12, color: C.textDim }}>SOPHIA will analyse this meeting</div>
            </div>
          )}
        </div>
      </div>

      {/* Past Recordings */}
      <div style={{ fontSize: 12, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>
        Recent Recordings
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pastRecordings.map(r => {
          const sc = getSpaceColor(r.spaceKey);
          return (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 16,
              background: C.card, backdropFilter: "blur(20px) saturate(1.2)",
              borderRadius: 12, padding: "14px 20px",
              border: "1px solid rgba(255,255,255,0.04)", transition: "all 0.2s",
              cursor: "pointer",
            }}>
              {/* Mic / Transcript icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: sc.bg, border: `1px solid ${sc.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MicIcon size={16} color={sc.text} />
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{r.date} · {r.duration}</div>
              </div>
              {/* Space tag */}
              <div style={{
                fontSize: 10, color: sc.text, padding: "3px 10px", borderRadius: 6,
                background: sc.bg, border: `1px solid ${sc.border}`, flexShrink: 0,
              }}>{r.space}</div>
              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                {r.status === "analysed" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.tealBorder}`, borderTopColor: C.teal }} />
                )}
                <span style={{ fontSize: 10, color: r.status === "analysed" ? C.teal : C.textDim, fontWeight: 500, textTransform: "capitalize" }}>{r.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Mock Chat Sessions ───
const MOCK_SESSIONS = [
  { id: "s1", title: "Sales Pipeline Review patterns", date: "Today", space: "Sales Team", active: true },
  { id: "s2", title: "Leadership style insights", date: "Today", space: "Sales Team", active: false },
  { id: "s3", title: "Product standup dynamics", date: "Yesterday", space: "Product Buildout", active: false },
  { id: "s4", title: "Creative Review debrief", date: "Yesterday", space: "Creative", active: false },
  { id: "s5", title: "1:1 with Product Lead prep", date: "Feb 28", space: "Product Buildout", active: false },
  { id: "s6", title: "Team trust-building patterns", date: "Feb 27", space: "Sales Team", active: false },
  { id: "s7", title: "Campaign collaboration insights", date: "Feb 26", space: "Creative", active: false },
  { id: "s8", title: "All-Hands meeting coaching", date: "Feb 25", space: "Company", active: false },
];

// ─── Login Screen ───
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [hoveredBtn, setHoveredBtn] = useState<"google" | "microsoft" | null>(null);

  return (
    <div style={{
      width: "100%", height: "100vh", position: "relative", overflow: "hidden",
      fontFamily: "'Tomorrow', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;600;700&family=Tomorrow:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes loginFadeIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes loginBgZoom { from { transform: scale(1.05); } to { transform: scale(1); } }
        @keyframes orbFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes loginOrbSwirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes loginOrbSwirlReverse { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
        @keyframes loginOrbPulse { 0%,100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes loginOrbRadiate { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
        @keyframes loginRipple { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.0); opacity: 0; } }
        @keyframes loginRipple2 { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(2.3); opacity: 0; } }
        @keyframes loginRipple3 { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(2.5); opacity: 0; } }
      `}</style>

      {/* Mountain background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        animation: "loginBgZoom 1.8s ease-out forwards",
      }}>
        <img
          src="/sophia-mountain-bg.jpg"
          alt=""
          style={{
            width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%",
            display: "block",
          }}
        />
      </div>

      {/* Gradient overlays */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(to top, rgba(15,12,10,0.7) 0%, rgba(15,12,10,0.3) 35%, rgba(15,12,10,0.05) 60%, transparent 100%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(15,12,10,0.35) 0%, transparent 70%)",
      }} />

      {/* Login card */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 400, maxWidth: "90vw",
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(28px) saturate(1.4)",
          WebkitBackdropFilter: "blur(28px) saturate(1.4)",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 1px 0 rgba(255,255,255,0.15) inset",
          padding: "48px 40px 36px",
          overflow: "hidden",
          animation: "loginFadeIn 0.9s ease-out 0.3s both",
        }}>
          {/* Orb + Branding */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
            <div style={{ position: "relative", width: 120, height: 120, marginBottom: 20, animation: "orbFloat 5s ease-in-out infinite" }}>
              {/* Ripple rings radiating outward */}
              {[0, 1, 2].map(i => (
                <div key={`ripple-${i}`} style={{
                  position: "absolute", inset: -2, borderRadius: "50%",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  animation: `loginRipple${i === 0 ? "" : i === 1 ? "2" : "3"} ${3 + i * 0.6}s ease-out infinite ${i * 1.1}s`,
                  pointerEvents: "none" as const,
                }} />
              ))}
              {/* Rainbow glow behind orb */}
              <div style={{
                position: "absolute", inset: -35, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, hsla(280,50%,80%,0.14) 20%, hsla(200,50%,75%,0.1) 35%, hsla(50,50%,75%,0.06) 50%, transparent 65%)",
                filter: "blur(22px)",
                animation: "loginOrbRadiate 5s ease-in-out infinite",
              }} />
              {/* Main orb body — same colours as SophiaWhiteOrb with swirl animations */}
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden",
                background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.92) 0%, rgba(248,250,255,0.75) 20%, rgba(240,245,255,0.55) 45%, rgba(225,235,250,0.4) 70%, rgba(210,220,245,0.32) 100%)",
                boxShadow: "inset 0 0 5px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.12)",
              }}>
                {/* Purple/indigo patch — swirling */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 75% 65% at 28% 25%, hsla(260,85%,68%,0.6) 0%, hsla(230,85%,72%,0.35) 30%, transparent 60%)", animation: "loginOrbSwirl 8s linear infinite" }} />
                {/* Teal patch — swirling */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 55% 70% at 18% 55%, hsla(185,90%,55%,0.65) 0%, hsla(170,85%,60%,0.3) 35%, transparent 65%)", animation: "loginOrbSwirlReverse 10s linear infinite" }} />
                {/* Green patch — swirling */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 50% 50% at 30% 75%, hsla(140,80%,52%,0.5) 0%, hsla(120,70%,58%,0.22) 40%, transparent 65%)", animation: "loginOrbSwirl 12s linear infinite" }} />
                {/* Yellow/gold patch — swirling */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 60% 45% at 50% 80%, hsla(48,85%,60%,0.5) 0%, hsla(40,80%,65%,0.22) 40%, transparent 65%)", animation: "loginOrbSwirlReverse 9s linear infinite" }} />
                {/* Orange/red patch — swirling */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 50% 65% at 78% 60%, hsla(20,85%,58%,0.55) 0%, hsla(10,80%,62%,0.28) 35%, transparent 60%)", animation: "loginOrbSwirl 11s linear infinite" }} />
                {/* Pink/magenta patch — swirling */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 65% 55% at 72% 28%, hsla(330,85%,62%,0.5) 0%, hsla(310,75%,66%,0.25) 35%, transparent 60%)", animation: "loginOrbSwirlReverse 7s linear infinite" }} />
                {/* Rainbow rim — full spectrum conic ring, rotating */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "conic-gradient(from -30deg, hsla(0,90%,60%,0.65) 0%, hsla(30,90%,62%,0.6) 8%, hsla(55,90%,60%,0.55) 14%, hsla(100,85%,55%,0.5) 22%, hsla(160,90%,55%,0.55) 30%, hsla(195,90%,58%,0.6) 38%, hsla(220,90%,60%,0.65) 46%, hsla(260,90%,62%,0.6) 54%, hsla(290,85%,65%,0.55) 62%, hsla(325,90%,62%,0.55) 70%, hsla(350,90%,60%,0.6) 80%, hsla(10,90%,58%,0.6) 90%, hsla(0,90%,60%,0.65) 100%)",
                  WebkitMaskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)",
                  maskImage: "radial-gradient(circle, transparent 48%, black 68%, black 100%)",
                  animation: "loginOrbSwirl 18s linear infinite",
                }} />
                {/* Rotating rainbow overlay wash */}
                <div style={{
                  position: "absolute", inset: "-35%", borderRadius: "50%",
                  background: "conic-gradient(from 0deg, hsla(0,70%,75%,0.2) 0%, hsla(45,70%,72%,0.22) 12%, hsla(90,60%,70%,0.18) 24%, hsla(160,65%,72%,0.2) 36%, hsla(210,70%,74%,0.22) 48%, hsla(260,65%,76%,0.2) 60%, hsla(310,60%,74%,0.18) 72%, hsla(340,65%,72%,0.2) 84%, hsla(0,70%,75%,0.2) 100%)",
                  animation: "loginOrbSwirlReverse 14s linear infinite",
                  mixBlendMode: "overlay" as const, opacity: 0.9,
                }} />
                {/* Glass core */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 45% 45%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)" }} />
                {/* Specular highlight — top left */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 55% 45% at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0.15) 50%, transparent 70%)" }} />
                {/* Specular — bottom right */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 28% 22% at 72% 72%, rgba(255,255,255,0.35) 0%, rgba(230,240,255,0.15) 40%, transparent 70%)" }} />
                {/* Edge depth */}
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "inset 0 0 3px rgba(0,0,0,0.15), inset 0 0 1px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.12)" }} />
                <div style={{ position: "absolute", inset: 1, borderRadius: "50%", border: "0.5px solid rgba(255,255,255,0.3)", pointerEvents: "none" as const }} />
              </div>
              {/* Blue rim ring */}
              <div style={{
                position: "absolute", inset: -4, borderRadius: "50%",
                border: "2px solid hsla(215,70%,60%,0.55)",
                boxShadow: "0 0 12px hsla(215,65%,55%,0.25), 0 0 25px hsla(215,60%,60%,0.12), inset 0 0 8px hsla(215,60%,70%,0.15)",
              }} />
            </div>
            <h1 style={{
              fontSize: 26, fontWeight: 600, letterSpacing: 4,
              fontFamily: "'Josefin Sans', sans-serif",
              color: "#FFFFFF",
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
              marginBottom: 8,
            }}>SOPHIA</h1>
            <p style={{
              fontSize: 13, fontWeight: 400, letterSpacing: 0.8,
              fontFamily: "'Tomorrow', sans-serif",
              color: "rgba(255,255,255,0.65)",
              textAlign: "center",
            }}>Culture Intelligence for Modern Teams</p>
          </div>

          {/* Sign-in buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Google */}
            <button
              onClick={onLogin}
              onMouseEnter={() => setHoveredBtn("google")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                width: "100%", padding: "14px 20px",
                background: hoveredBtn === "google" ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.92)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 14, fontWeight: 500, color: "#3c4043",
                fontFamily: "'Tomorrow', sans-serif",
                transition: "all 0.2s ease",
                boxShadow: hoveredBtn === "google"
                  ? "0 4px 16px rgba(0,0,0,0.2), 0 0 0 2px rgba(66,133,244,0.3)"
                  : "0 2px 8px rgba(0,0,0,0.15)",
                transform: hoveredBtn === "google" ? "translateY(-1px)" : "none",
              }}
            >
              {/* Google icon */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            {/* Microsoft */}
            <button
              onClick={onLogin}
              onMouseEnter={() => setHoveredBtn("microsoft")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                width: "100%", padding: "14px 20px",
                background: hoveredBtn === "microsoft" ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.92)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 14, fontWeight: 500, color: "#3c4043",
                fontFamily: "'Tomorrow', sans-serif",
                transition: "all 0.2s ease",
                boxShadow: hoveredBtn === "microsoft"
                  ? "0 4px 16px rgba(0,0,0,0.2), 0 0 0 2px rgba(0,120,212,0.3)"
                  : "0 2px 8px rgba(0,0,0,0.15)",
                transform: hoveredBtn === "microsoft" ? "translateY(-1px)" : "none",
              }}
            >
              {/* Microsoft icon */}
              <svg width="20" height="20" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </button>
          </div>

          {/* Footer */}
          <p style={{
            marginTop: 24, textAlign: "center",
            fontSize: 11, color: "rgba(255,255,255,0.35)",
            fontFamily: "'Tomorrow', sans-serif",
            lineHeight: 1.5,
          }}>
            By continuing, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Date formatting helpers ───
const formatSessionDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sessionDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (sessionDay.getTime() === today.getTime()) return "Today";
  if (sessionDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatMessageTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

const TRACK_LABELS: Record<string, string> = {
  leadership: "Leadership Session",
  execution: "Execution Session",
  performance: "Performance Session",
  communication: "Communication Session",
  wellbeing: "Wellbeing Session",
};

// ─── Main App ───
export default function SophiaV2() {
  const [screen, setScreen] = useState<"sophia" | "studios" | "calendar" | "studio" | "profile">("sophia");
  const [activeStudioId, setActiveStudioId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [spacesPopoutOpen, setSpacesPopoutOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; title: string; date: string; space: string; active: boolean }[]>([]);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const { mode: themeMode, toggle: toggleTheme } = useThemeMode();
  const consent = { recording: true, patterns: true, coaching: true, aggregation: true };
  const toggleConsent = (_key: keyof typeof consent) => { /* all consent required for MVP */ };

  // ─── Auth & User ───
  const { getApiToken } = useSophiaAuth();
  const { userProfile } = useCurrentUser();
  const { signOut } = useClerk();

  // Update USER from API profile
  if (userProfile) {
    USER = {
      name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'User',
      role: userProfile.role || '',
      email: userProfile.email || '',
    };
  }

  // ─── Fetch Teams & Stats → update STUDIOS, STUDIO_DATA, STUDIO_FEATURES ───
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fetchTeams = async () => {
      try {
        const token = await getApiToken();
        if (!token) return;
        const teams = await getTeams(token);
        if (cancelled) return;

        const newStudios: Record<string, Studio> = {};
        const newStudioData: Record<string, StudioDataEntry> = {};
        const newStudioFeatures: Record<string, Record<string, number>> = {};

        const orbPresets = [
          { primary: 20, secondary: 280, accent: 40 },
          { primary: 210, secondary: 45, accent: 170 },
          { primary: 270, secondary: 350, accent: 170 },
          { primary: 140, secondary: 30, accent: 200 },
          { primary: 320, secondary: 60, accent: 180 },
        ];

        await Promise.all(teams.map(async (team, idx) => {
          try {
            const [members, stats] = await Promise.all([
              getTeamMembers(team.team_id, token),
              getDashboardStats(team.team_id, token).catch(() => null),
            ]);

            const warmth = stats ? stats.latest_health_score / 100 : 0.5;
            const ownershipNorm = stats ? stats.average_ownership / 100 : 0.5;
            const invitationNorm = stats ? stats.average_invitation / 100 : 0.5;

            // Compute trend from meetings_history
            let trend: "up" | "down" | "flat" = "flat";
            if (stats?.meetings_history && stats.meetings_history.length >= 2) {
              const recent = stats.meetings_history[stats.meetings_history.length - 1];
              const prev = stats.meetings_history[stats.meetings_history.length - 2];
              const recentScore = (recent.ownership_score + recent.invitation_score) / 2;
              const prevScore = (prev.ownership_score + prev.invitation_score) / 2;
              trend = recentScore > prevScore + 2 ? "up" : recentScore < prevScore - 2 ? "down" : "flat";
            }

            newStudios[team.team_id] = {
              id: team.team_id,
              name: team.team_name,
              description: '',
              members: members.map(m => ({ name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email, role: m.role })),
              warmth,
              trend,
              orbColors: orbPresets[idx % orbPresets.length],
              latestObs: 'Analysis pending',
              lastMeeting: stats?.meetings_history?.length
                ? `${stats.meetings_history[stats.meetings_history.length - 1].title || 'Meeting'}`
                : 'No meetings yet',
            };

            // Build studioData from meetings_history
            const weeks: PeriodData[] = (stats?.meetings_history || []).map(mh => ({
              label: new Date(mh.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              warmth: (mh.ownership_score + mh.invitation_score) / 200,
              phase: "—",
              insight: "Analysis pending",
              start: [], stop: [], keep: [],
            }));
            newStudioData[team.team_id] = { weeks, months: [], quarters: [] };

            // Build studioFeatures from stats (2 real + 8 placeholder)
            const remaining = Math.max(0, 1 - ownershipNorm - invitationNorm);
            newStudioFeatures[team.team_id] = {
              ownership: ownershipNorm, inquiry: invitationNorm,
              challenge: remaining * 0.13, sharing: remaining * 0.12,
              decision: remaining * 0.12, framing: remaining * 0.13,
              participation: remaining * 0.13, overlap: remaining * 0.12,
              regulation: remaining * 0.13, future: remaining * 0.12,
            };
          } catch (err) {
            console.error(`Failed to fetch data for team ${team.team_id}:`, err);
          }
        }));

        if (!cancelled) {
          if (Object.keys(newStudios).length > 0) {
            STUDIOS = newStudios;
            STUDIO_DATA = newStudioData;
            STUDIO_FEATURES = newStudioFeatures;
            // Set activeStudioId to first team if not already set
            if (!activeStudioId || !newStudios[activeStudioId]) {
              setActiveStudioId(Object.keys(newStudios)[0]);
            }
          }
          setTeamsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to fetch teams:', err);
        setTeamsLoaded(true); // fall back to hardcoded defaults
      }
    };
    fetchTeams();
    return () => { cancelled = true; };
  }, [getApiToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch Coach Sessions ───
  useEffect(() => {
    let cancelled = false;
    const fetchSessions = async () => {
      try {
        const apiSessions = await listSessions();
        if (cancelled) return;
        setSessions(apiSessions.map(s => ({
          id: s.id,
          title: TRACK_LABELS[s.track] || s.track || "Session",
          date: formatSessionDate(s.started_at),
          space: "",
          active: !s.ended_at,
        })));
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      }
    };
    fetchSessions();
    return () => { cancelled = true; };
  }, []);

  const activeStudio = STUDIOS[activeStudioId] || Object.values(STUDIOS)[0] || { id: "", name: "Loading...", description: "", members: [], warmth: 0, trend: "flat" as const, orbColors: { primary: 0, secondary: 0, accent: 0 }, latestObs: "", lastMeeting: "" };

  const handleSelectStudio = (id: string) => { setActiveStudioId(id); };

  const nav = [
    { id: "sophia" as const, label: "SOPHIA", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> },
    { id: "studios" as const, label: "Culture Health", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /></svg> },
    { id: "calendar" as const, label: "Calendar", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { id: "studio" as const, label: "Studio", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg> },
  ];

  const handleDeleteSession = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession === id) setActiveSession(null);
    try { await apiDeleteSession(id); } catch (err) { console.error('Failed to delete session:', err); }
  };

  const createNewSession = async (title?: string) => {
    try {
      const session = await startSession('leadership', 'support');
      const newSession = {
        id: session.id,
        title: title || TRACK_LABELS[session.track] || "New conversation",
        date: "Today",
        space: activeStudio.name,
        active: true,
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSession(session.id);
      return session.id;
    } catch (err) {
      console.error('Failed to create session:', err);
      // Fallback to local-only session
      const newId = `s_${Date.now()}`;
      setSessions(prev => [{ id: newId, title: title || "New conversation", date: "Today", space: activeStudio.name, active: true }, ...prev]);
      setActiveSession(newId);
      return newId;
    }
  };

  // Group sessions by date
  const todaySessions = sessions.filter(s => s.date === "Today");
  const yesterdaySessions = sessions.filter(s => s.date === "Yesterday");
  const olderSessions = sessions.filter(s => s.date !== "Today" && s.date !== "Yesterday");

  return (
    <div style={{
      width: "100%", height: "100vh", display: "flex",
      position: "relative",
      fontFamily: "'Tomorrow', sans-serif", color: C.text, overflow: "hidden",
      background: C.bg,
      transition: "background 0.35s ease, color 0.35s ease",
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.tealBorder}; border-radius: 3px; }
        .sophia-chat-scroll::-webkit-scrollbar { width: 6px; }
        .sophia-chat-scroll::-webkit-scrollbar-track { background: rgba(227,222,216,0.04); border-radius: 3px; margin: 8px 0; }
        .sophia-chat-scroll::-webkit-scrollbar-thumb { background: rgba(127,193,170,0.35); border-radius: 3px; min-height: 40px; }
        .sophia-chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(127,193,170,0.55); }
        .sophia-chat-scroll { scrollbar-width: thin; scrollbar-color: rgba(127,193,170,0.35) transparent; }
        input:focus, textarea:focus { outline: none; }
        button { font-family: 'Tomorrow', sans-serif; }
      `}</style>

      {/* ─── LEFT SIDEBAR ─── */}
      <aside style={{
        width: sidebarOpen ? 260 : 0, flexShrink: 0, position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column",
        background: C.sidebarBg, backdropFilter: "blur(28px) saturate(1.2)",
        borderRight: sidebarOpen ? `1px solid ${C.border}` : "none",
        transition: "width 0.25s ease, background 0.35s ease, filter 0.3s ease, opacity 0.3s ease", overflow: "hidden",
        filter: spacesPopoutOpen ? "blur(6px)" : "none",
        opacity: spacesPopoutOpen ? 0.5 : 1,
        pointerEvents: spacesPopoutOpen ? "none" : "auto",
      }}>
        {/* Sidebar Top: Logo + New Chat */}
        <div style={{ padding: "18px 16px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SophiaWhiteOrb size={28} />
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Josefin Sans', sans-serif", color: C.text, letterSpacing: 1 }}>SOPHIA</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{
              background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 4, display: "flex",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="3" x2="21" y2="3" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="21" x2="21" y2="21" /></svg>
            </button>
          </div>

          {/* New Chat Button */}
          <button onClick={() => { setScreen("sophia"); setActiveSession(null); }} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
            borderRadius: 10, cursor: "pointer",
            background: C.hoverBg, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, fontWeight: 500, transition: "all 0.2s",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New conversation
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <div style={{ padding: "4px 10px 8px", flexShrink: 0 }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => { setScreen(n.id); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
              borderRadius: 8, border: "none", cursor: "pointer",
              background: screen === n.id ? C.activeBg : "transparent",
              color: screen === n.id ? C.text : C.textDim,
              fontSize: 12.5, fontWeight: screen === n.id ? 600 : 400, transition: "all 0.15s",
              textAlign: "left",
            }}
              onMouseEnter={e => { if (screen !== n.id) e.currentTarget.style.background = C.hoverBg; }}
              onMouseLeave={e => { if (screen !== n.id) e.currentTarget.style.background = "transparent"; }}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.border, margin: "4px 16px 8px" }} />

        {/* Chat Sessions List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
          {/* Today */}
          {todaySessions.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, padding: "8px 10px 4px" }}>Today</div>
              {todaySessions.map(s => {
                const isActive = activeSession === s.id;
                return (
                <div key={s.id} style={{ position: "relative" }}
                  onMouseEnter={e => { const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "1"; if (!isActive) (e.currentTarget.firstChild as HTMLElement).style.background = C.hoverBg; }}
                  onMouseLeave={e => { const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "0"; if (!isActive) (e.currentTarget.firstChild as HTMLElement).style.background = "transparent"; }}
                >
                  <button onClick={() => { setScreen("sophia"); setActiveSession(s.id); }} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px",
                    borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                    background: isActive ? C.activeBg : "transparent", transition: "all 0.15s",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isActive ? C.teal : C.textDim} strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    <span style={{
                      fontSize: 12, color: isActive ? C.text : C.textDim, fontWeight: isActive ? 500 : 400,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>{s.title}</span>
                  </button>
                  <button data-del onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer",
                    background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity 0.15s",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                </div>
              );})}
            </>
          )}

          {/* Yesterday */}
          {yesterdaySessions.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, padding: "12px 10px 4px" }}>Yesterday</div>
              {yesterdaySessions.map(s => {
                const isActive = activeSession === s.id;
                return (
                <div key={s.id} style={{ position: "relative" }}
                  onMouseEnter={e => { const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "1"; (e.currentTarget.firstChild as HTMLElement).style.background = C.hoverBg; }}
                  onMouseLeave={e => { const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "0"; if (!isActive) (e.currentTarget.firstChild as HTMLElement).style.background = "transparent"; }}
                >
                  <button onClick={() => { setScreen("sophia"); setActiveSession(s.id); }} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px",
                    borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                    background: isActive ? C.activeBg : "transparent", transition: "all 0.15s",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    <span style={{
                      fontSize: 12, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>{s.title}</span>
                  </button>
                  <button data-del onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer",
                    background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity 0.15s",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                </div>
              );})}
            </>
          )}

          {/* Older */}
          {olderSessions.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, padding: "12px 10px 4px" }}>Previous</div>
              {olderSessions.map(s => {
                const isActive = activeSession === s.id;
                return (
                <div key={s.id} style={{ position: "relative" }}
                  onMouseEnter={e => { const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "1"; (e.currentTarget.firstChild as HTMLElement).style.background = C.hoverBg; }}
                  onMouseLeave={e => { const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "0"; if (!isActive) (e.currentTarget.firstChild as HTMLElement).style.background = "transparent"; }}
                >
                  <button onClick={() => { setScreen("sophia"); setActiveSession(s.id); }} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px",
                    borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                    background: isActive ? C.activeBg : "transparent", transition: "all 0.15s",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    <span style={{
                      fontSize: 12, color: C.textDim, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>{s.title}</span>
                  </button>
                  <button data-del onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer",
                    background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity 0.15s",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                </div>
              );})}
            </>
          )}
        </div>

        {/* Sidebar Bottom: User Profile */}
        <div style={{
          padding: "12px 14px", flexShrink: 0,
          borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setScreen("profile")} style={{
              display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "8px 8px",
              borderRadius: 10, cursor: "pointer", border: "none",
              background: screen === "profile" ? C.activeBg : "transparent",
              transition: "all 0.15s", textAlign: "left", minWidth: 0,
            }}
              onMouseEnter={e => { if (screen !== "profile") e.currentTarget.style.background = C.hoverBg; }}
              onMouseLeave={e => { if (screen !== "profile") e.currentTarget.style.background = "transparent"; }}
            >
              <Avatar name={USER.name} size={30} image={avatarImage} bgColor={avatarColor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{USER.name}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>{USER.role}</div>
              </div>
            </button>
            {/* Theme toggle */}
            <button onClick={toggleTheme} style={{
              background: C.hoverBg, border: `1px solid ${C.border}`, borderRadius: 8,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = C.activeBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.hoverBg; }}
            >
              {themeMode === "light" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textDim} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 2, overflow: "hidden" }}>

        {/* Sidebar toggle (when sidebar collapsed) */}
        {!sidebarOpen && (
          <div style={{
            padding: "12px 16px", display: "flex", alignItems: "center", flexShrink: 0,
          }}>
            <button onClick={() => setSidebarOpen(true)} style={{
              background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 4, display: "flex",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="3" x2="21" y2="3" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="21" x2="21" y2="21" /></svg>
            </button>
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {screen === "sophia" && <SophiaChat activeStudio={activeStudio} isNewConversation={activeSession === null} activeSessionId={activeSession} onStartConversation={(title) => createNewSession(title)} consent={consent} onToggleConsent={toggleConsent} />}
            {screen === "studios" && (
              <SpacesView activeStudioId={activeStudioId} onSelectStudio={handleSelectStudio} onPopoutChange={setSpacesPopoutOpen} />
            )}
            {screen === "calendar" && <CalendarView />}
            {screen === "studio" && <RecordStudioView />}
            {screen === "profile" && <ProfilePage onNavigateStudio={(id) => { setActiveStudioId(id); setScreen("studios"); }} consent={consent} onToggleConsent={toggleConsent} onSignOut={() => signOut()} avatarImage={avatarImage} avatarColor={avatarColor} onAvatarImageChange={setAvatarImage} onAvatarColorChange={setAvatarColor} />}
          </div>
        </main>
      </div>
    </div>
  );
}
