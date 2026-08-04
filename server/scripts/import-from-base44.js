// One-time migration script: imports data exported from your old Base44
// app (via CSV, from the Base44 dashboard) into this self-hosted database.
//
// HOW TO GET THE CSVs (from your Base44 dashboard, not this app):
//   1. Open your app in the Base44 editor.
//   2. Go to Dashboard -> Data (or "Entities").
//   3. Open the "User" table -> Export -> CSV. Save as Users.csv
//   4. Open the "Roll" table -> Export -> CSV. Save as Roll.csv
//   5. Open the "ArenaMatch" table -> Export -> CSV. Save as ArenaMatch.csv
//   6. Put all three files in a folder, e.g. ./migration-data/ in this project.
//
// HOW TO RUN (from the project root, with DATABASE_URL set to your
// production/Railway database — see below):
//   node server/scripts/import-from-base44.js ./migration-data
//
// IMPORTANT: migrated users do NOT get their old Base44 password — Base44
// never exposes password hashes, and rightly so. After migration, tell
// existing users to use "Forgot password" on the login page once, to set
// a password for the first time in the new system (this works even though
// they've never had a password here, since the reset flow doesn't require
// an existing one).
//
// This script is safe to re-run: it upserts by email and skips duplicate
// Roll/ArenaMatch rows it already imported (tracked by their original
// Base44 id, stored temporarily during the run).

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../db.js';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node server/scripts/import-from-base44.js <folder-with-csvs>');
  process.exit(1);
}

function readCsv(filename) {
  const filePath = path.join(folder, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  (skipping — ${filename} not found in ${folder})`);
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return parse(raw, { columns: true, skip_empty_lines: true });
}

// Base44 CSV-exports array fields in varying formats depending on plan/version
// (JSON-array text, or comma-separated). This handles either.
function parseArrayField(value) {
  if (!value) return [];
  const trimmed = String(value).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // not JSON — fall through to comma-splitting
  }
  return trimmed
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function parseBool(value) {
  return String(value).trim().toLowerCase() === 'true';
}

function parseDate(value) {
  const d = value ? new Date(value) : null;
  return d && !isNaN(d.getTime()) ? d : new Date();
}

async function main() {
  console.log(`Importing from ${folder} ...`);

  // ── 1. Users ──
  const userRows = readCsv('Users.csv');
  // Maps the OLD Base44 user id -> email, so Roll/ArenaMatch rows (which
  // reference the old id) can be pointed at the right new user below.
  const oldIdToEmail = new Map();
  // Maps email -> NEW user id in this database.
  const emailToNewId = new Map();

  console.log(`Users: ${userRows.length} rows`);
  for (const row of userRows) {
    const email = String(row.email || '').toLowerCase().trim();
    if (!email) continue;
    if (row.id) oldIdToEmail.set(row.id, email);

    const data = {
      role: row.role === 'admin' ? 'admin' : 'user',
      banned: parseBool(row.banned),
      equipped_badge: row.equipped_badge || '',
      custom_badge_name: row.custom_badge_name || '',
      custom_badge_image: row.custom_badge_image || '',
      ep_spent: Number(row.ep_spent) || 0,
      active_boost: row.active_boost || '',
      store_unlocks: parseArrayField(row.store_unlocks),
      emailVerified: true, // they already verified on Base44
    };

    const user = await prisma.user.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
    });
    emailToNewId.set(email, user.id);
  }
  console.log(`  -> upserted ${emailToNewId.size} users`);

  // ── 2. Rolls ──
  const rollRows = readCsv('Roll.csv');
  console.log(`Rolls: ${rollRows.length} rows`);
  let rollCount = 0;
  for (const row of rollRows) {
    const oldOwnerId = row.created_by_id;
    const ownerEmail = row.created_by || oldIdToEmail.get(oldOwnerId);
    const newOwnerId = ownerEmail ? emailToNewId.get(String(ownerEmail).toLowerCase().trim()) : null;
    if (!newOwnerId) {
      console.log(`  skipping roll ${row.id} — couldn't match its owner`);
      continue;
    }

    await prisma.roll.create({
      data: {
        number: Number(row.number) || 0,
        ep: Number(row.ep) || 0,
        rarity: row.rarity || 'common',
        badges: parseArrayField(row.badges),
        roller_name: row.roller_name || '',
        roll_date: row.roll_date || '',
        equipped_badge: row.equipped_badge || '',
        custom_badge_name: row.custom_badge_name || '',
        custom_badge_image: row.custom_badge_image || '',
        roller_vip: parseBool(row.roller_vip),
        created_by_id: newOwnerId,
        created_by: ownerEmail,
        createdAt: parseDate(row.created_date),
      },
    });
    rollCount++;
  }
  console.log(`  -> imported ${rollCount} rolls`);

  // ── 3. Arena matches ──
  const arenaRows = readCsv('ArenaMatch.csv');
  console.log(`Arena matches: ${arenaRows.length} rows`);
  let arenaCount = 0;
  for (const row of arenaRows) {
    const oldOwnerId = row.created_by_id;
    const ownerEmail = row.created_by || oldIdToEmail.get(oldOwnerId);
    const newOwnerId = ownerEmail ? emailToNewId.get(String(ownerEmail).toLowerCase().trim()) : null;
    if (!newOwnerId) {
      console.log(`  skipping arena match ${row.id} — couldn't match its owner`);
      continue;
    }

    await prisma.arenaMatch.create({
      data: {
        player_name: row.player_name || '',
        weapon_id: row.weapon_id || '',
        badges_used: parseArrayField(row.badges_used),
        result: row.result === 'victory' ? 'victory' : 'defeat',
        kills: Number(row.kills) || 0,
        damage_dealt: Number(row.damage_dealt) || 0,
        damage_taken: Number(row.damage_taken) || 0,
        survival_time: Number(row.survival_time) || 0,
        rank: Number(row.rank) || 4,
        created_by_id: newOwnerId,
        created_by: ownerEmail,
        createdAt: parseDate(row.created_date),
      },
    });
    arenaCount++;
  }
  console.log(`  -> imported ${arenaCount} arena matches`);

  console.log('\nDone. Remind migrated users to use "Forgot password" once to set their password.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
