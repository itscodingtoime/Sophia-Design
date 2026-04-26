import { SignIn } from '@clerk/clerk-react';
import { useEffect } from 'react';
import AuthLayout from '../layouts/AuthLayout';
import { C } from '../theme';

const SignInPage = () => {
  useEffect(() => {
    const removeBadge = () => {
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length === 0 && el.textContent?.toLowerCase().includes('last used')) {
          (el as HTMLElement).style.display = 'none';
        }
      });
    };

    removeBadge();
    const observer = new MutationObserver(removeBadge);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Access your dashboard to view the latest team insights and coaching."
    >
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/register"
        forceRedirectUrl="/chat"
      />
    </AuthLayout>
  );
};

export default SignInPage;
