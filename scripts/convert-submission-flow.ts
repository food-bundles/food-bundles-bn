/**
 * One-time conversion of farmer submissions to the new stage order
 * (submit → approve → verify → pay). Safe to run more than once.
 *
 *   npx tsx scripts/convert-submission-flow.ts          # preview only
 *   npx tsx scripts/convert-submission-flow.ts --apply  # write the changes
 *
 * Old order was: PENDING → VERIFIED (weighed, offer to farmer) → APPROVED → PAID.
 *   old APPROVED (weighed + approved, not paid)      → VERIFIED (ready to pay)
 *   old VERIFIED + farmer ACCEPTED                   → APPROVED at that price (weigh again to verify)
 *   old VERIFIED + farmer PENDING (offer waiting)    → NEGOTIATING with that offer
 *   old VERIFIED + farmer EXTENDED (farmer countered)→ PENDING with the farmer's price
 *   any unpaid submission the farmer/admin REJECTED  → REJECTED
 * PENDING and PAID stay as they are. Nothing is deleted; every change is
 * written to the submission's status history.
 */
import prisma from "../src/prisma";

const apply = process.argv.includes("--apply");

type Change = { id: string; product: string; from: string; to: string; data: Record<string, unknown> };

async function main() {
  const submissions = await prisma.farmerSubmission.findMany({
    where: { status: { in: ["PENDING", "VERIFIED", "APPROVED"] } },
    select: {
      id: true,
      productName: true,
      status: true,
      farmerFeedbackStatus: true,
      acceptedPrice: true,
      farmerCounterOffer: true,
      approvedAt: true,
      farmerFeedbackNotes: true,
      verifiedAt: true,
    },
  });

  const changes: Change[] = [];
  for (const s of submissions) {
    // Already converted / new-flow rows carry agreedPrice or counterOfferPrice
    if (s.farmerFeedbackStatus === "REJECTED") {
      changes.push({
        id: s.id,
        product: s.productName,
        from: s.status,
        to: "REJECTED",
        data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: s.farmerFeedbackNotes || "Rejected" },
      });
    } else if (s.status === "APPROVED" && s.verifiedAt) {
      // Old approved = already weighed and approved, waiting for payment
      changes.push({
        id: s.id,
        product: s.productName,
        from: "APPROVED",
        to: "VERIFIED",
        data: { status: "VERIFIED", agreedPrice: s.acceptedPrice },
      });
    } else if (s.status === "VERIFIED" && s.farmerFeedbackStatus === "ACCEPTED") {
      changes.push({
        id: s.id,
        product: s.productName,
        from: "VERIFIED",
        to: "APPROVED",
        data: {
          status: "APPROVED",
          agreedPrice: s.acceptedPrice,
          approvedAt: s.approvedAt ?? new Date(),
          acceptedQty: null,
          totalAmount: null,
          verifiedAt: null,
        },
      });
    } else if (s.status === "VERIFIED" && s.farmerFeedbackStatus === "EXTENDED") {
      changes.push({
        id: s.id,
        product: s.productName,
        from: "VERIFIED",
        to: "PENDING",
        data: { status: "PENDING", acceptedQty: null, acceptedPrice: null, totalAmount: null, verifiedAt: null },
      });
    } else if (s.status === "VERIFIED") {
      changes.push({
        id: s.id,
        product: s.productName,
        from: "VERIFIED",
        to: "NEGOTIATING",
        data: {
          status: "NEGOTIATING",
          counterOfferPrice: s.acceptedPrice,
          negotiatedAt: s.verifiedAt ?? new Date(),
          acceptedQty: null,
          totalAmount: null,
          verifiedAt: null,
        },
      });
    }
  }

  console.log(`${submissions.length} unpaid submissions checked, ${changes.length} to convert:`);
  for (const c of changes) console.log(`  ${c.id}  ${c.product.padEnd(20)} ${c.from} → ${c.to}`);

  if (!apply) {
    console.log("\nPreview only. Run again with --apply to write these changes.");
    return;
  }

  for (const c of changes) {
    await prisma.$transaction([
      prisma.farmerSubmission.update({ where: { id: c.id }, data: c.data }),
      prisma.submissionStatusHistory.create({
        data: {
          submissionId: c.id,
          fromStatus: c.from,
          toStatus: c.to,
          reason: "Moved to the new flow (submit → approve → verify → pay)",
          changedBy: "system",
        },
      }),
    ]);
  }
  console.log(`\nConverted ${changes.length} submissions.`);
}

main()
  .catch((error) => {
    console.error("Conversion failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
