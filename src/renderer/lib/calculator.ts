import type { Inputs, ProjectionRow, ProjectionResult } from './types';

const FSCA_MIN = 0.025;
const FSCA_MAX = 0.175;

// SA retirement lump sum tax table (2024/2025)
export function computeRaLumpSumTax(lumpSum: number): number {
  if (lumpSum <= 550_000) return 0;
  if (lumpSum <= 770_000) return (lumpSum - 550_000) * 0.18;
  if (lumpSum <= 1_155_000) return 39_600 + (lumpSum - 770_000) * 0.27;
  return 143_550 + (lumpSum - 1_155_000) * 0.36;
}

interface TrackResult {
  rows: ProjectionRow[];
  raLumpSumTaxPaid: number;
}

function projectTrack(inputs: Inputs, delta: 1 | 0 | -1): TrackResult {
  const u = inputs.uncertainty ?? {};
  const rd = delta * (u.returnRate ?? 0);

  // Effective return rates — uncertainty delta applied uniformly to all funds
  const raRate      = inputs.raReturnRate + rd;
  const utRate      = inputs.unitTrustReturnRate + rd;
  const ukRate      = inputs.ukPensionReturnRate + rd;
  const tfRate      = inputs.tfSavingsReturnRate + rd;
  const cathTfRate  = inputs.cathTfSavingsReturnRate + rd;
  const cathUtRate  = inputs.cathUnitTrustReturnRate + rd;
  const cathRaRate  = inputs.cathRaReturnRate + rd;
  const cathMtnRate = inputs.cathMtnReturnRate + rd;
  const postReturn  = inputs.postReturnRate + rd;

  // Savings / pension adjustments
  let currentSavings    = inputs.annualSavings * (1 + delta * (u.savingsAmount ?? 0));
  const savingsGrowth   = inputs.savingsGrowthRate + delta * (u.savingsGrowth ?? 0);
  let currentPension    = inputs.otherPensionIncome * (1 + delta * (u.pensionAmount ?? 0));
  const pensionGrowth   = inputs.pensionGrowthRate + delta * (u.pensionGrowth ?? 0);

  // Fund balances
  let raBalance     = inputs.raBalance;
  let utBalance     = inputs.unitTrustBalance;
  let ukBalance     = inputs.ukPensionBalance ?? 0;
  let tfBalance     = inputs.tfSavingsBalance ?? 0;
  let cathTfBalance = inputs.cathTfSavingsBalance ?? 0;
  let cathUtBalance = inputs.cathUnitTrustBalance ?? 0;
  let cathRaBalance = inputs.cathRaBalance ?? 0;
  let cathMtnBalance= inputs.cathMtnBalance ?? 0;

  let grossRental = inputs.grossRentalIncome;
  const rows: ProjectionRow[] = [];
  const yearsWorking = inputs.retirementAge - inputs.currentAge;
  const incomeAtRetirement = inputs.annualIncome * Math.pow(1 + inputs.inflationRate, yearsWorking);
  const baseDesiredIncome = incomeAtRetirement * inputs.incomeReplacementRate;

  // Accumulation phase — all funds grow at their own rates
  for (let y = 0; y < yearsWorking; y++) {
    const age = inputs.currentAge + y;

    const trancheInjection = inputs.bonusTranches
      .filter((t) => t.yearsFromNow === y)
      .reduce((sum, t) => sum + t.amount, 0);

    const raInt      = raBalance     * raRate;
    const utInt      = utBalance     * utRate;
    const ukInt      = ukBalance     * ukRate;
    const tfInt      = tfBalance     * tfRate;
    const cathTfInt  = cathTfBalance * cathTfRate;
    const cathUtInt  = cathUtBalance * cathUtRate;
    const cathRaInt  = cathRaBalance * cathRaRate;
    const cathMtnInt = cathMtnBalance* cathMtnRate;

    const totalInterest = raInt + utInt + ukInt + tfInt + cathTfInt + cathUtInt + cathRaInt + cathMtnInt;
    const netRental  = grossRental * (1 - inputs.vacancyCostRate) * (1 - inputs.marginalTaxRate);
    const netTranche = trancheInjection * (1 - inputs.marginalTaxRate);
    const savingsContrib = currentSavings + netTranche;

    const openingBalance = raBalance + utBalance + ukBalance + tfBalance + cathTfBalance + cathUtBalance + cathRaBalance + cathMtnBalance;

    // Contributions flow into unit trusts (most flexible vehicle)
    raBalance     += raInt;
    utBalance     += utInt + savingsContrib + netRental;
    ukBalance     += ukInt;
    tfBalance     += tfInt;
    cathTfBalance += cathTfInt;
    cathUtBalance += cathUtInt;
    cathRaBalance += cathRaInt;
    cathMtnBalance+= cathMtnInt;

    rows.push({
      age,
      balance: openingBalance,
      interest: totalInterest,
      savingsOrDrawdown: savingsContrib,
      netRentalIncome: netRental,
      pensionIncome: 0,
      endBalance: raBalance + utBalance + ukBalance + tfBalance + cathTfBalance + cathUtBalance + cathRaBalance + cathMtnBalance,
      drawdownRate: null,
      drawdownCapped: false,
      drawdownCapType: null,
    });

    grossRental    *= 1 + inputs.rentalEscalationRate;
    currentSavings *= 1 + savingsGrowth;
  }

  // Retirement transition — RA-type funds (Clive RA + Cath RA + Cath MTN) → lump sum tax on 1/3
  const combinedRa = raBalance + cathRaBalance + cathMtnBalance;
  const raLumpSum  = combinedRa / 3;
  const raTaxPaid  = computeRaLumpSumTax(raLumpSum);
  const netCombinedRa = combinedRa - raTaxPaid;

  // Non-RA funds transfer directly (Tax Free Savings, Unit Trusts, UK Pension)
  const directFunds = utBalance + ukBalance + tfBalance + cathTfBalance + cathUtBalance;

  let balance = netCombinedRa + directFunds;
  let currentDesiredIncome = baseDesiredIncome;

  // Drawdown phase
  for (let y = 0; y < inputs.retirementYears; y++) {
    const age = inputs.retirementAge + y;
    const netRental = grossRental * (1 - inputs.vacancyCostRate) * (1 - inputs.marginalTaxRate);
    const interest  = balance * postReturn;

    const rawDrawdownRate = balance > 0 ? currentDesiredIncome / balance : FSCA_MAX;
    let actualDesiredIncome = currentDesiredIncome;
    let drawdownCapped = false;
    let drawdownCapType: 'min' | 'max' | null = null;

    if (rawDrawdownRate < FSCA_MIN) {
      actualDesiredIncome = balance * FSCA_MIN;
      drawdownCapped = true;
      drawdownCapType = 'min';
    } else if (rawDrawdownRate > FSCA_MAX) {
      actualDesiredIncome = balance * FSCA_MAX;
      drawdownCapped = true;
      drawdownCapType = 'max';
    }

    const portfolioDrawdown = Math.max(0, actualDesiredIncome - netRental - currentPension);
    const endBalance = balance + interest - portfolioDrawdown;
    const drawdownRate = balance > 0 ? actualDesiredIncome / balance : FSCA_MAX;

    rows.push({
      age,
      balance,
      interest,
      savingsOrDrawdown: -portfolioDrawdown,
      netRentalIncome: netRental,
      pensionIncome: currentPension,
      endBalance: Math.max(0, endBalance),
      drawdownRate,
      drawdownCapped,
      drawdownCapType,
    });

    if (endBalance <= 0) break;

    balance              = endBalance;
    grossRental          *= 1 + inputs.rentalEscalationRate;
    currentPension       *= 1 + pensionGrowth;
    currentDesiredIncome *= 1 + inputs.inflationRate;
  }

  return { rows, raLumpSumTaxPaid: raTaxPaid };
}

export function calculate(inputs: Inputs): ProjectionResult {
  const base = projectTrack(inputs, 0);
  const low  = projectTrack(inputs, -1);
  const high = projectTrack(inputs, 1);

  const rows = base.rows;
  const lastRow = rows[rows.length - 1];
  const finalBalance = lastRow.endBalance;

  const failureRow = rows.find((r) => r.drawdownRate !== null && r.endBalance <= 0);
  const failureAge = failureRow?.age ?? null;
  const lastAge    = lastRow.age;
  const successAge = failureAge === null && finalBalance > 0 ? lastAge : null;

  return {
    rows,
    rowsLow:  low.rows,
    rowsHigh: high.rows,
    successAge,
    failureAge,
    finalBalance,
    raLumpSumTaxPaid: base.raLumpSumTaxPaid,
  };
}
