import { NextResponse } from 'next/server';
import { verifyAdminPassword } from '../../../lib/db';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
    }
    const isValid = verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid admin credentials' }, { status: 401 });
    }
    return NextResponse.json({ success: true, message: 'Admin authenticated' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
