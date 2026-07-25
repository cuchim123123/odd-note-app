/**
 * Backfill Script: PostgreSQL → MongoDB note_projections
 * ────────────────────────────────────────────────────────
 * One-time migration to seed MongoDB with existing note data before
 * switching PROJECTION_STORE=mongo. Designed to be idempotent:
 * uses updateOne with upsert + $setOnInsert so re-running is always safe.
 *
 * Usage:
 *   npx tsx apps/api/scripts/backfill-note-projections.ts
 *
 * Required env vars (reads from apps/api/.env automatically):
 *   DATABASE_URL  — PostgreSQL connection string
 *   MONGO_URI     — MongoDB connection string
 *   MONGO_DB_NAME — (optional) defaults to odd_note_projections
 *
 * Progress: logs every BATCH_SIZE notes.
 * On completion: prints row counts for both Prisma and MongoDB to verify.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

// ── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'odd_note_projections';

const BATCH_SIZE = 500;

if (!DATABASE_URL) throw new Error('DATABASE_URL env var is required');
if (!MONGO_URI) throw new Error('MONGO_URI env var is required');

// ── Clients ──────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
const mongo = new MongoClient(MONGO_URI);

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await mongo.connect();
  const db = mongo.db(MONGO_DB_NAME);
  const notesCol = db.collection('note_projections');
  const revisionsCol = db.collection('note_revision_projections');

  console.log('──────────────────────────────────────────────');
  console.log('  Backfill: PostgreSQL → MongoDB Projections  ');
  console.log('──────────────────────────────────────────────');

  // ── 1. Backfill note_projections ──────────────────────────────────────────

  console.log('\n[1/2] Backfilling note_projections...');

  const totalNotes = await prisma.note.count();
  console.log(`  Total notes in PostgreSQL: ${totalNotes}`);

  let processedNotes = 0;
  let cursor = 0;

  while (processedNotes < totalNotes) {
    const notes = await prisma.note.findMany({
      take: BATCH_SIZE,
      skip: cursor,
      orderBy: { createdAt: 'asc' },
      include: {
        protection: { select: { id: true } },
        shares: {
          select: {
            id: true,
            recipientId: true,
            recipientEmail: true,
            permission: true,
            createdAt: true,
            recipient: { select: { displayName: true } },
          },
        },
        userLabels: { select: { userId: true, labels: true } },
        userPins: { select: { userId: true, isPinned: true } },
      },
    });

    if (notes.length === 0) break;

    const ops = notes.map((note) => ({
      updateOne: {
        filter: { _id: note.id },
        update: {
          $setOnInsert: {
            _id: note.id,
            userId: note.userId,
            title: note.title,
            isPinned: note.userPins?.[0]?.isPinned ?? note.isPinned,
            isProtected: Boolean(note.protection),
            isShared: note.isShared,
            labels: note.userLabels?.[0]?.labels ?? note.labels ?? [],
            shares: note.shares.map((s) => ({
              shareId: s.id,
              recipientId: s.recipientId,
              recipientEmail: s.recipientEmail,
              recipientDisplayName: s.recipient?.displayName ?? null,
              permission: s.permission,
              sharedAt: s.createdAt,
            })),
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            aggregateVersion: 0,
            lastEventId: '',
            projectionUpdatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await notesCol.bulkWrite(ops, { ordered: false });

    processedNotes += notes.length;
    cursor += notes.length;
    process.stdout.write(`\r  Progress: ${processedNotes}/${totalNotes} notes`);
  }

  console.log(`\n  ✅ note_projections: ${processedNotes} documents written`);

  // ── 2. Backfill note_revision_projections ─────────────────────────────────

  console.log('\n[2/2] Backfilling note_revision_projections...');

  const totalRevisions = await prisma.noteRevision.count();
  console.log(`  Total revisions in PostgreSQL: ${totalRevisions}`);

  let processedRevisions = 0;
  cursor = 0;

  while (processedRevisions < totalRevisions) {
    const revisions = await prisma.noteRevision.findMany({
      take: BATCH_SIZE,
      skip: cursor,
      orderBy: { createdAt: 'asc' },
    });

    if (revisions.length === 0) break;

    const ops = revisions.map((r) => ({
      updateOne: {
        filter: { _id: r.id },
        update: {
          $setOnInsert: {
            _id: r.id,
            noteId: r.noteId,
            targetSeq: r.targetSeq.toString(),
            label: r.label,
            createdBy: r.createdBy,
            createdAt: r.createdAt,
          },
        },
        upsert: true,
      },
    }));

    await revisionsCol.bulkWrite(ops, { ordered: false });

    processedRevisions += revisions.length;
    cursor += revisions.length;
    process.stdout.write(`\r  Progress: ${processedRevisions}/${totalRevisions} revisions`);
  }

  console.log(`\n  ✅ note_revision_projections: ${processedRevisions} documents written`);

  // ── 3. Verification ───────────────────────────────────────────────────────

  console.log('\n[Verification] Row count comparison:');

  const pgNoteCount = await prisma.note.count();
  const mongoNoteCount = await notesCol.countDocuments();
  const pgRevisionCount = await prisma.noteRevision.count();
  const mongoRevisionCount = await revisionsCol.countDocuments();

  console.log(`  Notes     | Postgres: ${pgNoteCount} | MongoDB: ${mongoNoteCount} | Match: ${pgNoteCount === mongoNoteCount ? '✅' : '❌'}`);
  console.log(`  Revisions | Postgres: ${pgRevisionCount} | MongoDB: ${mongoRevisionCount} | Match: ${pgRevisionCount === mongoRevisionCount ? '✅' : '❌'}`);

  if (pgNoteCount !== mongoNoteCount || pgRevisionCount !== mongoRevisionCount) {
    console.error('\n❌ Count mismatch — do NOT flip PROJECTION_STORE=mongo yet. Re-run to fill gaps.');
    process.exit(1);
  }

  console.log('\n✅ Backfill complete. Safe to set PROJECTION_STORE=mongo.');

  // ── 4. Create indexes (idempotent) ────────────────────────────────────────

  console.log('\n[Indexes] Ensuring MongoDB indexes...');
  await notesCol.createIndex({ userId: 1 });
  await notesCol.createIndex({ userId: 1, updatedAt: -1 });
  await notesCol.createIndex({ userId: 1, isPinned: -1, updatedAt: -1 });
  await notesCol.createIndex({ 'shares.recipientId': 1 });
  await revisionsCol.createIndex({ noteId: 1, createdAt: -1 });
  console.log('  ✅ Indexes created/verified');
}

main()
  .catch((err) => {
    console.error('\n❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongo.close();
  });
