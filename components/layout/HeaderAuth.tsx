'use client';

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

export default function HeaderAuth() {
  const { isSignedIn } = useUser();

  return (
    <div className="fixed top-4 right-4 z-50 ml-16 md:ml-0">
      {!isSignedIn ? (
        <SignInButton mode="modal">
          <button className="px-4 py-2 bg-gradient-to-r from-sakura-deep to-sakura-primary backdrop-blur-md hover:from-sakura-deep/90 hover:to-sakura-primary/90 border border-sakura-primary/50 rounded-lg font-medium transition-all text-white shadow-[0_0_10px_rgba(255,183,197,0.4)] hover:shadow-[0_0_15px_rgba(255,183,197,0.6)] hover:ring-2 hover:ring-gold-accent/50">
            Sign In
          </button>
        </SignInButton>
      ) : (
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-10 h-10 border-2 border-sakura-primary/50 shadow-[0_0_10px_rgba(255,183,197,0.4)]",
            }
          }}
        />
      )}
    </div>
  );
}
