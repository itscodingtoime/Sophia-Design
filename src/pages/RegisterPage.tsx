import { SignUp } from '@clerk/clerk-react';
import AuthLayout from '../layouts/AuthLayout';
import { C } from '../theme';

const SignUpPage = () => {
  return (
    <AuthLayout
      title="Get started"
      subtitle="Join now and unlock tools to boost team health and personal productivity."
    >
      <SignUp routing="path" path="/register" signInUrl="/login" afterSignUpUrl="/dashboard" />
    </AuthLayout>
  );
};

export default SignUpPage;
