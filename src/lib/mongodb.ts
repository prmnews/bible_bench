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

/**
 * Check if MongoDB connection is healthy
 */
export async function isConnectionHealthy(): Promise<boolean> {
  try {
    if (!cached.conn) {
      return false;
    }
    const state = mongoose.connection.readyState;
    // 1 = connected, 2 = connecting
    if (state !== 1 && state !== 2) {
      return false;
    }
    // Ping the database to verify connection
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure MongoDB connection is healthy, reconnect if needed
 */
export async function ensureConnectionHealthy(): Promise<void> {
  const isHealthy = await isConnectionHealthy();
  if (!isHealthy) {
    // Reset cached connection to force reconnection
    cached.conn = null;
    cached.promise = null;
    globalForMongoose.mongoose = cached;
    await connectToDatabase();
  }
}

/**
 * Retry a MongoDB operation with exponential backoff
 */
export async function retryMongoOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Ensure connection is healthy before each attempt
      if (attempt > 0) {
        await ensureConnectionHealthy();
      }
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a retryable error
      const isRetryable = isRetryableMongoError(lastError);
      
      if (attempt === maxRetries || !isRetryable) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );

      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

/**
 * Check if a MongoDB error is retryable
 */
function isRetryableMongoError(error: Error): boolean {
  const errorName = error.constructor.name;
  const errorMessage = error.message.toLowerCase();

  // Network/timeout errors
  if (
    errorName === "MongoServerSelectionError" ||
    errorName === "MongoNetworkTimeoutError" ||
    errorName === "MongoNetworkError" ||
    errorMessage.includes("timed out") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("network")
  ) {
    return true;
  }

  // Transient errors
  if (
    errorName === "MongoWriteConcernError" ||
    errorName === "MongoServerError"
  ) {
    // Check for specific error codes that are retryable
    const mongoError = error as { code?: number };
    if (mongoError.code !== undefined) {
      // Transient transaction errors
      const retryableCodes = [
        6, // HostUnreachable
        7, // HostNotFound
        89, // NetworkTimeout
        91, // ShutdownInProgress
        11600, // InterruptedAtShutdown
        11602, // InterruptedDueToReplStateChange
      ];
      return retryableCodes.includes(mongoError.code);
    }
  }

  return false;
}
