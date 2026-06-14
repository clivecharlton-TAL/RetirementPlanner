export interface BonusTranche {
  amount: number;
  yearsFromNow: number; // vests at currentAge + yearsFromNow
}

export interface Inputs {
  currentAge: number;
  annualIncome: number;
  inflationRate: number;
  // Savings — split by vehicle
  raBalance: number;
  raReturnRate: number;
  unitTrustBalance: number;
  unitTrustReturnRate: number;
  annualSavings: number;
  savingsGrowthRate: number;
  bonusTranches: BonusTranche[];
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
}

declare global {
  interface Window {
    api: {
      loadScenario: () => Promise<ScenarioRow>;
      saveScenario: (name: string, inputsJson: string) => Promise<void>;
    };
  }
}
