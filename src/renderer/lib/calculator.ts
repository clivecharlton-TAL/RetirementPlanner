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
  cathRaLumpSumTaxPaid: number;
  cathCrystallisedAtCliveAge: number | null;
}

function projectTrack(inputs: Inputs, delta: 1 | 0 | -1, monthlyBaseExpenses: number): TrackResult {
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

  // SA law: Cath's RA-type funds (cathRa + cathMtn) can't be drawn before 60.
  // Crystallise them at max(cathRetirementAge, 60) if that falls before Clive retires.
  const cathCurrentAge    = inputs.cathCurrentAge ?? inputs.currentAge;
  const cathRetirementAge = inputs.cathRetirementAge ?? inputs.retirementAge;
  const cathDrawdownAge   = Math.max(cathRetirementAge, 60);
  let cathCrystallised    = false;
  let cathRaLumpSumTaxPaidLocal   = 0;
  let cathCrystallisedAtCliveAge: number | null = null;
  const incomeAtRetirement = inputs.annualIncome * Math.pow(1 + inputs.inflationRate, yearsWorking);
  const baseDesiredIncome = incomeAtRetirement * inputs.incomeReplacementRate;

  // Accumulation phase — all funds grow at their own rates
  for (let y = 0; y < yearsWorking; y++) {
    const age = inputs.currentAge + y;

    const trancheInjection = inputs.bonusTranches
      .filter((t) => t.yearsFromNow === y)
      .reduce((sum, t) => sum + t.amount, 0);

    // Crystallise Cath's RA-type funds when she reaches her drawdown eligibility age
    if (!cathCrystallised && cathCurrentAge + y >= cathDrawdownAge) {
      const cathLump = (cathRaBalance + cathMtnBalance) / 3;
      const cathTax  = computeRaLumpSumTax(cathLump);
      cathRaLumpSumTaxPaidLocal   = cathTax;
      cathCrystallisedAtCliveAge  = age;
      cathUtBalance += cathRaBalance + cathMtnBalance - cathTax;
      cathRaBalance  = 0;
      cathMtnBalance = 0;
      cathCrystallised = true;
    }

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

    const excluded = (inputs.variableBonusExclusions ?? []).includes(y);
    const variableGross = inputs.variableBonusEnabled && !excluded
      ? inputs.annualIncome * Math.pow(1 + inputs.inflationRate, y) * inputs.variableBonusRate
      : 0;
    const variableNet = variableGross * (1 - inputs.marginalTaxRate);

    // Monthly contributions compound within the year — use FV of ordinary annuity.
    // Tranches and bonuses are lump-sum events, so they stay as year-end additions.
    const utMonthlyRate = utRate / 12;
    const fvMonthlySavings = utMonthlyRate > 0
      ? (currentSavings / 12) * (Math.pow(1 + utMonthlyRate, 12) - 1) / utMonthlyRate
      : currentSavings;
    const savingsContrib = fvMonthlySavings + netTranche + variableNet;

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
      availableToInvest: 0,
      cumulativeReinvestment: 0,
      fundEndBalances: {
        ra: raBalance, ut: utBalance, ukPension: ukBalance,
        tfSavings: tfBalance, cathTf: cathTfBalance, cathUt: cathUtBalance,
        cathRa: cathRaBalance, cathMtn: cathMtnBalance,
      },
    });

    grossRental    *= 1 + inputs.rentalEscalationRate;
    currentSavings *= 1 + savingsGrowth;
  }

  // Retirement transition — RA-type funds → lump sum tax on 1/3.
  // If Cath already crystallised mid-accumulation her balances are 0; otherwise combine with Clive's.
  const combinedRa    = raBalance + cathRaBalance + cathMtnBalance;
  const raLumpSum     = combinedRa / 3;
  const raTaxPaid     = computeRaLumpSumTax(raLumpSum);
  const netCombinedRa = combinedRa - raTaxPaid;

  // Non-RA funds transfer directly (Tax Free Savings, Unit Trusts, UK Pension)
  const directFunds = utBalance + ukBalance + tfBalance + cathTfBalance + cathUtBalance;

  let balance = netCombinedRa + directFunds;
  let currentDesiredIncome = baseDesiredIncome;
  let reinvestBalance = 0;
  const reinvestRate = inputs.surplusReinvestmentRate ?? 0;

  // Drawdown phase
  for (let y = 0; y < inputs.retirementYears; y++) {
    const age = inputs.retirementAge + y;
    const netRental = grossRental * (1 - inputs.vacancyCostRate) * (1 - inputs.marginalTaxRate);
    const interest  = balance * postReturn;

    // FSCA drawdown rate = what is drawn FROM the annuity / annuity value.
    // Pension and rental are external income — they reduce the portfolio draw but
    // are not drawn from the living annuity, so they must not inflate the rate.
    const uncappedDraw = Math.max(0, currentDesiredIncome - netRental - currentPension);
    const rawDrawdownRate = balance > 0 ? uncappedDraw / balance : FSCA_MAX;

    let portfolioDrawdown = uncappedDraw;
    let drawdownCapped = false;
    let drawdownCapType: 'min' | 'max' | null = null;

    if (rawDrawdownRate < FSCA_MIN) {
      portfolioDrawdown = balance * FSCA_MIN;
      drawdownCapped = true;
      drawdownCapType = 'min';
    } else if (rawDrawdownRate > FSCA_MAX) {
      portfolioDrawdown = balance * FSCA_MAX;
      drawdownCapped = true;
      drawdownCapType = 'max';
    }

    const endBalance = balance + interest - portfolioDrawdown;
    const drawdownRate = balance > 0 ? portfolioDrawdown / balance : FSCA_MAX;

    // Surplus reinvestment: post-tax income minus inflated expenses, reinvested into UT side-pot
    // netRental is already post-tax; portfolio drawdown and pension are taxable at marginal rate
    const annualIncomePostTax = portfolioDrawdown * (1 - inputs.marginalTaxRate) + netRental + currentPension * (1 - inputs.marginalTaxRate);
    const annualExpenses = monthlyBaseExpenses * 12 * Math.pow(1 + inputs.inflationRate, y);
    const annualSurplus = Math.max(0, annualIncomePostTax - annualExpenses);
    const reinvestAmount = annualSurplus * reinvestRate;
    reinvestBalance = reinvestBalance * (1 + utRate) + reinvestAmount;

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
      availableToInvest: annualSurplus * reinvestRate / 12,
      cumulativeReinvestment: reinvestBalance,
    });

    if (endBalance <= 0) break;

    balance              = endBalance;
    grossRental          *= 1 + inputs.rentalEscalationRate;
    currentPension       *= 1 + pensionGrowth;
    currentDesiredIncome *= 1 + inputs.inflationRate;
  }

  return { rows, raLumpSumTaxPaid: raTaxPaid, cathRaLumpSumTaxPaid: cathRaLumpSumTaxPaidLocal, cathCrystallisedAtCliveAge };
}

export function calculate(inputs: Inputs, monthlyBaseExpenses = 0): ProjectionResult {
  const base = projectTrack(inputs, 0, monthlyBaseExpenses);
  const low  = projectTrack(inputs, -1, monthlyBaseExpenses);
  const high = projectTrack(inputs, 1, monthlyBaseExpenses);

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
    raLumpSumTaxPaid:          base.raLumpSumTaxPaid,
    cathRaLumpSumTaxPaid:      base.cathRaLumpSumTaxPaid,
    cathCrystallisedAtCliveAge: base.cathCrystallisedAtCliveAge,
  };
}
