/**
 * Minimal migration runner for the ChainVerse backend.
 *
 * Why: Mongoose is schema-less by default. Without a migration strategy,
 * field renames or additions leave existing documents in an inconsistent state.
 *
 * Usage: ts-node scripts/migrate.ts
 *
 * Each migration is a plain async function that receives the Mongoose
 * connection. Migrations are idempotent and tracked in a `_migrations`
 * collection so they only run once.
 */
import mongoose from 'mongoose';

const MIGRATIONS_COLLECTION = '_migrations';

interface Migration {
  name: string;
  up(db: mongoose.Connection): Promise<void>;
}

const migrations: Migration[] = [
  {
    name: '001-add-student-email-index',
    async up(db) {
      await db.collection('students').createIndex({ email: 1 }, { unique: true });
    },
  },
  {
    name: '002-backfill-course-totalEnrollments',
    async up(db) {
      const courses = db.collection('courses');
      const enrollments = db.collection('enrollments');
      const cursor = courses.find({ totalEnrollments: { $exists: false } });
      for await (const course of cursor) {
        const count = await enrollments.countDocuments({ courseId: course._id });
        await courses.updateOne({ _id: course._id }, { $set: { totalEnrollments: count } });
      }
    },
  },
];

async function run() {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI env var is required');

  const conn = await mongoose.createConnection(uri).asPromise();
  const ran = new Set(
    (await conn.collection(MIGRATIONS_COLLECTION).find().toArray()).map((d: any) => d.name),
  );

  for (const m of migrations) {
    if (ran.has(m.name)) continue;
    console.log(`Running migration: ${m.name}`);
    await m.up(conn);
    await conn.collection(MIGRATIONS_COLLECTION).insertOne({ name: m.name, ranAt: new Date() });
    console.log(`  Done: ${m.name}`);
  }

  await conn.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
