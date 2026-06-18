import { describe, it, expect } from 'vitest';
import { calculate, computeRaLumpSumTax } from './calculator';
import type { Inputs } from './types';

// Base fixture — dual rates equal to the old uniform 8% so accumulation
// totals remain comparable to the original spreadsheet.
const BASE: Inputs = {
  currentAge: 55,
  annualIncome: 3_795_000,
  inflationRate: 0.05,
  raBalance: 9_000_000,
  raReturnRate: 0.08,
  unitTrustBalance: 9_101_618,
  unitTrustReturnRate: 0.08,
  ukPensionBalance: 0,
  ukPensionReturnRate: 0.07,
  tfSavingsBalance: 0,
  tfSavingsReturnRate: 0.10,
  annualSavings: 360_000,
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
  otherPensionIncome: 50_000,
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
  surplusReinvestmentRate: 0,
  variableBonusEnabled: false,
  variableBonusRate: 0.5,
};

// ─── SA lump sum tax table — unit tests ──────────────────────────────────────

describe('computeRaLumpSumTax — SA retirement lump sum tax brackets', () => {
  it('R0 — below first bracket: 0% tax', () => {
    expect(computeRaLumpSumTax(0)).toBe(0);
  });

  it('R550,000 — at bracket 1 ceiling: 0% tax', () => {
    expect(computeRaLumpSumTax(550_000)).toBe(0);
  });

  it('R660,000 — in bracket 2 (18%): tax on R110K above threshold', () => {
    // (660,000 - 550,000) × 0.18 = 19,800
    expect(computeRaLumpSumTax(660_000)).toBeCloseTo(19_800, 0);
  });

  it('R770,000 — bracket 2 ceiling: R220K × 18% = R39,600', () => {
    expect(computeRaLumpSumTax(770_000)).toBeCloseTo(39_600, 0);
  });

  it('R1,000,000 — in bracket 3 (27%)', () => {
    // 39,600 + (1,000,000 - 770,000) × 0.27 = 39,600 + 62,100 = 101,700
    expect(computeRaLumpSumTax(1_000_000)).toBeCloseTo(101_700, 0);
  });

  it('R1,155,000 — bracket 3 ceiling: R143,550', () => {
    expect(computeRaLumpSumTax(1_155_000)).toBeCloseTo(143_550, 0);
  });

  it('R2,000,000 — in bracket 4 (36%)', () => {
    // 143,550 + (2,000,000 - 1,155,000) × 0.36 = 143,550 + 304,200 = 447,750
    expect(computeRaLumpSumTax(2_000_000)).toBeCloseTo(447_750, 0);
  });
});

// ─── Accumulation phase ───────────────────────────────────────────────────────

describe('accumulation phase', () => {
  it('age 55: combined opening balance = raBalance + unitTrustBalance', () => {
    const { rows } = calculate(BASE);
    const row = rows.find((r) => r.age === 55)!;
    expect(row.balance).toBeCloseTo(BASE.raBalance + BASE.unitTrustBalance, 0);
    expect(row.drawdownRate).toBeNull();
  });

  it('age 55: interest = 8% on combined R18.1M', () => {
    const { rows } = calculate(BASE);
    const row = rows.find((r) => r.age === 55)!;
    const expectedInterest = (BASE.raBalance + BASE.unitTrustBalance) * 0.08;
    expect(row.interest).toBeCloseTo(expectedInterest, 0);
  });

  it('age 55: savings contribution = R360,000', () => {
    const { rows } = calculate(BASE);
    expect(rows.find((r) => r.age === 55)!.savingsOrDrawdown).toBeCloseTo(360_000, 0);
  });

  it('age 64: end balance is the opening retirement portfolio (before RA tax)', () => {
    const { rows } = calculate(BASE);
    const row = rows.find((r) => r.age === 64)!;
    // savings = 360,000 × 1.05^9 = 558,478.16
    expect(row.savingsOrDrawdown).toBeCloseTo(558_478.16, 0);
    expect(row.endBalance).toBeGreaterThan(40_000_000);
    expect(row.drawdownRate).toBeNull();
  });

  it('all accumulation rows have null drawdownRate', () => {
    const { rows } = calculate(BASE);
    expect(rows.filter((r) => r.age < 65).every((r) => r.drawdownRate === null)).toBe(true);
  });
});

// ─── RA lump sum tax integration ─────────────────────────────────────────────

describe('RA lump sum tax at retirement', () => {
  it('raLumpSumTaxPaid is positive when raBalance > 0', () => {
    const result = calculate(BASE);
    expect(result.raLumpSumTaxPaid).toBeGreaterThan(0);
  });

  it('raLumpSumTaxPaid = 0 when raBalance = 0', () => {
    const result = calculate({ ...BASE, raBalance: 0 });
    expect(result.raLumpSumTaxPaid).toBe(0);
  });

  it('higher raBalance produces proportionally higher lump sum tax', () => {
    const low = calculate({ ...BASE, raBalance: 3_000_000 });
    const high = calculate({ ...BASE, raBalance: 30_000_000 });
    expect(high.raLumpSumTaxPaid).toBeGreaterThan(low.raLumpSumTaxPaid);
  });

  it('portfolio at age 65 is net of RA tax (lower than if no RA tax)', () => {
    const withTax = calculate(BASE);
    const noRa = calculate({ ...BASE, raBalance: 0, unitTrustBalance: BASE.raBalance + BASE.unitTrustBalance });
    const withTaxRow = withTax.rows.find((r) => r.age === 65)!;
    const noRaRow = noRa.rows.find((r) => r.age === 65)!;
    // no-RA scenario has full balance, with-RA has tax deducted
    expect(withTaxRow.balance).toBeLessThan(noRaRow.balance);
  });
});

// ─── Bonus tranches ───────────────────────────────────────────────────────────

describe('bonus tranches', () => {
  it('tranche at yearsFromNow=2 adds net-of-tax to savings in the year y=2 (age 57)', () => {
    const withTranche = calculate({ ...BASE, bonusTranches: [{ amount: 500_000, yearsFromNow: 2 }] });
    const withoutTranche = calculate(BASE);
    const withRow = withTranche.rows.find((r) => r.age === 57)!;
    const withoutRow = withoutTranche.rows.find((r) => r.age === 57)!;
    // Net tranche = 500,000 × (1 − 0.36) = 320,000
    expect(withRow.savingsOrDrawdown).toBeCloseTo(withoutRow.savingsOrDrawdown + 320_000, 0);
  });

  it('tranche carrying forward: end balance at age 58 is higher when tranche was added at 57', () => {
    const withTranche = calculate({ ...BASE, bonusTranches: [{ amount: 500_000, yearsFromNow: 2 }] });
    const withoutTranche = calculate(BASE);
    const withEnd = withTranche.rows.find((r) => r.age === 58)!.endBalance;
    const withoutEnd = withoutTranche.rows.find((r) => r.age === 58)!.endBalance;
    expect(withEnd).toBeGreaterThan(withoutEnd);
  });

  it('multiple tranches in the same year sum correctly (net of tax)', () => {
    const result = calculate({ ...BASE, bonusTranches: [{ amount: 200_000, yearsFromNow: 1 }, { amount: 300_000, yearsFromNow: 1 }] });
    const base = calculate(BASE);
    const rRow = result.rows.find((r) => r.age === 56)!;
    const bRow = base.rows.find((r) => r.age === 56)!;
    // Net tranche = 500,000 × (1 − 0.36) = 320,000
    expect(rRow.savingsOrDrawdown).toBeCloseTo(bRow.savingsOrDrawdown + 320_000, 0);
  });

  it('tranche with yearsFromNow >= yearsWorking (after retirement age) is ignored', () => {
    const yearsWorking = BASE.retirementAge - BASE.currentAge; // 10
    const result = calculate({ ...BASE, bonusTranches: [{ amount: 1_000_000, yearsFromNow: yearsWorking }] });
    const base = calculate(BASE);
    // The total accumulation balance at retirement should be identical (tranche never applied)
    const retRow = result.rows.find((r) => r.age === BASE.retirementAge)!;
    const baseRetRow = base.rows.find((r) => r.age === BASE.retirementAge)!;
    expect(retRow.balance).toBeCloseTo(baseRetRow.balance, 0);
  });

  it('empty bonusTranches array produces same result as no tranches', () => {
    const withEmpty = calculate({ ...BASE, bonusTranches: [] });
    const withoutField = calculate(BASE);
    expect(withEmpty.finalBalance).toBeCloseTo(withoutField.finalBalance, 0);
  });
});

// ─── Drawdown phase ───────────────────────────────────────────────────────────

describe('drawdown phase', () => {
  it('age 65: drawdown rate is below FSCA max with default inputs', () => {
    const { rows } = calculate(BASE);
    const row = rows.find((r) => r.age === 65)!;
    expect(row.drawdownRate!).toBeLessThan(0.175);
    expect(row.drawdownCapped).toBe(false);
  });

  it('desired income grows with inflation: age 66 drawdown > age 65 drawdown (in absolute terms)', () => {
    const { rows } = calculate(BASE);
    const r65 = rows.find((r) => r.age === 65)!;
    const r66 = rows.find((r) => r.age === 66)!;
    expect(Math.abs(r66.savingsOrDrawdown)).toBeGreaterThan(Math.abs(r65.savingsOrDrawdown));
  });

  it('FSCA max cap is eventually applied during the 30-year drawdown period', () => {
    const { rows } = calculate(BASE);
    const retirementRows = rows.filter((r) => r.drawdownRate !== null);
    expect(retirementRows.some((r) => r.drawdownCapType === 'max')).toBe(true);
  });

  it('pension income grows each year during drawdown', () => {
    const { rows } = calculate(BASE);
    const r65 = rows.find((r) => r.age === 65)!;
    const r66 = rows.find((r) => r.age === 66)!;
    expect(r66.pensionIncome).toBeCloseTo(r65.pensionIncome * 1.05, 0);
  });
});

// ─── Status ───────────────────────────────────────────────────────────────────

describe('plan status', () => {
  it('default inputs produce a successful plan (portfolio survives 30 years)', () => {
    const result = calculate(BASE);
    expect(result.failureAge).toBeNull();
    expect(result.successAge).not.toBeNull();
    expect(result.finalBalance).toBeGreaterThan(0);
  });

  it('failure: zero savings, zero pension, zero rental — portfolio at zero from retirement', () => {
    const result = calculate({
      ...BASE,
      raBalance: 0,
      unitTrustBalance: 0,
      annualSavings: 0,
      otherPensionIncome: 0,
      grossRentalIncome: 0,
    });
    expect(result.failureAge).not.toBeNull();
    expect(result.successAge).toBeNull();
  });
});

// ─── Cone of uncertainty ──────────────────────────────────────────────────────

describe('cone of uncertainty', () => {
  it('high track end balance >= base >= low at retirement age', () => {
    const result = calculate(BASE);
    const base = result.rows.find((r) => r.age === 65)!.endBalance;
    const low = result.rowsLow.find((r) => r.age === 65)!.endBalance;
    const high = result.rowsHigh.find((r) => r.age === 65)!.endBalance;
    expect(high).toBeGreaterThanOrEqual(base);
    expect(base).toBeGreaterThanOrEqual(low);
  });

  it('no NaN in any track when uncertainty fields are all zero', () => {
    const noUnc = { ...BASE, uncertainty: { returnRate: 0, savingsAmount: 0, savingsGrowth: 0, pensionAmount: 0, pensionGrowth: 0 } };
    const result = calculate(noUnc);
    const all = [...result.rows, ...result.rowsLow, ...result.rowsHigh];
    expect(all.every((r) => !isNaN(r.endBalance))).toBe(true);
  });

  it('no NaN when uncertainty object is missing (old saved JSON)', () => {
    const noUnc = { ...BASE } as Inputs;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (noUnc as any).uncertainty;
    const result = calculate(noUnc);
    const all = [...result.rows, ...result.rowsLow, ...result.rowsHigh];
    expect(all.every((r) => !isNaN(r.endBalance))).toBe(true);
  });
});

// ─── Rental income ────────────────────────────────────────────────────────────

describe('rental income', () => {
  it('net rental offsets portfolio drawdown at retirement', () => {
    const withRental = calculate({ ...BASE, grossRentalIncome: 300_000 });
    const noRental = calculate(BASE);
    const withRow = withRental.rows.find((r) => r.age === 65)!;
    const noRow = noRental.rows.find((r) => r.age === 65)!;
    expect(Math.abs(withRow.savingsOrDrawdown)).toBeLessThan(Math.abs(noRow.savingsOrDrawdown));
  });

  it('rental escalates over working years before retirement', () => {
    const result = calculate({ ...BASE, grossRentalIncome: 100_000 });
    const row = result.rows.find((r) => r.age === 65)!;
    const escalated = 100_000 * Math.pow(1 + BASE.rentalEscalationRate, 10);
    const expected = escalated * (1 - BASE.vacancyCostRate) * (1 - BASE.marginalTaxRate);
    expect(row.netRentalIncome).toBeCloseTo(expected, 0);
  });
});

// ─── Dual return rates ────────────────────────────────────────────────────────

describe('dual return rates', () => {
  it('higher unitTrustReturnRate produces higher end balance by retirement', () => {
    const low = calculate({ ...BASE, unitTrustReturnRate: 0.06 });
    const high = calculate({ ...BASE, unitTrustReturnRate: 0.12 });
    const lowBal = low.rows.find((r) => r.age === 64)!.endBalance;
    const highBal = high.rows.find((r) => r.age === 64)!.endBalance;
    expect(highBal).toBeGreaterThan(lowBal);
  });

  it('higher raReturnRate produces higher RA-derived portfolio at retirement', () => {
    const low = calculate({ ...BASE, raReturnRate: 0.06, unitTrustBalance: 0 });
    const high = calculate({ ...BASE, raReturnRate: 0.12, unitTrustBalance: 0 });
    const lowBal = low.rows.find((r) => r.age === 65)!.balance;
    const highBal = high.rows.find((r) => r.age === 65)!.balance;
    expect(highBal).toBeGreaterThan(lowBal);
  });
});

// ─── Spreadsheet parity ───────────────────────────────────────────────────────
// True-north fixture: inputs exactly matching the original spreadsheet.
// raBalance=0 so no RA lump sum tax is applied; single 8% return rate throughout.
// Uncertainty zeroed for deterministic row-by-row comparison.

const SS: Inputs = {
  currentAge: 55,
  annualIncome: 3_795_000,
  inflationRate: 0.05,
  raBalance: 0,
  raReturnRate: 0.08,
  unitTrustBalance: 18_101_618,
  unitTrustReturnRate: 0.08,
  ukPensionBalance: 0,
  ukPensionReturnRate: 0.07,
  tfSavingsBalance: 0,
  tfSavingsReturnRate: 0.10,
  annualSavings: 360_000,
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
  otherPensionIncome: 50_000,
  pensionGrowthRate: 0.05,
  retirementYears: 30,
  incomeReplacementRate: 0.5,
  postReturnRate: 0.08,
  marginalTaxRate: 0.36,
  uncertainty: { returnRate: 0, savingsAmount: 0, savingsGrowth: 0, pensionAmount: 0, pensionGrowth: 0 },
  mortgageBalance: 0,
  vehicleFinanceBalance: 0,
  mortgageInterestRate: 0.115,
  surplusReinvestmentRate: 0,
};

// Spreadsheet columns: B=age, D=openingBalance, E=interest, F=savings, G=desiredIncome, H=pension, I=endBalance, J=drawdownRate
// During drawdown: savingsOrDrawdown in calculator = -(desiredIncome - pension) i.e. net portfolio draw.
// During accumulation: savingsOrDrawdown = annual savings (no rental in this fixture).

describe('spreadsheet parity — accumulation (ages 55–64)', () => {
  const { rows } = calculate(SS);

  it.each([
    { age: 55, balance: 18_101_618,    interest: 1_448_129.44, savings: 360_000,    end: 19_909_747.44  },
    { age: 56, balance: 19_909_747.44, interest: 1_592_779.80, savings: 378_000,    end: 21_880_527.24  },
    { age: 57, balance: 21_880_527.24, interest: 1_750_442.18, savings: 396_900,    end: 24_027_869.41  },
    { age: 58, balance: 24_027_869.41, interest: 1_922_229.55, savings: 416_745,    end: 26_366_843.97  },
    { age: 59, balance: 26_366_843.97, interest: 2_109_347.52, savings: 437_582.25, end: 28_913_773.73  },
    { age: 60, balance: 28_913_773.73, interest: 2_313_101.90, savings: 459_461.36, end: 31_686_336.99  },
    { age: 61, balance: 31_686_336.99, interest: 2_534_906.96, savings: 482_434.43, end: 34_703_678.39  },
    { age: 62, balance: 34_703_678.39, interest: 2_776_294.27, savings: 506_556.15, end: 37_986_528.81  },
    { age: 63, balance: 37_986_528.81, interest: 3_038_922.30, savings: 531_883.96, end: 41_557_335.07  },
    { age: 64, balance: 41_557_335.07, interest: 3_324_586.81, savings: 558_478.16, end: 45_440_400.04  },
  ])('age $age: balance, interest, savings, endBalance match spreadsheet', ({ age, balance, interest, savings, end }) => {
    const row = rows.find((r) => r.age === age)!;
    expect(row.balance).toBeCloseTo(balance, 0);
    expect(row.interest).toBeCloseTo(interest, 0);
    expect(row.savingsOrDrawdown).toBeCloseTo(savings, 0);
    expect(row.endBalance).toBeCloseTo(end, 0);
    expect(row.drawdownRate).toBeNull();
    expect(row.netRentalIncome).toBe(0);
    expect(row.pensionIncome).toBe(0);
  });
});

describe('spreadsheet parity — drawdown (ages 65–94)', () => {
  const { rows } = calculate(SS);

  // desiredIncome = total income target (drawdown + pension). portfolioDraw = desiredIncome - pension.
  it.each([
    { age: 65, balance: 45_440_400.04, interest: 3_635_232.00, desired: 3_090_827.55, pension:  50_000.00, end: 46_034_804.49, rate: 0.06802 },
    { age: 66, balance: 46_034_804.49, interest: 3_682_784.36, desired: 3_245_368.93, pension:  52_500.00, end: 46_524_719.91, rate: 0.07050 },
    { age: 67, balance: 46_524_719.91, interest: 3_721_977.59, desired: 3_407_637.38, pension:  55_125.00, end: 46_894_185.13, rate: 0.07324 },
    { age: 68, balance: 46_894_185.13, interest: 3_751_534.81, desired: 3_578_019.25, pension:  57_881.25, end: 47_125_581.94, rate: 0.07630 },
    { age: 69, balance: 47_125_581.94, interest: 3_770_046.56, desired: 3_756_920.21, pension:  60_775.31, end: 47_199_483.60, rate: 0.07972 },
    { age: 70, balance: 47_199_483.60, interest: 3_775_958.69, desired: 3_944_766.22, pension:  63_814.08, end: 47_094_490.14, rate: 0.08358 },
    { age: 71, balance: 47_094_490.14, interest: 3_767_559.21, desired: 4_142_004.53, pension:  67_004.78, end: 46_787_049.60, rate: 0.08795 },
    { age: 72, balance: 46_787_049.60, interest: 3_742_963.97, desired: 4_349_104.76, pension:  70_355.02, end: 46_251_263.84, rate: 0.09296 },
    { age: 73, balance: 46_251_263.84, interest: 3_700_101.11, desired: 4_566_560.00, pension:  73_872.77, end: 45_458_677.72, rate: 0.09873 },
    { age: 74, balance: 45_458_677.72, interest: 3_636_694.22, desired: 4_794_888.00, pension:  77_566.41, end: 44_378_050.35, rate: 0.10548 },
    { age: 75, balance: 44_378_050.35, interest: 3_550_244.03, desired: 5_034_632.40, pension:  81_444.73, end: 42_975_106.72, rate: 0.11345 },
    { age: 76, balance: 42_975_106.72, interest: 3_438_008.54, desired: 5_286_364.02, pension:  85_516.97, end: 41_212_268.21, rate: 0.12301 },
    { age: 77, balance: 41_212_268.21, interest: 3_296_981.46, desired: 5_550_682.22, pension:  89_792.82, end: 39_048_360.26, rate: 0.13469 },
    { age: 78, balance: 39_048_360.26, interest: 3_123_868.82, desired: 5_828_216.33, pension:  94_282.46, end: 36_438_295.21, rate: 0.14926 },
    { age: 79, balance: 36_438_295.21, interest: 2_915_063.62, desired: 6_119_627.14, pension:  98_996.58, end: 33_332_728.27, rate: 0.16794 },
    // FSCA 17.5% cap kicks in from age 80 onward
    { age: 80, balance: 33_332_728.27, interest: 2_666_618.26, desired: 5_833_227.45, pension: 103_946.41, end: 30_270_065.49, rate: 0.17500 },
    { age: 81, balance: 30_270_065.49, interest: 2_421_605.24, desired: 5_297_261.46, pension: 109_143.73, end: 27_503_553.00, rate: 0.17500 },
    { age: 82, balance: 27_503_553.00, interest: 2_200_284.24, desired: 4_813_121.77, pension: 114_600.92, end: 25_005_316.38, rate: 0.17500 },
    { age: 83, balance: 25_005_316.38, interest: 2_000_425.31, desired: 4_375_930.37, pension: 120_330.96, end: 22_750_142.29, rate: 0.17500 },
    { age: 84, balance: 22_750_142.29, interest: 1_820_011.38, desired: 3_981_274.90, pension: 126_347.51, end: 20_715_226.28, rate: 0.17500 },
    { age: 85, balance: 20_715_226.28, interest: 1_657_218.10, desired: 3_625_164.60, pension: 132_664.89, end: 18_879_944.67, rate: 0.17500 },
    { age: 86, balance: 18_879_944.67, interest: 1_510_395.57, desired: 3_303_990.32, pension: 139_298.13, end: 17_225_648.05, rate: 0.17500 },
    { age: 87, balance: 17_225_648.05, interest: 1_378_051.84, desired: 3_014_488.41, pension: 146_263.04, end: 15_735_474.52, rate: 0.17500 },
    { age: 88, balance: 15_735_474.52, interest: 1_258_837.96, desired: 2_753_708.04, pension: 153_576.19, end: 14_394_180.63, rate: 0.17500 },
    { age: 89, balance: 14_394_180.63, interest: 1_151_534.45, desired: 2_518_981.61, pension: 161_255.00, end: 13_187_988.47, rate: 0.17500 },
    { age: 90, balance: 13_187_988.47, interest: 1_055_039.08, desired: 2_307_897.98, pension: 169_317.75, end: 12_104_447.31, rate: 0.17500 },
    { age: 91, balance: 12_104_447.31, interest:   968_355.78, desired: 2_118_278.28, pension: 177_783.63, end: 11_132_308.45, rate: 0.17500 },
    { age: 92, balance: 11_132_308.45, interest:   890_584.68, desired: 1_948_153.98, pension: 186_672.82, end: 10_261_411.96, rate: 0.17500 },
    { age: 93, balance: 10_261_411.96, interest:   820_912.96, desired: 1_795_747.09, pension: 196_006.46, end:  9_482_584.29, rate: 0.17500 },
    { age: 94, balance:  9_482_584.29, interest:   758_606.74, desired: 1_659_452.25, pension: 205_806.78, end:  8_787_545.56, rate: 0.17500 },
  ])('age $age: balance, interest, drawdown, pension, endBalance, rate match spreadsheet', ({ age, balance, interest, desired, pension, end, rate }) => {
    const row = rows.find((r) => r.age === age)!;
    expect(row.balance).toBeCloseTo(balance, 0);
    expect(row.interest).toBeCloseTo(interest, 0);
    expect(row.pensionIncome).toBeCloseTo(pension, 0);
    expect(row.endBalance).toBeCloseTo(end, 0);
    expect(row.drawdownRate!).toBeCloseTo(rate, 4);
    // Net portfolio draw = desired income − pension
    expect(Math.abs(row.savingsOrDrawdown) + row.pensionIncome).toBeCloseTo(desired, 0);
  });

  it('FSCA 17.5% cap first applies at age 80', () => {
    expect(rows.find((r) => r.age === 79)!.drawdownCapped).toBe(false);
    expect(rows.find((r) => r.age === 80)!.drawdownCapped).toBe(true);
    expect(rows.find((r) => r.age === 80)!.drawdownCapType).toBe('max');
  });

  it('plan survives full 30-year drawdown period with positive balance', () => {
    expect(rows.find((r) => r.age === 94)!.endBalance).toBeGreaterThan(0);
  });
});

// ─── Surplus reinvestment ─────────────────────────────────────────────────────

describe('surplus reinvestment side-pot', () => {
  it('pre-retirement rows always have availableToInvest = 0 and cumulativeReinvestment = 0', () => {
    const result = calculate({ ...BASE, surplusReinvestmentRate: 0.5 }, 10_000);
    const preRows = result.rows.filter((r) => r.drawdownRate === null);
    expect(preRows.every((r) => r.availableToInvest === 0)).toBe(true);
    expect(preRows.every((r) => r.cumulativeReinvestment === 0)).toBe(true);
  });

  it('cumulativeReinvestment = 0 for all rows when surplusReinvestmentRate = 0', () => {
    const result = calculate({ ...BASE, surplusReinvestmentRate: 0 }, 10_000);
    expect(result.rows.every((r) => r.cumulativeReinvestment === 0)).toBe(true);
  });

  it('cumulativeReinvestment grows monotonically post-retirement when rate > 0 and surplus exists', () => {
    // No expenses → full income available → pot should grow each year
    const result = calculate({ ...BASE, surplusReinvestmentRate: 1.0 }, 0);
    const postRows = result.rows.filter((r) => r.drawdownRate !== null);
    for (let i = 1; i < postRows.length; i++) {
      expect(postRows[i].cumulativeReinvestment).toBeGreaterThanOrEqual(postRows[i - 1].cumulativeReinvestment);
    }
  });

  it('higher surplusReinvestmentRate produces a larger pot at any given age', () => {
    const low  = calculate({ ...BASE, surplusReinvestmentRate: 0.25 }, 0);
    const high = calculate({ ...BASE, surplusReinvestmentRate: 0.75 }, 0);
    const r70low  = low.rows.find((r) => r.age === 70)!;
    const r70high = high.rows.find((r) => r.age === 70)!;
    expect(r70high.cumulativeReinvestment).toBeGreaterThan(r70low.cumulativeReinvestment);
  });

  it('availableToInvest equals post-tax surplus × reinvestmentRate / 12 at retirement', () => {
    const monthlyExpenses = 100_000;
    const rate = 0.5;
    const result = calculate({ ...BASE, surplusReinvestmentRate: rate }, monthlyExpenses);
    const r65 = result.rows.find((r) => r.age === 65)!;
    // Portfolio drawdown and pension are taxable; netRentalIncome is already post-tax
    const portfolioNet = Math.abs(r65.savingsOrDrawdown) * (1 - BASE.marginalTaxRate);
    const pensionNet = r65.pensionIncome * (1 - BASE.marginalTaxRate);
    const annualIncomePostTax = portfolioNet + r65.netRentalIncome + pensionNet;
    const annualExpenses = monthlyExpenses * 12;
    const expectedMonthly = Math.max(0, annualIncomePostTax - annualExpenses) * rate / 12;
    expect(r65.availableToInvest).toBeCloseTo(expectedMonthly, 0);
  });

  it('when monthly expenses exceed income, availableToInvest = 0 (no negative surplus)', () => {
    // Very high expenses — R1M/month → annual R12M >> income
    const result = calculate({ ...BASE, surplusReinvestmentRate: 1.0 }, 1_000_000);
    const postRows = result.rows.filter((r) => r.drawdownRate !== null);
    expect(postRows.every((r) => r.availableToInvest === 0)).toBe(true);
    expect(postRows.every((r) => r.cumulativeReinvestment === 0)).toBe(true);
  });
});
