/**
 * useAuthMutation — authenticated drop-in replacement for Convex useMutation.
 *
 * Routes all write mutations through the Next.js /api/mutations route, which
 * verifies the session cookie before forwarding to Convex. This prevents
 * unauthenticated mutation calls directly to the Convex URL.
 *
 * Usage:
 *   // Before (unauthenticated):
 *   const createTask = useMutation(api.tasks.create);
 *   await createTask({ ... });
 *
 *   // After (authenticated via Next.js session):
 *   const createTask = useAuthMutation("tasks.create");
 *   await createTask({ ... });
 *
 * The hook returns a stable function reference (never changes across renders),
 * matching the behavior of Convex's useMutation. Errors are thrown so callers
 * can catch them and show appropriate feedback.
 */

export type AuthMutationName =
  | "tasks.create"
  | "tasks.update"
  | "tasks.moveToColumn"
  | "tasks.reorder"
  | "projects.create"
  | "projects.update"
  | "projects.archive";

/**
 * Returns an async function that calls the given mutation via /api/mutations.
 * Throws if the request fails or returns a non-OK status.
 */
export function useAuthMutation<TArgs extends Record<string, unknown>, TResult = unknown>(
  mutationName: AuthMutationName
): (args: TArgs) => Promise<TResult> {
  // Stable reference — no state, no deps
  return async (args: TArgs): Promise<TResult> => {
    const res = await fetch("/api/mutations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutation: mutationName, args }),
    });

    if (!res.ok) {
      let message = `Mutation ${mutationName} failed (${res.status})`;
      try {
        const data = await res.json();
        if (data.error) message = data.error;
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(message);
    }

    const data = await res.json();
    return data.result as TResult;
  };
}
