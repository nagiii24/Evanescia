import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 pb-24 pt-8 pl-0 md:pl-64">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-block text-sm text-cyan-400 hover:text-cyan-300 mb-6"
        >
          ← Back to Evanescia
        </Link>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
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
