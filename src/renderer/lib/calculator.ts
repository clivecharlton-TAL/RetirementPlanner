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

interface TrackInputs {
  raReturnRate: number;
  unitTrustReturnRate: number;
  postReturnDelta: number;
  annualSavings: number;
  savingsGrowthRate: number;
  pensionIncome: number;
  pensionGrowthRate: number;
}

const ZERO_UNCERTAINTY = {
  returnRate: 0,
  savingsAmount: 0,
  savingsGrowth: 0,
  pensionAmount: 0,
  pensionGrowth: 0,
};

function buildTrackInputs(inputs: Inputs, delta: 1 | 0 | -1): TrackInputs {
  const u = inputs.uncertainty ?? ZERO_UNCERTAINTY;
  const rd = delta * (u.returnRate ?? 0);
  return {
    raReturnRate:        inputs.raReturnRate + rd,
    unitTrustReturnRate: inputs.unitTrustReturnRate + rd,
    postReturnDelta:     rd,
    annualSavings:       inputs.annualSavings * (1 + delta * (u.savingsAmount ?? 0)),
    savingsGrowthRate:   inputs.savingsGrowthRate + delta * (u.savingsGrowth ?? 0),
    pensionIncome:       inputs.otherPensionIncome * (1 + delta * (u.pensionAmount ?? 0)),
    pensionGrowthRate:   inputs.pensionGrowthRate + delta * (u.pensionGrowth ?? 0),
  };
}

interface TrackResult {
  rows: ProjectionRow[];
  raLumpSumTaxPaid: number;
}

function projectTrack(inputs: Inputs, track: TrackInputs): TrackResult {
  const rows: ProjectionRow[] = [];
  const yearsWorking = inputs.retirementAge - inputs.currentAge;
  const incomeAtRetirement =
    inputs.annualIncome * Math.pow(1 + inputs.inflationRate, yearsWorking);
  const baseDesiredIncome = incomeAtRetirement * inputs.incomeReplacementRate;

  let raBalance = inputs.raBalance;
  let utBalance = inputs.unitTrustBalance;
  let grossRental = inputs.grossRentalIncome;
  let currentSavings = track.annualSavings;
  let currentPension = track.pensionIncome;

  // Accumulation phase — RA and unit trusts grow at separate rates
  for (let y = 0; y < yearsWorking; y++) {
    const age = inputs.currentAge + y;

    // Bonus tranches vesting this year (years-from-now maps to loop index y)
    const trancheInjection = inputs.bonusTranches
      .filter((t) => t.yearsFromNow === y)
      .reduce((sum, t) => sum + t.amount, 0);

    const raInterest = raBalance * track.raReturnRate;
    const utInterest = utBalance * track.unitTrustReturnRate;
    const netRental = grossRental * (1 - inputs.vacancyCostRate) * (1 - inputs.marginalTaxRate);
    const netTranche = trancheInjection * (1 - inputs.marginalTaxRate);
    const savingsContrib = currentSavings + netTranche;  // rental shown separately

    const endRa = raBalance + raInterest;
    const endUt = utBalance + utInterest + savingsContrib + netRental;

    rows.push({
      age,
      balance: raBalance + utBalance,
      interest: raInterest + utInterest,
      savingsOrDrawdown: savingsContrib,
      netRentalIncome: netRental,
      pensionIncome: 0,
      endBalance: endRa + endUt,
      drawdownRate: null,
      drawdownCapped: false,
      drawdownCapType: null,
    });

    raBalance = endRa;
    utBalance = endUt;
    grossRental *= 1 + inputs.rentalEscalationRate;
    currentSavings *= 1 + track.savingsGrowthRate;
  }

  // RA lump sum at retirement: 1/3 taken as cash (taxed), 2/3 converts to living annuity
  const raLumpSum = raBalance / 3;
  const raTaxPaid = computeRaLumpSumTax(raLumpSum);
  const netRA = raBalance - raTaxPaid;

  // Drawdown phase — single merged portfolio balance
  const postReturn = inputs.postReturnRate + track.postReturnDelta;
  let balance = netRA + utBalance;
  let currentDesiredIncome = baseDesiredIncome;

  for (let y = 0; y < inputs.retirementYears; y++) {
    const age = inputs.retirementAge + y;
    const netRental = grossRental * (1 - inputs.vacancyCostRate) * (1 - inputs.marginalTaxRate);
    const interest = balance * postReturn;

    // FSCA rate = total desired income / portfolio balance (matches spreadsheet)
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

    balance = endBalance;
    grossRental *= 1 + inputs.rentalEscalationRate;
    currentPension *= 1 + track.pensionGrowthRate;
    currentDesiredIncome *= 1 + inputs.inflationRate;
  }

  return { rows, raLumpSumTaxPaid: raTaxPaid };
}

export function calculate(inputs: Inputs): ProjectionResult {
  const base = projectTrack(inputs, buildTrackInputs(inputs, 0));
  const low = projectTrack(inputs, buildTrackInputs(inputs, -1));
  const high = projectTrack(inputs, buildTrackInputs(inputs, 1));

  const rows = base.rows;
  const lastRow = rows[rows.length - 1];
  const finalBalance = lastRow.endBalance;

  const failureRow = rows.find((r) => r.drawdownRate !== null && r.endBalance <= 0);
  const failureAge = failureRow?.age ?? null;
  const lastAge = lastRow.age;
  const successAge = failureAge === null && finalBalance > 0 ? lastAge : null;

  return {
    rows,
    rowsLow: low.rows,
    rowsHigh: high.rows,
    successAge,
    failureAge,
    finalBalance,
    raLumpSumTaxPaid: base.raLumpSumTaxPaid,
  };
}
