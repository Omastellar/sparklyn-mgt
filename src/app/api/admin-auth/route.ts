import { NextResponse } from 'next/server';
import {
  verifyAdminPassword,
  createAdminSessionToken,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  isRequestAuthorizedAsAdmin,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS
} from '../../../lib/auth';

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'default-client';
}

// Check current admin session status
export async function GET(req: Request) {
  const isAuthorized = isRequestAuthorizedAsAdmin(req);
  return NextResponse.json({ authenticated: isAuthorized });
}

// Authenticate or Logout
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Handle logout action
    if (body.action === 'logout') {
      const res = NextResponse.json({ success: true, message: 'Logged out' });
      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      return res;
    }

    const { password } = body;
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // Rate-limiting check
    const clientId = getClientIdentifier(req);
    const rateCheck = checkRateLimit(clientId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Try again in ${rateCheck.waitSeconds}s.`
        },
        { status: 429 }
      );
    }

    // Verify password with timing attack protection
    const isValid = verifyAdminPassword(password);
    if (!isValid) {
      const record = recordFailedAttempt(clientId);
      if (record.locked) {
        return NextResponse.json(
          {
            success: false,
            error: 'Account locked for 15 minutes due to too many failed attempts.'
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Invalid admin credentials' },
        { status: 401 }
      );
    }

    // Reset failed attempts on success
    resetFailedAttempts(clientId);

    // Create cryptographically signed token
    const token = createAdminSessionToken();

    const response = NextResponse.json({
      success: true,
      message: 'Admin authenticated successfully',
      token
    });

    // Set HTTP-only secure cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
