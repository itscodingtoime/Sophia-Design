import React from 'react';

// If a real photo is dropped at /public/mikey.jpg it'll pick up automatically.
// Otherwise the Avatar falls back to initials.
const fakeUser = {
  id: 'mikey-1',
  firstName: 'Mikey',
  lastName: 'Ferraris',
  fullName: 'Mikey Ferraris',
  primaryEmailAddress: { emailAddress: 'mikey@innersystems.ai' },
  emailAddresses: [{ emailAddress: 'mikey@innersystems.ai' }],
  imageUrl: '/mikey.jpg',
  publicMetadata: {},
  unsafeMetadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  update: async () => fakeUser,
};

const fakeOrg = {
  id: 'innersystems',
  name: 'InnerSystems',
  slug: 'design-preview',
  imageUrl: '',
  membersCount: 1,
  publicMetadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  update: async () => fakeOrg,
  destroy: async () => {},
  getMemberships: async () => ({ data: [], total_count: 0 }),
  getInvitations: async () => ({ data: [], total_count: 0 }),
  getRoles: async () => ({ data: [], total_count: 0 }),
  getDomains: async () => ({ data: [], total_count: 0 }),
  addMember: async () => fakeMembership,
  inviteMember: async () => ({}),
  inviteMembers: async () => ([]),
  removeMember: async () => fakeMembership,
  updateMember: async () => fakeMembership,
  setLogo: async () => fakeOrg,
};

const fakeMembership = {
  role: 'admin',
  organization: fakeOrg,
  publicUserData: {
    userId: fakeUser.id,
    firstName: fakeUser.firstName,
    lastName: fakeUser.lastName,
    imageUrl: '',
    identifier: fakeUser.primaryEmailAddress.emailAddress,
  },
  destroy: async () => {},
  update: async () => fakeMembership,
};

const fakeUserMembership = {
  id: 'stub-membership-1',
  organization: fakeOrg,
  role: 'admin',
};

// --- Providers & gating components ---
export const ClerkProvider: React.FC<any> = ({ children }) => <>{children}</>;
export const SignedIn: React.FC<any> = ({ children }) => <>{children}</>;
export const SignedOut: React.FC<any> = () => null;
export const ClerkLoaded: React.FC<any> = ({ children }) => <>{children}</>;
export const ClerkLoading: React.FC<any> = () => null;

export const SignIn: React.FC<any> = () => (
  <div style={{ padding: 24, color: '#aaa' }}>SignIn (stubbed — design preview)</div>
);
export const SignUp: React.FC<any> = () => (
  <div style={{ padding: 24, color: '#aaa' }}>SignUp (stubbed — design preview)</div>
);
export const UserButton: React.FC<any> = () => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: '#4b5563',
      display: 'inline-block',
    }}
  />
);

// --- Stable references for hooks ---
// Re-creating these every render would break any consumer that uses them in
// useEffect/useCallback dep arrays — which causes infinite re-fetch loops.
const stableGetToken = async () => null;
const stableSignOut = async () => {};
const stableNoop = () => {};
const stableSetActive = async () => {};
const stableCreateOrg = async () => fakeOrg;
const stableFetchNext = () => {};

const stableAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: fakeUser.id,
  sessionId: 'stub-session',
  orgId: fakeOrg.id,
  orgRole: 'admin',
  orgSlug: fakeOrg.slug,
  signOut: stableSignOut,
  getToken: stableGetToken,
};

const stableUser = { isLoaded: true, isSignedIn: true, user: fakeUser };

const stableClerk = {
  user: fakeUser,
  session: { id: 'stub-session' },
  signOut: stableSignOut,
  openSignIn: stableNoop,
  openSignUp: stableNoop,
  openUserProfile: stableNoop,
  redirectToSignIn: stableNoop,
  redirectToSignUp: stableNoop,
  setActive: stableSetActive,
};

const stableMemberships = {
  data: [fakeMembership],
  isLoading: false,
  hasNextPage: false,
  fetchNext: stableFetchNext,
};

const stableInvitations = {
  data: [] as any[],
  isLoading: false,
  hasNextPage: false,
  fetchNext: stableFetchNext,
};

const stableOrg = {
  isLoaded: true,
  organization: fakeOrg,
  membership: fakeMembership,
  memberships: stableMemberships,
  invitations: stableInvitations,
};

const stableUserMemberships = {
  data: [fakeUserMembership],
  isLoading: false,
  hasNextPage: false,
  fetchNext: stableFetchNext,
  count: 1,
};

const stableOrgList = {
  isLoaded: true,
  userMemberships: stableUserMemberships,
  organizationList: [{ organization: fakeOrg, membership: fakeMembership }],
  setActive: stableSetActive,
  createOrganization: stableCreateOrg,
};

// --- Hooks ---
export const useAuth = () => stableAuth;
export const useUser = () => stableUser;
export const useClerk = () => stableClerk;
export const useOrganization = () => stableOrg;
export const useOrganizationList = () => stableOrgList;

export default {
  ClerkProvider,
  SignedIn,
  SignedOut,
  ClerkLoaded,
  ClerkLoading,
  SignIn,
  SignUp,
  UserButton,
  useAuth,
  useUser,
  useClerk,
  useOrganization,
  useOrganizationList,
};
