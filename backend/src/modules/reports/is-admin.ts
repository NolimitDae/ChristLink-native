import { PrismaService } from '../../prisma/prisma.service';

/** profiles.role = 'admin' (the old is_admin() SQL helper). False when signed out. */
export async function isAdmin(prisma: PrismaService, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const p = await prisma.profiles.findUnique({ where: { id: userId }, select: { role: true } });
  return p?.role === 'admin';
}

export const OK = { success: true } as const;
