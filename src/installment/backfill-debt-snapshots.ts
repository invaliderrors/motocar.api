import { PrismaClient } from '../prisma/generated/client';
import { startOfDay } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Backfill debt snapshot values for existing installments
 * This script calculates and stores the exactInstallmentsOwed and remainingAmountOwed
 * for installments that were created before these fields were added.
 */
async function backfillDebtSnapshots() {
  console.log('Starting backfill of debt snapshots...');
  
  // Get all installments that don't have debt snapshot values
  const installments = await prisma.installment.findMany({
    where: {
      OR: [
        { exactInstallmentsOwed: null },
        { remainingAmountOwed: null },
      ],
    },
    include: {
      loan: true,
    },
    orderBy: [
      { loanId: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  console.log(`Found ${installments.length} installments to backfill`);

  // Group by loan
  const installmentsByLoan = new Map<string, typeof installments>();
  for (const installment of installments) {
    if (!installmentsByLoan.has(installment.loanId)) {
      installmentsByLoan.set(installment.loanId, []);
    }
    installmentsByLoan.get(installment.loanId)!.push(installment);
  }

  let updated = 0;

  // Process each loan's installments
  for (const [loanId, loanInstallments] of installmentsByLoan) {
    const loan = loanInstallments[0].loan;
    const baseDailyRate = loan.installmentPaymentAmmount || 0;
    const gpsDailyRate = loan.gpsInstallmentPayment || 0;
    const totalDailyRate = baseDailyRate + gpsDailyRate;
    const downPayment = loan.downPayment || 0;

    console.log(`\nProcessing loan ${loanId} with ${loanInstallments.length} installments`);

    // Calculate debt snapshot for each installment in order
    for (let i = 0; i < loanInstallments.length; i++) {
      const installment = loanInstallments[i];
      
      // Get all payments BEFORE this one (older createdAt)
      const previousPayments = loanInstallments.slice(0, i);
      
      // Calculate total days covered before this payment
      let totalDaysCoveredBefore = downPayment > 0 && totalDailyRate > 0 
        ? downPayment / totalDailyRate 
        : 0;
      
      for (const prevPayment of previousPayments) {
        const totalPayment = (prevPayment.amount || 0) + (prevPayment.gps || 0);
        totalDaysCoveredBefore += totalPayment / totalDailyRate;
      }
      
      // Calculate days that should have been paid by the payment date
      const loanStartDate = startOfDay(new Date(loan.startDate));
      const paymentDate = startOfDay(new Date(installment.paymentDate));
      
      // Simple calculation: days from start to payment date
      const diffTime = paymentDate.getTime() - loanStartDate.getTime();
      const daysSinceStart = diffTime / (1000 * 60 * 60 * 24);
      
      // Calculate debt before this payment
      const exactInstallmentsOwed = Math.max(0, daysSinceStart - totalDaysCoveredBefore);
      const remainingAmountOwed = exactInstallmentsOwed * totalDailyRate;
      
      // Update the installment
      await prisma.installment.update({
        where: { id: installment.id },
        data: {
          exactInstallmentsOwed: exactInstallmentsOwed,
          remainingAmountOwed: remainingAmountOwed,
        },
      });
      
      updated++;
      console.log(`  Updated installment ${installment.id}: ${exactInstallmentsOwed.toFixed(2)} installments owed, $${remainingAmountOwed.toFixed(2)}`);
    }
  }

  console.log(`\n✅ Backfill complete! Updated ${updated} installments`);
}

backfillDebtSnapshots()
  .catch((error) => {
    console.error('Error during backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
