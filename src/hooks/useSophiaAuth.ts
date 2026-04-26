import { useCallback } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';

export function useSophiaAuth() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();

  const getApiToken = useCallback(async () => {
    if (organization?.id) {
      return await getToken({ organizationId: organization.id });
    }
    return await getToken();
  }, [getToken, organization?.id]);

  return { getApiToken, isLoaded, isSignedIn, organization };
}
