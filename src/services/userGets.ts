import prisma from "../prisma";

export const getUserById = async (id: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { id },
    include: {
      submissions: {
        include: {
          approvedProduct: true,
          aggregator: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          loan: true,
          transactions: true,
          repayments: true,
          penalties: true,
        },
      },
      LoanApplication: {
        include: {
          vouchers: true,
          repayments: true,
          approver: true,
        },
      },
      RestaurantSubscription: {
        include: {
          plan: true,
          payments: true,
        },
      },
    },
  });
  if (farmer) return { ...farmer, userType: "FARMER", name: "Farmer" };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      orders: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          affiliator: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          loan: true,
          transactions: true,
          repayments: true,
          penalties: true,
          approver: true,
        },
      },
      Wallet: {
        include: {
          transactions: {
            include: {
              admin: true,
              affiliator: true,
              trader: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      subscriptions: {
        include: {
          plan: true,
          payments: true,
          history: true,
        },
        orderBy: { createdAt: "desc" },
      },
      affiliators: {
        include: {
          orders: {
            include: {
              orderItems: true,
            },
          },
          walletTransactions: true,
        },
      },
      walletTransactions: {
        include: {
          admin: true,
          affiliator: true,
          trader: true,
        },
        orderBy: { createdAt: "desc" },
      },
      posts: true,
      LoanApplication: {
        include: {
          vouchers: true,
          repayments: true,
          approver: true,
          manager: true,
        },
      },
      VoucherTransaction: {
        include: {
          voucher: true,
          order: true,
        },
      },
      VoucherRepayment: {
        include: {
          voucher: true,
          loan: true,
        },
      },
      VoucherPenalty: {
        include: {
          voucher: true,
        },
      },
    },
  });
  if (restaurant)
    return { ...restaurant, userType: "RESTAURANT", name: restaurant.name };

  const affiliator = await prisma.affiliator.findUnique({
    where: { id },
    include: {
      restaurant: {
        include: {
          orders: true,
          Voucher: true,
          subscriptions: {
            include: {
              plan: true,
            },
          },
        },
      },
      orders: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          restaurant: true,
        },
        orderBy: { createdAt: "desc" },
      },
      walletTransactions: {
        include: {
          wallet: {
            include: {
              restaurant: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (affiliator)
    return { ...affiliator, userType: "AFFILIATOR", name: affiliator.name };

  const admin = await prisma.admin.findUnique({
    where: { id },
    include: {
      aggregatorAssignments: {
        include: {
          farmer: true,
          approvedProduct: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
      },
      logisticsAssignments: {
        include: {
          restaurant: true,
          orderItems: {
            include: {
              product: true,
            },
          },
          affiliator: true,
        },
        orderBy: { createdAt: "desc" },
      },
      products: {
        include: {
          category: true,
          productUnit: true,
        },
        orderBy: { createdAt: "desc" },
      },
      productCategories: {
        include: {
          products: true,
        },
        orderBy: { createdAt: "desc" },
      },
      productUnits: {
        include: {
          Product: true,
        },
        orderBy: { createdAt: "desc" },
      },
      paymentMethods: {
        orderBy: { createdAt: "desc" },
      },
      approvedLoans: {
        include: {
          restaurant: true,
          farmer: true,
          vouchers: {
            include: {
              transactions: true,
              repayments: true,
            },
          },
          repayments: true,
          manager: true,
        },
        orderBy: { approvedAt: "desc" },
      },
      managedLoans: {
        include: {
          restaurant: true,
          farmer: true,
          vouchers: {
            include: {
              transactions: true,
              repayments: true,
            },
          },
          repayments: true,
          approver: true,
        },
        orderBy: { createdAt: "desc" },
      },
      OrderDelivery: {
        include: {
          order: {
            include: {
              restaurant: true,
              orderItems: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      promoCodes: {
        orderBy: { createdAt: "desc" },
      },
      walletTransactions: {
        include: {
          wallet: {
            include: {
              restaurant: true,
              trader: true,
            },
          },
          restaurant: true,
          affiliator: true,
          trader: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          restaurant: true,
          farmer: true,
          loan: {
            include: {
              restaurant: true,
              farmer: true,
            },
          },
          transactions: {
            include: {
              order: true,
            },
          },
          repayments: true,
          penalties: true,
        },
        orderBy: { createdAt: "desc" },
      },
      traderWallet: {
        include: {
          transactions: {
            include: {
              admin: true,
              restaurant: true,
              affiliator: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      traderTransactions: {
        include: {
          wallet: {
            include: {
              restaurant: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      traderTransactionHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (admin) return { ...admin, userType: "ADMIN", name: admin.username };

  return null;
};

export const getUserByEmail = async (email: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { email },
    include: {
      submissions: {
        include: {
          approvedProduct: true,
          aggregator: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          loan: true,
          transactions: true,
          repayments: true,
          penalties: true,
        },
      },
      LoanApplication: {
        include: {
          vouchers: true,
          repayments: true,
          approver: true,
        },
      },
      RestaurantSubscription: {
        include: {
          plan: true,
          payments: true,
        },
      },
    },
  });
  if (farmer) return { ...farmer, userType: "FARMER" };

  const restaurant = await prisma.restaurant.findUnique({
    where: { email },
    include: {
      orders: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          affiliator: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          loan: true,
          transactions: true,
          repayments: true,
          penalties: true,
          approver: true,
        },
      },
      Wallet: {
        include: {
          transactions: {
            include: {
              admin: true,
              affiliator: true,
              trader: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      subscriptions: {
        include: {
          plan: true,
          payments: true,
          history: true,
        },
        orderBy: { createdAt: "desc" },
      },
      affiliators: {
        include: {
          orders: {
            include: {
              orderItems: true,
            },
          },
          walletTransactions: true,
        },
      },
      walletTransactions: {
        include: {
          admin: true,
          affiliator: true,
          trader: true,
        },
        orderBy: { createdAt: "desc" },
      },
      posts: true,
      LoanApplication: {
        include: {
          vouchers: true,
          repayments: true,
          approver: true,
          manager: true,
        },
      },
      VoucherTransaction: {
        include: {
          voucher: true,
          order: true,
        },
      },
      VoucherRepayment: {
        include: {
          voucher: true,
          loan: true,
        },
      },
      VoucherPenalty: {
        include: {
          voucher: true,
        },
      },
    },
  });
  if (restaurant) return { ...restaurant, userType: "RESTAURANT" };

  const affiliator = await prisma.affiliator.findUnique({
    where: { email },
    include: {
      restaurant: {
        include: {
          orders: true,
          Voucher: true,
          subscriptions: {
            include: {
              plan: true,
            },
          },
        },
      },
      orders: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          restaurant: true,
        },
        orderBy: { createdAt: "desc" },
      },
      walletTransactions: {
        include: {
          wallet: {
            include: {
              restaurant: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (affiliator) return { ...affiliator, userType: "AFFILIATOR" };

  const admin = await prisma.admin.findUnique({
    where: { email },
    include: {
      aggregatorAssignments: {
        include: {
          farmer: true,
          approvedProduct: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
      },
      logisticsAssignments: {
        include: {
          restaurant: true,
          orderItems: {
            include: {
              product: true,
            },
          },
          affiliator: true,
        },
        orderBy: { createdAt: "desc" },
      },
      products: {
        include: {
          category: true,
          productUnit: true,
        },
        orderBy: { createdAt: "desc" },
      },
      productCategories: {
        include: {
          products: true,
        },
        orderBy: { createdAt: "desc" },
      },
      productUnits: {
        include: {
          Product: true,
        },
        orderBy: { createdAt: "desc" },
      },
      paymentMethods: {
        orderBy: { createdAt: "desc" },
      },
      approvedLoans: {
        include: {
          restaurant: true,
          farmer: true,
          vouchers: {
            include: {
              transactions: true,
              repayments: true,
            },
          },
          repayments: true,
          manager: true,
        },
        orderBy: { approvedAt: "desc" },
      },
      managedLoans: {
        include: {
          restaurant: true,
          farmer: true,
          vouchers: {
            include: {
              transactions: true,
              repayments: true,
            },
          },
          repayments: true,
          approver: true,
        },
        orderBy: { createdAt: "desc" },
      },
      OrderDelivery: {
        include: {
          order: {
            include: {
              restaurant: true,
              orderItems: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      promoCodes: {
        orderBy: { createdAt: "desc" },
      },
      walletTransactions: {
        include: {
          wallet: {
            include: {
              restaurant: true,
              trader: true,
            },
          },
          restaurant: true,
          affiliator: true,
          trader: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          restaurant: true,
          farmer: true,
          loan: {
            include: {
              restaurant: true,
              farmer: true,
            },
          },
          transactions: {
            include: {
              order: true,
            },
          },
          repayments: true,
          penalties: true,
        },
        orderBy: { createdAt: "desc" },
      },
      traderWallet: {
        include: {
          transactions: {
            include: {
              admin: true,
              restaurant: true,
              affiliator: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      traderTransactions: {
        include: {
          wallet: {
            include: {
              restaurant: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      traderTransactionHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (admin) return { ...admin, userType: admin.role };

  return null;
};

export const getUserByPhone = async (phone: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { phone },
    include: {
      submissions: {
        include: {
          approvedProduct: true,
          aggregator: true,
          category: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          loan: true,
          transactions: true,
          repayments: true,
          penalties: true,
        },
      },
      LoanApplication: {
        include: {
          vouchers: true,
          repayments: true,
          approver: true,
        },
      },
      RestaurantSubscription: {
        include: {
          plan: true,
          payments: true,
        },
      },
    },
  });
  if (farmer) return { ...farmer, userType: "FARMER" };

  const restaurant = await prisma.restaurant.findUnique({
    where: { phone },
    include: {
      orders: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          affiliator: true,
        },
        orderBy: { createdAt: "desc" },
      },
      Voucher: {
        include: {
          loan: true,
          transactions: true,
          repayments: true,
          penalties: true,
          approver: true,
        },
      },
      Wallet: {
        include: {
          transactions: {
            include: {
              admin: true,
              affiliator: true,
              trader: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      subscriptions: {
        include: {
          plan: true,
          payments: true,
          history: true,
        },
        orderBy: { createdAt: "desc" },
      },
      affiliators: {
        include: {
          orders: {
            include: {
              orderItems: true,
            },
          },
          walletTransactions: true,
        },
      },
      walletTransactions: {
        include: {
          admin: true,
          affiliator: true,
          trader: true,
        },
        orderBy: { createdAt: "desc" },
      },
      posts: true,
      LoanApplication: {
        include: {
          vouchers: true,
          repayments: true,
          approver: true,
          manager: true,
        },
      },
      VoucherTransaction: {
        include: {
          voucher: true,
          order: true,
        },
      },
      VoucherRepayment: {
        include: {
          voucher: true,
          loan: true,
        },
      },
      VoucherPenalty: {
        include: {
          voucher: true,
        },
      },
    },
  });
  if (restaurant) return { ...restaurant, userType: "RESTAURANT" };

  const affiliator = await prisma.affiliator.findUnique({
    where: { phone },
    include: {
      restaurant: {
        include: {
          orders: true,
          Voucher: true,
          subscriptions: {
            include: {
              plan: true,
            },
          },
        },
      },
      orders: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          restaurant: true,
        },
        orderBy: { createdAt: "desc" },
      },
      walletTransactions: {
        include: {
          wallet: {
            include: {
              restaurant: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (affiliator) return { ...affiliator, userType: "AFFILIATOR" };

  return null; // Admin doesn't have phone field
};
