import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16부터 "middleware.ts" 대신 "proxy.ts" 파일명을 씁니다.
// 로그인 여부만 확인합니다. 도메인 제한(myrealtrip.com)은
// auth.ts의 signIn 콜백에서 로그인 시점에 이미 걸러집니다.
export default auth((request) => {
  const isLoggedIn = Boolean(request.auth);

  if (!isLoggedIn) {
    const signInUrl = new URL(
      "/api/auth/signin",
      request.nextUrl.origin,
    );
    signInUrl.searchParams.set(
      "callbackUrl",
      request.nextUrl.pathname,
    );
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // /api/auth/*(로그인 처리 자체), 정적 파일은 건너뜁니다.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
