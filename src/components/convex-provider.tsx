"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

// TODO: Replace with ConvexProviderWithClerk when Clerk keys are available
// import { ClerkProvider, useAuth } from "@clerk/nextjs";
// import { ConvexProviderWithClerk } from "convex/react-clerk";

// TODO: When Clerk is configured, wrap with:
// <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
//   <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
//     {children}
//   </ConvexProviderWithClerk>
// </ClerkProvider>

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
