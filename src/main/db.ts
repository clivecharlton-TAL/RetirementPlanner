import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { Inputs, ExpenseItem } from '../renderer/lib/types';

const DEFAULT_INPUTS: Inputs = {
  currentAge: 55,
  annualIncome: 3795000,
  inflationRate: 0.05,
  raBalance: 9000000,
  raReturnRate: 0.08,
  unitTrustBalance: 9101618,
  unitTrustReturnRate: 0.10,
  ukPensionBalance: 0,
  ukPensionReturnRate: 0.07,
  tfSavingsBalance: 0,
  tfSavingsReturnRate: 0.10,
  annualSavings: 360000,
  savingsGrowthRate: 0.05,
  bonusTranches: [],
  cathTfSavingsBalance: 0,
  cathTfSavingsReturnRate: 0.10,
  cathUnitTrustBalance: 0,
  cathUnitTrustReturnRate: 0.10,
  cathRaBalance: 0,
  cathRaReturnRate: 0.08,
  cathMtnBalance: 0,
  cathMtnReturnRate: 0.08,
  grossRentalIncome: 0,
  rentalEscalationRate: 0.06,
  vacancyCostRate: 0.15,
  retirementAge: 65,
  otherPensionIncome: 50000,
  pensionGrowthRate: 0.05,
  retirementYears: 30,
  incomeReplacementRate: 0.5,
  postReturnRate: 0.08,
  marginalTaxRate: 0.36,
  uncertainty: {
    returnRate: 0.01,
    savingsAmount: 0.01,
    savingsGrowth: 0.01,
    pensionAmount: 0.01,
    pensionGrowth: 0.01,
  },
  mortgageBalance: 0,
  vehicleFinanceBalance: 0,
  mortgageInterestRate: 0.115,
};

const DEFAULT_EXPENSES: ExpenseItem[] = [
  { id: 'e1',  description: 'Investec Loan Facility',                  beforeRetirement: 41500, afterRetirement: 0 },
  { id: 'e2',  description: 'Lower Wrensch Road Rent (After Tax)',      beforeRetirement: -25000, afterRetirement: -25000 },
  { id: 'e3',  description: 'Cath Insurance (Car + Household)',         beforeRetirement: 1700,  afterRetirement: 1700 },
  { id: 'e4',  description: 'Tax Free Savings Account',                 beforeRetirement: 3150,  afterRetirement: 0 },
  { id: 'e5',  description: 'Alan Gray (Private RA)',                   beforeRetirement: 30000, afterRetirement: 0 },
  { id: 'e6',  description: 'Alan Gray (Unit Trusts)',                  beforeRetirement: 20000, afterRetirement: 0 },
  { id: 'e7',  description: 'Pool Maintenance',                         beforeRetirement: 600,   afterRetirement: 600 },
  { id: 'e8',  description: 'Ronald',                                   beforeRetirement: 1500,  afterRetirement: 1500 },
  { id: 'e9',  description: 'Council Tax (Lower Wrensch)',              beforeRetirement: 5000,  afterRetirement: 5000 },
  { id: 'e10', description: 'Council Tax (Seagull)',                    beforeRetirement: 3500,  afterRetirement: 3500 },
  { id: 'e11', description: 'Internet (Lower Wrensch)',                 beforeRetirement: 1300,  afterRetirement: 1300 },
  { id: 'e12', description: 'Internet (Seagull)',                       beforeRetirement: 1300,  afterRetirement: 1300 },
  { id: 'e13', description: 'Electricity (Seagull)',                    beforeRetirement: 1500,  afterRetirement: 1500 },
  { id: 'e14', description: 'Petrol (Cath)',                            beforeRetirement: 1500,  afterRetirement: 1500 },
  { id: 'e15', description: 'Petrol (Clive)',                           beforeRetirement: 8000,  afterRetirement: 8000 },
  { id: 'e16', description: 'Food',                                     beforeRetirement: 40000, afterRetirement: 40000 },
  { id: 'e17', description: 'Entertainment',                            beforeRetirement: 6000,  afterRetirement: 6000 },
  { id: 'e18', description: 'Clothing',                                 beforeRetirement: 10000, afterRetirement: 10000 },
  { id: 'e19', description: 'Clive Work Lunches',                       beforeRetirement: 6300,  afterRetirement: 0 },
  { id: 'e20', description: 'Netflix & Subscriptions',                  beforeRetirement: 4000,  afterRetirement: 4000 },
  { id: 'e21', description: 'Gym',                                      beforeRetirement: 1400,  afterRetirement: 1400 },
  { id: 'e22', description: 'GoSolr',                                   beforeRetirement: 1700,  afterRetirement: 1700 },
  { id: 'e23', description: 'MiWay Insurance',                         beforeRetirement: 2400,  afterRetirement: 2400 },
  { id: 'e24', description: 'Girls Allowance',                          beforeRetirement: 9600,  afterRetirement: 0 },
  { id: 'e25', description: 'Medical Aid (CAMAF)',                      beforeRetirement: 15000, afterRetirement: 15000 },
  { id: 'e26', description: 'Holidays (Amortised)',                     beforeRetirement: 3000,  afterRetirement: 3000 },
  { id: 'e27', description: 'Ironman Race Entries (Amortised)',         beforeRetirement: 2000,  afterRetirement: 2000 },
  { id: 'e28', description: 'Cell Phone Bills',                         beforeRetirement: 3000,  afterRetirement: 3000 },
];

interface ScenarioFile {
  id: number;
  name: string;
  inputs: Inputs;
  expenses: ExpenseItem[];
  created_at: string;
  updated_at: string;
}

function getFilePath(): string {
  return path.join(app.getPath('userData'), 'scenario.json');
}

export interface ScenarioRow {
  id: number;
  name: string;
  inputs_json: string;
  expenses_json: string;
}

export function loadScenario(): ScenarioRow {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) {
    const scenario: ScenarioFile = {
      id: 1,
      name: 'My Plan',
      inputs: DEFAULT_INPUTS,
      expenses: DEFAULT_EXPENSES,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2));
    return { id: 1, name: 'My Plan', inputs_json: JSON.stringify(DEFAULT_INPUTS), expenses_json: JSON.stringify(DEFAULT_EXPENSES) };
  }
  const data: ScenarioFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const expenses = Array.isArray(data.expenses) ? data.expenses : DEFAULT_EXPENSES;
  return { id: data.id, name: data.name, inputs_json: JSON.stringify(data.inputs), expenses_json: JSON.stringify(expenses) };
}

export function saveScenario(name: string, inputsJson: string, expensesJson: string): void {
  const filePath = getFilePath();
  const existing: ScenarioFile = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : { id: 1, name, inputs: DEFAULT_INPUTS, expenses: DEFAULT_EXPENSES, created_at: new Date().toISOString(), updated_at: '' };

  existing.name = name;
  existing.inputs = JSON.parse(inputsJson);
  existing.expenses = JSON.parse(expensesJson);
  existing.updated_at = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}
