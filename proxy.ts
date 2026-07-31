import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";

const protectedMiddleware = clerkMiddleware(async (auth, request) => {
  const path = request.nextUrl.pathname;
  const isPublicRoute =
    path === "/" || path.startsWith("/sign-in") || path.startsWith("/sign-up");
  if (!isPublicRoute) await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (
    process.env.NEXT_PUBLIC_KNOCK_DEMO_MODE === "1" ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    return NextResponse.next();
  }
  return protectedMiddleware(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
