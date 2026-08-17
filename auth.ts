import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// 사내 구글 계정(myrealtrip.com)으로만 로그인할 수 있게 제한합니다.
const ALLOWED_EMAIL_DOMAIN = "myrealtrip.com";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      // 구글 로그인 화면에서도 myrealtrip.com 계정 위주로 보여주지만,
      // 이것만으로는 우회가 가능하므로 아래 signIn 콜백에서 한 번 더 검증합니다.
      authorization: {
        params: {
          hd: ALLOWED_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email ?? "";
      const hostedDomain = (
        profile as { hd?: string } | undefined
      )?.hd;

      const isAllowed =
        hostedDomain === ALLOWED_EMAIL_DOMAIN ||
        email.toLowerCase().endsWith(
          `@${ALLOWED_EMAIL_DOMAIN}`,
        );

      return isAllowed;
    },
  },
});
