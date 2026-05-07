import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session if it exists. This calls supabase.auth.getUser()
  // which reads the session cookie, validates it, and if expired refreshes it.
  // The refreshed tokens are written back via setAll above.
  try {
    await supabase.auth.getUser();
  } catch (error) {
    // If refresh token is invalid, clear the session cookies
    if (error instanceof Error && error.message.includes('Refresh Token Not Found')) {
      console.log('[middleware] Invalid refresh token, clearing session');
      // Clear auth cookies by setting them to empty with past expiry
      const authCookies = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token'];
      authCookies.forEach(cookieName => {
        supabaseResponse.cookies.set(cookieName, '', {
          expires: new Date(0),
          path: '/',
        });
      });
    } else {
      throw error; // Re-throw other errors
    }
  }

  return supabaseResponse;
}
