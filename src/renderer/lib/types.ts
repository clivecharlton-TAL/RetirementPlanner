export interface ExpenseItem {
  id: string;
  description: string;
  beforeRetirement: number;
  afterRetirement: number;
}

export interface BonusTranche {
  amount: number;
  yearsFromNow: number; // vests at currentAge + yearsFromNow
}

export interface Inputs {
  currentAge: number;
  annualIncome: number;
  inflationRate: number;
  // My savings — split by vehicle
  raBalance: number;
  raReturnRate: number;
  unitTrustBalance: number;
  unitTrustReturnRate: number;
  ukPensionBalance: number;
  ukPensionReturnRate: number;
  tfSavingsBalance: number;
  tfSavingsReturnRate: number;
  annualSavings: number;
  savingsGrowthRate: number;
  bonusTranches: BonusTranche[];
  // Cath's investments
  cathTfSavingsBalance: number;
  cathTfSavingsReturnRate: number;
  cathUnitTrustBalance: number;
  cathUnitTrustReturnRate: number;
  cathRaBalance: number;
  cathRaReturnRate: number;
  cathMtnBalance: number;
  cathMtnReturnRate: number;
  // Rental
  grossRentalIncome: number;
  rentalEscalationRate: number;
  vacancyCostRate: number;
  // Retirement
  retirementAge: number;
  otherPensionIncome: number;
  pensionGrowthRate: number;
  retirementYears: number;
  incomeReplacementRate: number;
  postReturnRate: number;
  // Tax
  marginalTaxRate: number;
  // Uncertainty (± applied to return rates and savings/pension amounts)
  uncertainty: {
    returnRate: number;
    savingsAmount: number;
    savingsGrowth: number;
    pensionAmount: number;
    pensionGrowth: number;
  };
  // Mortgage
  mortgageBalance: number;
  vehicleFinanceBalance: number;
  mortgageInterestRate: number;
}

export interface ProjectionRow {
  age: number;
  balance: number;
  interest: number;
  savingsOrDrawdown: number;
  netRentalIncome: number;
  pensionIncome: number;
  endBalance: number;
  drawdownRate: number | null;
  drawdownCapped: boolean;
  drawdownCapType: 'min' | 'max' | null;
}

export interface ProjectionResult {
  rows: ProjectionRow[];
  rowsLow: ProjectionRow[];
  rowsHigh: ProjectionRow[];
  successAge: number | null;
  failureAge: number | null;
  finalBalance: number;
  raLumpSumTaxPaid: number;
}

export interface ScenarioRow {
  id: number;
  name: string;
  inputs_json: string;
  expenses_json: string;
}

declare global {
  interface Window {
    api: {
      loadScenario: () => Promise<ScenarioRow>;
      saveScenario: (name: string, inputsJson: string, expensesJson: string) => Promise<void>;
      aiHasKey: () => Promise<boolean>;
      aiSaveKey: (key: string) => Promise<void>;
      aiSend: (messages: Array<{ role: string; content: string }>, contextJson: string) => void;
      onAiChunk: (cb: (text: string) => void) => void;
      onAiDone: (cb: () => void) => void;
      offAiListeners: () => void;
    };
  }
}
