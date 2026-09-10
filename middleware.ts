import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { buildVerifyEmailPath, isEmailVerified, requiresVerifiedEmailPath } from '@/lib/auth';
import { onboardingRequired } from '@/lib/onboarding';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/verify-email',
  '/skippers',
  '/missions',
  '/mentions-legales',
  '/confidentialite',
  '/cgu',
  '/cookies',
];
const PRIVATE_PATHS = [
  '/dashboard',
  '/onboarding',
  '/profile',
  '/messages',
  '/notifications',
  '/missions/new',
  '/my-missions',
  '/my-applications',
  '/account',
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPrivatePath(pathname: string) {
  return PRIVATE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAdminPath(pathname: string) {
  return pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/');
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/')) {
    return response;
  }

  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

const {
  data: { user },
} = await supabase.auth.getUser();

  const userEmail = user?.email ?? null;
  const nextPath = pathname + request.nextUrl.search;

  if (pathname === '/verify-email' && user && isEmailVerified(user)) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile && onboardingRequired(profile)) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    const target = profile?.role === 'skipper' ? '/dashboard/skipper' : profile?.role === 'admin' ? '/dashboard/admin' : '/dashboard/demandeur';
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (user && !isEmailVerified(user) && requiresVerifiedEmailPath(pathname)) {
    return NextResponse.redirect(new URL(buildVerifyEmailPath(userEmail, nextPath), request.url));
  }

  if (user && isAdminPath(pathname)) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (isPrivatePath(pathname) && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password'))) {
    if (!isEmailVerified(user)) {
      return NextResponse.redirect(new URL(buildVerifyEmailPath(userEmail, nextPath), request.url));
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile && onboardingRequired(profile)) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    const target = profile?.role === 'skipper' ? '/dashboard/skipper' : profile?.role === 'admin' ? '/dashboard/admin' : '/dashboard/demandeur';
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (!user && !isPublicPath(pathname) && pathname.startsWith('/')) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
