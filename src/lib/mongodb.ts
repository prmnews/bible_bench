import mongoose from "mongoose";

import { assertEnv } from "@/lib/env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  mongoose?: MongooseCache;
};

const cached = globalForMongoose.mongoose ?? { conn: null, promise: null };

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    assertEnv();
    const uri = process.env.MONGODB_URI as string;
    const dbName = process.env.MONGODB_DBNAME;
    const options = dbName ? { dbName } : undefined;
    cached.promise = mongoose.connect(uri, options);
  }

  cached.conn = await cached.promise;
  globalForMongoose.mongoose = cached;
  return cached.conn;
}
