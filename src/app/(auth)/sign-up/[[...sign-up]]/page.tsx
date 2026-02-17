// TODO: Replace with Clerk <SignUp /> component when keys are available
// import { SignUp } from "@clerk/nextjs";
// export default function SignUpPage() {
//   return <SignUp />;
// }

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Sign Up</h1>
        <p className="text-muted-foreground">
          Clerk authentication will be configured here.
        </p>
      </div>
    </div>
  );
}
