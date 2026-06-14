import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { Inputs } from '../renderer/lib/types';

const DEFAULT_INPUTS: Inputs = {
  currentAge: 55,
  annualIncome: 3795000,
  inflationRate: 0.05,
  raBalance: 9000000,
  raReturnRate: 0.08,
  unitTrustBalance: 9101618,
  unitTrustReturnRate: 0.10,
  annualSavings: 360000,
  savingsGrowthRate: 0.05,
  bonusTranches: [],
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
};

interface ScenarioFile {
  id: number;
  name: string;
  inputs: Inputs;
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
}

export function loadScenario(): ScenarioRow {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) {
    const scenario: ScenarioFile = {
      id: 1,
      name: 'My Plan',
      inputs: DEFAULT_INPUTS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2));
    return { id: 1, name: 'My Plan', inputs_json: JSON.stringify(DEFAULT_INPUTS) };
  }
  const data: ScenarioFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { id: data.id, name: data.name, inputs_json: JSON.stringify(data.inputs) };
}

export function saveScenario(name: string, inputsJson: string): void {
  const filePath = getFilePath();
  const existing: ScenarioFile = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : { id: 1, name, inputs: DEFAULT_INPUTS, created_at: new Date().toISOString(), updated_at: '' };

  existing.name = name;
  existing.inputs = JSON.parse(inputsJson);
  existing.updated_at = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}
