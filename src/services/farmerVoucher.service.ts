import prisma from "../prisma";

/**
 * Farmer Voucher Service
 * Adapts the existing voucher service for farmer use cases
 */

interface FarmerVoucherRequest {
  farmerId: string;
  requestedAmount: number;
  purpose: string;
  voucherDays: number;
}

interface FarmerVoucherEligibility {
  isEligible: boolean;
  reason: string;
  maxAmount?: number;
  maxDays?: number;
}

/**
 * Submit voucher request for farmer
 */
export const submitFarmerVoucherRequest = async (
  data: FarmerVoucherRequest
) => {
  const { farmerId, requestedAmount, purpose, voucherDays } = data;

  // Validate farmer exists
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
  });

  if (!farmer) {
    throw new Error("Farmer not found");
  }

  // Ensure farmer has an active subscription
  let existingSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      farmerId,
      status: "ACTIVE",
    },
  });

  if (!existingSubscription) {
    let defaultPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Basic Farmer Plan" },
    });

    if (!defaultPlan) {
      defaultPlan = await prisma.subscriptionPlan.create({
        data: {
          name: "Basic Farmer Plan",
          description: "Basic plan for farmers to access voucher system",
          price: 0.0,
          duration: 30,
          voucherAccess: true,
          voucherPaymentDays: 60,
          features: [
            "Voucher Request",
            "Product Submission",
            "Payment History",
          ],
          isActive: true,
        },
      });
    }

    existingSubscription = await prisma.restaurantSubscription.create({
      data: {
        farmerId,
        planId: defaultPlan.id,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Create loan application directly for farmer
  return await prisma.loanApplication.create({
    data: {
      farmerId,
      requestedAmount,
      purpose,
      status: "PENDING",
    },
  });
};

/**
 * Get farmer's voucher applications
 */
export const getFarmerVoucherApplications = async (farmerId: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
  });

  if (!farmer) {
    throw new Error("Farmer not found");
  }

  return await prisma.loanApplication.findMany({
    where: { farmerId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Get farmer's vouchers
 */
export const getFarmerVouchers = async (farmerId: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
  });

  if (!farmer) {
    throw new Error("Farmer not found");
  }

  return await prisma.voucher.findMany({
    where: { farmerId },
    include: {
      transactions: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Check farmer's voucher eligibility
 */
export const checkFarmerVoucherEligibility = async (
  farmerId: string
): Promise<FarmerVoucherEligibility> => {
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
    });

    if (!farmer) {
      return {
        isEligible: false,
        reason: "Farmer not found",
      };
    }

    // Check existing applications and vouchers
    const [applications, vouchers] = await Promise.all([
      prisma.loanApplication.findMany({ where: { farmerId } }),
      prisma.voucher.findMany({ where: { farmerId } }),
    ]);

    // Check for pending applications
    const pendingApplications = applications.filter(
      (app) => app.status === "PENDING"
    );
    if (pendingApplications.length > 0) {
      return {
        isEligible: false,
        reason: "You have pending loan applications",
      };
    }

    // Check for overdue vouchers
    const overdueVouchers = vouchers.filter(
      (v) =>
        v.status === "ACTIVE" &&
        new Date() >
          new Date(
            v.createdAt.getTime() + v.repaymentDays * 24 * 60 * 60 * 1000
          )
    );
    if (overdueVouchers.length > 0) {
      return {
        isEligible: false,
        reason: "You have overdue voucher payments",
      };
    }

    // New farmer eligibility
    if (applications.length === 0) {
      return {
        isEligible: true,
        reason: "New farmer eligible for first voucher",
        maxAmount: 100000,
        maxDays: 30,
      };
    }

    // Existing farmer eligibility
    return {
      isEligible: true,
      reason: "Eligible for voucher",
      maxAmount: 500000,
      maxDays: 60,
    };
  } catch (error: any) {
    return {
      isEligible: false,
      reason: error.message || "Unable to check eligibility",
    };
  }
};

/**
 * Get farmer voucher summary
 */
export const getFarmerVoucherSummary = async (farmerId: string) => {
  try {
    const [applications, vouchers] = await Promise.all([
      getFarmerVoucherApplications(farmerId),
      getFarmerVouchers(farmerId),
    ]);

    const totalRequested = applications.reduce(
      (sum, app) => sum + app.requestedAmount,
      0
    );
    const totalApproved = applications
      .filter((app) => app.approvedAmount)
      .reduce((sum, app) => sum + (app.approvedAmount || 0), 0);

    const activeVouchers = vouchers.filter((v) => v.status === "ACTIVE");
    const totalRemainingCredit = activeVouchers.reduce(
      (sum, v) => sum + v.remainingCredit,
      0
    );

    return {
      totalApplications: applications.length,
      totalRequested,
      totalApproved,
      activeVouchers: activeVouchers.length,
      totalRemainingCredit,
      pendingApplications: applications.filter(
        (app) => app.status === "PENDING"
      ).length,
      approvedApplications: applications.filter(
        (app) => app.status === "APPROVED"
      ).length,
      rejectedApplications: applications.filter(
        (app) => app.status === "REJECTED"
      ).length,
    };
  } catch (error) {
    console.error("Error getting farmer voucher summary:", error);
    return {
      totalApplications: 0,
      totalRequested: 0,
      totalApproved: 0,
      activeVouchers: 0,
      totalRemainingCredit: 0,
      pendingApplications: 0,
      approvedApplications: 0,
      rejectedApplications: 0,
    };
  }
};
