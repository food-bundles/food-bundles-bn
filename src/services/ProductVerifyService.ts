import prisma from "../prisma";

export const purchaseProductService = async (
  submissionId: string,
  acceptedQty: number,
  unitPrice: number,
  foodBundleId: string
) => {
  const existingSubmission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
    },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  const foodBundle = await prisma.admin.findUnique({
    where: { id: foodBundleId },
  });

  if (!foodBundle) {
    throw new Error("Food bundle not found");
  }

  if (
    existingSubmission.submittedQty === null ||
    acceptedQty > existingSubmission.submittedQty
  ) {
    throw new Error("Accepted quantity is greater than submitted quantity");
  }

  const totalAmount = acceptedQty * unitPrice;

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      acceptedQty,
      unitPrice,
      totalAmount,
      foodBundleId,
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
      foodBundle: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
  });

  return updatedSubmission;
};

export const updateSubmissionService = async (
  submissionId: string,
  acceptedQty: number,
  unitPrice: number,
  foodBundleId: string
) => {
  const existingSubmission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  if (existingSubmission.status !== "VERIFIED") {
    throw new Error("Can only update submissions with VERIFIED status");
  }

  if (existingSubmission.foodBundleId !== foodBundleId) {
    throw new Error("You can only update submissions you have verified");
  }

  const totalAmount = acceptedQty * unitPrice;

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      acceptedQty,
      unitPrice,
      totalAmount,
      verifiedAt: new Date(), 
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
      foodBundle: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
  });

  return updatedSubmission;
};

export const clearSubmissionService = async (submissionId: string) => {
  const existingSubmission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      acceptedQty: null,
      unitPrice: null,
      totalAmount: null,
      foodBundleId: null,
      status: "PENDING",
      verifiedAt: null,
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
    },
  });

  return updatedSubmission;
};

export const getAllSubmissionsService = async () => {
  const submissions = await prisma.farmerSubmission.findMany({
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
      foodBundle: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
    orderBy: {
      submittedAt: "desc",
    },
  });

  return submissions;
};

export const getSubmissionByIdService = async (submissionId: string) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
      foodBundle: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  return submission;
};
