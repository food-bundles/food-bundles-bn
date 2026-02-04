// Admin approve loan on behalf of trader
export const adminApproveLoanOnBehalfUpdated = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { traderId } = req.params;
    const { loanId, approvedAmount, repaymentDays } = req.body;

    if (!loanId || !approvedAmount || !repaymentDays) {
      return res.status(400).json({
        success: false,
        message: "loanId, approvedAmount, and repaymentDays are required",
      });
    }

    const result = await adminApproveLoanOnBehalfService(
      adminId,
      traderId,
      loanId,
      parseFloat(approvedAmount),
      parseInt(repaymentDays),
    );

    res.status(200).json({
      success: true,
      message: "Loan approved successfully on behalf of trader",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};