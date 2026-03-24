import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import InAppBrowserAuthHint from '@/components/auth/InAppBrowserAuthHint';

/** Avoid stale static shell; auth pages must be dynamic. */
export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 pb-24 pt-8 pl-0 md:pl-64">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-block text-sm text-cyan-400 hover:text-cyan-300 mb-6"
        >
          ← Back to Evanescia
        </Link>
        <InAppBrowserAuthHint />
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
          appearance={{
            variables: {
              colorPrimary: '#e75480',
            },
          }}
        />
      </div>
    </main>
  );
}
