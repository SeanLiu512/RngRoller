import 'dotenv/config';
import { prisma } from '../db.js';

const KEEP = ['261392n@student.hci.edu.sg', 'seanliu512@hotmail.com'];

async function main() {
  await prisma.$transaction([
    prisma.arenaMatch.deleteMany(),
    prisma.roll.deleteMany(),
    prisma.emailOtp.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.upload.deleteMany(),
    prisma.user.deleteMany({ where: { email: { notIn: KEEP } } }),
    prisma.user.updateMany({
      where: { email: { in: KEEP } },
      data: { equipped_badge: '', custom_badge_name: '', custom_badge_image: '', ep_spent: 0, active_boost: '', store_unlocks: [] },
    }),
    prisma.user.updateMany({ where: { email: 'seanliu512@hotmail.com' }, data: { role: 'superadmin', banned: false } }),
    prisma.user.updateMany({ where: { email: '261392n@student.hci.edu.sg' }, data: { role: 'user', banned: false } }),
  ]);
  console.log('Cleanup complete: only the two requested accounts remain; all game and upload data was removed.');
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
