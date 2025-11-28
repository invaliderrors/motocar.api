export interface ProviderStats {
  id: string;
  name: string;
  totalVehicles: number;
  activeLoans: number;
  completedLoans: number;
  totalRevenue: number;
  pendingPayments: number;
  totalCashRegisters: number;
  lastCashRegisterDate: Date | null;
  totalExpenses: number;
  vehiclesByStatus: {
    AVAILABLE: number;
    RENTED: number;
    MAINTENANCE: number;
    SOLD: number;
  };
  recentActivity: {
    lastLoan: Date | null;
    lastPayment: Date | null;
    lastExpense: Date | null;
  };
  financialSummary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
}

export interface ProviderDetailsResponse {
  provider: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  };
  stats: ProviderStats;
  recentVehicles: Array<{
    id: string;
    brand: string;
    model: string;
    year: number;
    plate: string;
    status: string;
    purchasePrice: number;
    createdAt: Date;
  }>;
  recentLoans: Array<{
    id: string;
    loanAmount: number;
    status: string;
    startDate: Date;
    vehicle: {
      brand: string;
      model: string;
      plate: string;
    };
    user: {
      name: string;
    };
  }>;
  recentExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    date: Date;
  }>;
}
