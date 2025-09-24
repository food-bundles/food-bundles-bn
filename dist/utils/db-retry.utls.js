"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryDatabaseOperation = retryDatabaseOperation;
/**
 * Retry function for database operations
 */
async function retryDatabaseOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            // Check if it's a connection error that we should retry
            if (error.code === "P1017" || // Server has closed the connection
                error.code === "P1001" || // Can't reach database server
                error.code === "P1008" || // Operations timed out
                error.message?.includes("connection") ||
                error.message?.includes("timeout")) {
                console.log(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
                if (attempt < maxRetries) {
                    // Wait before retrying with exponential backoff
                    const waitTime = delay * Math.pow(2, attempt - 1);
                    console.log(`Retrying in ${waitTime}ms...`);
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
