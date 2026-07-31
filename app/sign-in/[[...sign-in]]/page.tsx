import { SignIn } from "@clerk/nextjs";
import { KnockBrand } from "@/components/brand";
import { SetupRequired } from "@/components/setup-required";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <SetupRequired />;
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="grid justify-items-center gap-8">
        <KnockBrand />
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/app"
        />
      </div>
    </main>
  );
}
