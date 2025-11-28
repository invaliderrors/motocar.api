interface ResumenResponse {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  paymentMethods: {
    cash: number;
    transfer: number;
    card: number;
    other: number;
  };
  expenseMethods: Record<string, number>;
  categories: {
    loanPayments: number;
    otherIncome: number;
    expenses: Record<string, number>;
  };
  previousDayComparison: number;
  allTodayInstallments: Installment[];
  allTodayExpenses: Expense[];
}

interface Installment {
  id: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;

}

interface Expense {
  id: string;
  amount: number;
  date: Date;
  category: string;
  paymentMethod: string;

}
