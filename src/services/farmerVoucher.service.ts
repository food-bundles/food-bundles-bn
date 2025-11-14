import prisma from "../prisma";
import {
  submitLoanApplicationService,
  getRestaurantLoanApplicationsService,
  getMyVouchersService,
  checkLoanEligibilityService,
} from "./voucher.service";

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
 * Maps farmer data to restaurant voucher system
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

  // Create or get farmer's "restaurant" record for voucher system
  let farmerRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { email: farmer.phone + "@farmer.foodbundles.rw" },
        { phone: farmer.phone }
      ]
    },
  });

  if (!farmerRestaurant) {
    // Create a restaurant record for the farmer
    farmerRestaurant = await prisma.restaurant.create({
      data: {
        name: `Farmer ${farmer.phone}`,
        email: farmer.phone + "@farmer.foodbundles.rw",
        phone: farmer.phone,
        province: farmer.province,
        district: farmer.district,
        sector: farmer.sector,
        cell: farmer.cell,
        village: farmer.village,
        tin: `FARMER-${farmer.phone}`,
        password: "default123",
      },
    });
  }

  // Ensure farmer has an active subscription
  const existingSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId: farmerRestaurant.id,
      status: "ACTIVE"
    }
  });

  if (!existingSubscription) {
    let defaultPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Basic Farmer Plan" },
    });

    // Create the plan if it doesn't exist
    if (!defaultPlan) {
      defaultPlan = await prisma.subscriptionPlan.create({
        data: {
          name: "Basic Farmer Plan",
          description: "Basic plan for farmers to access voucher system",
          price: 0.00,
          duration: 365,
          voucherAccess: true,
          voucherPaymentDays: 60,
          features: ["Voucher Request", "Product Submission", "Payment History"],
          isActive: true,
        },
      });
    }

    await prisma.restaurantSubscription.create({
      data: {
        restaurantId: farmerRestaurant.id,
        planId: defaultPlan.id,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });
  }

  // Submit loan application using the voucher service
  return await submitLoanApplicationService({
    restaurantId: farmerRestaurant.id,
    requestedAmount,
    purpose,
    voucherDays,
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

  // Find farmer's restaurant record
  const farmerRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { email: farmer.phone + "@farmer.foodbundles.rw" },
        { phone: farmer.phone }
      ]
    },
  });

  if (!farmerRestaurant) {
    return [];
  }

  return await getRestaurantLoanApplicationsService(farmerRestaurant.id);
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

  // Find farmer's restaurant record
  const farmerRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { email: farmer.phone + "@farmer.foodbundles.rw" },
        { phone: farmer.phone }
      ]
    },
  });

  if (!farmerRestaurant) {
    return [];
  }

  return await getMyVouchersService(farmerRestaurant.id);
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

    // Find farmer's restaurant record
    const farmerRestaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { email: farmer.phone + "@farmer.foodbundles.rw" },
          { phone: farmer.phone }
        ]
      },
    });

    if (!farmerRestaurant) {
      // New farmer is eligible for first voucher
      return {
        isEligible: true,
        reason: "New farmer eligible for first voucher",
        maxAmount: 100000, // 100,000 RWF for new farmers
        maxDays: 30,
      };
    }

    // Check eligibility using existing service
    const eligibility = await checkLoanEligibilityService(farmerRestaurant.id);

    return {
      isEligible: eligibility.isEligible,
      reason: eligibility.reason,
      maxAmount: eligibility.isEligible ? 500000 : undefined, // 500,000 RWF max for existing farmers
      maxDays: eligibility.isEligible ? 60 : undefined,
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
