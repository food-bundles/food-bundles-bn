/**
 * Retry function for database operations
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  delay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if it's a connection error that we should retry
      if (
        error.code === "P1017" || // Server has closed the connection
        error.code === "P1001" || // Can't reach database server
        error.code === "P1008" || // Operations timed out
        error.message?.includes("connection") ||
        error.message?.includes("timeout")
      ) {
        if (attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          const waitTime = delay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // If it's not a retryable error or we've exhausted retries, throw
      throw error;
    }
  }

  throw lastError;
}
