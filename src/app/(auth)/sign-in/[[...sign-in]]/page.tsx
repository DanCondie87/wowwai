// TODO: Replace with Clerk <SignIn /> component when keys are available
// import { SignIn } from "@clerk/nextjs";
// export default function SignInPage() {
//   return <SignIn />;
// }

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Sign In</h1>
        <p className="text-muted-foreground">
          Clerk authentication will be configured here.
        </p>
      </div>
    </div>
  );
}
