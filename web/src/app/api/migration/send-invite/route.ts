import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getEmailService } from '@/lib/email-service';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    });

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, email, firstName } = body;

    if (!userId || !email || !firstName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, and firstName' },
        { status: 400 }
      );
    }

    // Verify user exists and hasn't already migrated
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        migrationInvitationToken: true,
        migrationTokenExpiresAt: true,
        isMigrated: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isMigrated) {
      return NextResponse.json(
        { error: 'User has already completed migration' },
        { status: 400 }
      );
    }

    // Generate migration token if not exists or expired
    let token = user.migrationInvitationToken;
    let tokenExpiry = user.migrationTokenExpiresAt;
    
    const now = new Date();
    if (!token || !tokenExpiry || tokenExpiry < now) {
      // Generate new token (URL-safe)
      token = randomBytes(32).toString('base64url');
      tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      // Update user with new token
      await prisma.user.update({
        where: { id: userId },
        data: {
          migrationInvitationToken: token,
          migrationTokenExpiresAt: tokenExpiry
        }
      });
    }

    // Generate migration link
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const migrationLink = `${baseUrl}/migrate?token=${token}`;

    // Send email
    const emailService = getEmailService();
    await emailService.sendMigrationInvite({
      to: email,
      firstName,
      migrationLink
    });

    // Update invitation tracking fields
    await prisma.user.update({
      where: { id: userId },
      data: {
        migrationInvitationSent: true,
        migrationInvitationSentAt: new Date(),
        migrationLastSentAt: new Date(),
        migrationInvitationCount: {
          increment: 1
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Migration invite sent successfully',
      data: {
        userId,
        email,
        tokenExpiry
      }
    });

  } catch (error) {
    console.error('Error sending migration invite:', error);
    return NextResponse.json(
      { error: 'Failed to send migration invite', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}