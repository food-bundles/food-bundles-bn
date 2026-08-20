interface PrismaErrorShape {
  name?: string;
  code?: string;
  meta?: {
    target?: string | string[];
    field_name?: string;
  };
  message?: string;
}

/**
 * Translates a raw Prisma error into a user-friendly message.
 * Returns null when the error is not a Prisma error or has no friendly mapping.
 */
export function getFriendlyPrismaError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const err = error as PrismaErrorShape;

  const isPrismaError =
    err.name === "PrismaClientKnownRequestError" ||
    (typeof err.message === "string" &&
      err.message.includes("prisma.") &&
      typeof err.code === "string");

  if (!isPrismaError) return null;

  switch (err.code) {
    case "P2002": {
      const target = Array.isArray(err.meta?.target)
        ? err.meta!.target
        : typeof err.meta?.target === "string"
          ? err.meta.target.split(",").map((f) => f.trim())
          : [];
      const fields = target.map((f) => f.toLowerCase());

      if (fields.includes("phone")) {
        return "This phone number is already registered. Please use a different phone number or sign in to your existing account.";
      }
      if (fields.includes("email")) {
        return "This email address is already registered. Please sign in to your existing account.";
      }
      if (fields.includes("tin")) {
        return "This TIN is already registered. Please use a different TIN.";
      }
      if (fields.length > 0) {
        return `A record with the same ${fields.join(", ")} already exists. Please use different values.`;
      }
      return "A record with the same details already exists. Please use different values.";
    }
    case "P2003":
      return "The related record could not be found. Please check the information you provided.";
    case "P2000":
      return "One of the values you provided is too long. Please shorten it and try again.";
    case "P2025":
      return "The record you are trying to update does not exist.";
    default:
      return null;
  }
}