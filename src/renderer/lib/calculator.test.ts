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
  cathCurrentAge: 55,
  cathRetirementAge: 65,  // same as Clive → crystallises at retirement, preserves existing fixtures
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
  variableBonusExclusions: [],
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

  it('age 55: savings contribution = FV of 12 monthly payments of R30K at 8% p.a.', () => {
    const { rows } = calculate(BASE);
    // FV = (360,000/12) × ((1 + 0.08/12)^12 − 1) / (0.08/12) ≈ 373,497.78
    expect(rows.find((r) => r.age === 55)!.savingsOrDrawdown).toBeCloseTo(373_497.78, 0);
  });

  it('age 64: end balance is the opening retirement portfolio (before RA tax)', () => {
    const { rows } = calculate(BASE);
    const row = rows.find((r) => r.age === 64)!;
    // FV of (360,000 × 1.05^9) / 12 monthly payments at 8% p.a. ≈ 579,417.65
    expect(row.savingsOrDrawdown).toBeCloseTo(579_417.65, 0);
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
  cathCurrentAge: 55,
  cathRetirementAge: 65,  // same as Clive → crystallises at retirement, preserves existing fixtures
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

// During drawdown: savingsOrDrawdown in calculator = -(desiredIncome - pension) i.e. net portfolio draw.
// During accumulation: savingsOrDrawdown = FV of 12 monthly contributions at UT rate (not a year-end lump sum).

describe('spreadsheet parity — accumulation (ages 55–64)', () => {
  const { rows } = calculate(SS);

  it.each([
    { age: 55, balance: 18_101_618,    interest: 1_448_129.44, savings: 373_497.78, end: 19_923_245.22  },
    { age: 56, balance: 19_923_245.22, interest: 1_593_859.62, savings: 392_172.67, end: 21_909_277.51  },
    { age: 57, balance: 21_909_277.51, interest: 1_752_742.20, savings: 411_781.30, end: 24_073_801.01  },
    { age: 58, balance: 24_073_801.01, interest: 1_925_904.08, savings: 432_370.37, end: 26_432_075.46  },
    { age: 59, balance: 26_432_075.46, interest: 2_114_566.04, savings: 453_988.89, end: 29_000_630.38  },
    { age: 60, balance: 29_000_630.38, interest: 2_320_050.43, savings: 476_688.33, end: 31_797_369.15  },
    { age: 61, balance: 31_797_369.15, interest: 2_543_789.53, savings: 500_522.75, end: 34_841_681.43  },
    { age: 62, balance: 34_841_681.43, interest: 2_787_334.51, savings: 525_548.88, end: 38_154_564.82  },
    { age: 63, balance: 38_154_564.82, interest: 3_052_365.19, savings: 551_826.33, end: 41_758_756.34  },
    { age: 64, balance: 41_758_756.34, interest: 3_340_700.51, savings: 579_417.65, end: 45_678_874.49  },
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

  // desired = portfolioDrawdown + pension (= total income for uncapped; = balance×17.5% + pension when capped).
  // FSCA rate = portfolioDrawdown / balance (pension/rental are external — they don't inflate the rate).
  it.each([
    { age: 65, balance: 45_678_874.49, interest: 3_654_309.96, desired: 3_090_827.55, pension:  50_000.00, end: 46_292_356.90, rate: 0.06657 },
    { age: 66, balance: 46_292_356.90, interest: 3_703_388.55, desired: 3_245_368.93, pension:  52_500.00, end: 46_802_876.52, rate: 0.06897 },
    { age: 67, balance: 46_802_876.52, interest: 3_744_230.12, desired: 3_407_637.38, pension:  55_125.00, end: 47_194_594.26, rate: 0.07163 },
    { age: 68, balance: 47_194_594.26, interest: 3_775_567.54, desired: 3_578_019.25, pension:  57_881.25, end: 47_450_023.80, rate: 0.07459 },
    { age: 69, balance: 47_450_023.80, interest: 3_796_001.90, desired: 3_756_920.21, pension:  60_775.31, end: 47_549_880.81, rate: 0.07790 },
    { age: 70, balance: 47_549_880.81, interest: 3_803_990.46, desired: 3_944_766.22, pension:  63_814.08, end: 47_472_919.13, rate: 0.08162 },
    { age: 71, balance: 47_472_919.13, interest: 3_797_833.53, desired: 4_142_004.53, pension:  67_004.78, end: 47_195_752.91, rate: 0.08584 },
    { age: 72, balance: 47_195_752.91, interest: 3_775_660.23, desired: 4_349_104.76, pension:  70_355.02, end: 46_692_663.41, rate: 0.09066 },
    { age: 73, balance: 46_692_663.41, interest: 3_735_413.07, desired: 4_566_560.00, pension:  73_872.77, end: 45_935_389.26, rate: 0.09622 },
    { age: 74, balance: 45_935_389.26, interest: 3_674_831.14, desired: 4_794_888.00, pension:  77_566.41, end: 44_892_898.82, rate: 0.10269 },
    { age: 75, balance: 44_892_898.82, interest: 3_591_431.91, desired: 5_034_632.40, pension:  81_444.73, end: 43_531_143.06, rate: 0.11033 },
    { age: 76, balance: 43_531_143.06, interest: 3_482_491.44, desired: 5_286_364.02, pension:  85_516.97, end: 41_812_787.45, rate: 0.11947 },
    { age: 77, balance: 41_812_787.45, interest: 3_345_023.00, desired: 5_550_682.22, pension:  89_792.82, end: 39_696_921.05, rate: 0.13060 },
    { age: 78, balance: 39_696_921.05, interest: 3_175_753.68, desired: 5_828_216.33, pension:  94_282.46, end: 37_138_740.87, rate: 0.14444 },
    { age: 79, balance: 37_138_740.87, interest: 2_971_099.27, desired: 6_119_627.14, pension:  98_996.58, end: 34_089_209.57, rate: 0.16211 },
    // FSCA 17.5% cap kicks in from age 80; draws balance×17.5% from annuity (pension received separately)
    { age: 80, balance: 34_089_209.57, interest: 2_727_136.77, desired: 6_069_558.08, pension: 103_946.41, end: 30_850_734.66, rate: 0.17500 },
    { age: 81, balance: 30_850_734.66, interest: 2_468_058.77, desired: 5_508_022.30, pension: 109_143.73, end: 27_919_914.87, rate: 0.17500 },
    { age: 82, balance: 27_919_914.87, interest: 2_233_593.19, desired: 5_000_586.02, pension: 114_600.92, end: 25_267_522.96, rate: 0.17500 },
    { age: 83, balance: 25_267_522.96, interest: 2_021_401.84, desired: 4_542_147.48, pension: 120_330.96, end: 22_867_108.28, rate: 0.17500 },
    { age: 84, balance: 22_867_108.28, interest: 1_829_368.66, desired: 4_128_091.46, pension: 126_347.51, end: 20_694_732.99, rate: 0.17500 },
    { age: 85, balance: 20_694_732.99, interest: 1_655_578.64, desired: 3_754_243.16, pension: 132_664.89, end: 18_728_733.36, rate: 0.17500 },
    { age: 86, balance: 18_728_733.36, interest: 1_498_298.67, desired: 3_416_826.47, pension: 139_298.13, end: 16_949_503.69, rate: 0.17500 },
    { age: 87, balance: 16_949_503.69, interest: 1_355_960.29, desired: 3_112_426.18, pension: 146_263.04, end: 15_339_300.84, rate: 0.17500 },
    { age: 88, balance: 15_339_300.84, interest: 1_227_144.07, desired: 2_837_953.83, pension: 153_576.19, end: 13_882_067.26, rate: 0.17500 },
    { age: 89, balance: 13_882_067.26, interest: 1_110_565.38, desired: 2_590_616.77, pension: 161_255.00, end: 12_563_270.87, rate: 0.17500 },
    { age: 90, balance: 12_563_270.87, interest: 1_005_061.67, desired: 2_367_890.15, pension: 169_317.75, end: 11_369_760.14, rate: 0.17500 },
    { age: 91, balance: 11_369_760.14, interest:   909_580.81, desired: 2_167_491.66, pension: 177_783.63, end: 10_289_632.92, rate: 0.17500 },
    { age: 92, balance: 10_289_632.92, interest:   823_170.63, desired: 1_987_358.58, pension: 186_672.82, end:  9_312_117.79, rate: 0.17500 },
    { age: 93, balance:  9_312_117.79, interest:   744_969.42, desired: 1_825_627.07, pension: 196_006.46, end:  8_427_466.60, rate: 0.17500 },
    { age: 94, balance:  8_427_466.60, interest:   674_197.33, desired: 1_680_613.44, pension: 205_806.78, end:  7_626_857.28, rate: 0.17500 },
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

// ─── Cath early crystallisation ──────────────────────────────────────────────

describe("Cath's early RA crystallisation", () => {
  const WITH_CATH_RA: Inputs = {
    ...BASE,
    cathRaBalance: 3_000_000,
    cathMtnBalance: 1_000_000,
    cathCurrentAge: 55,
    cathRetirementAge: 57,  // drawdownAge = max(57, 60) = 60; Clive also 60
  };

  it('crystallises at Clive age 60 when cathRetirementAge=57 and cathCurrentAge=55', () => {
    const result = calculate(WITH_CATH_RA);
    expect(result.cathCrystallisedAtCliveAge).toBe(60);
  });

  it('cathRaLumpSumTaxPaid is positive when Cath has RA-type funds', () => {
    const result = calculate(WITH_CATH_RA);
    expect(result.cathRaLumpSumTaxPaid).toBeGreaterThan(0);
  });

  it('cathRaLumpSumTaxPaid is zero when Cath has no RA-type funds', () => {
    const result = calculate({ ...BASE, cathRetirementAge: 57 });
    expect(result.cathRaLumpSumTaxPaid).toBe(0);
  });

  it('post-crystallisation fund rows show cathRa=0 and cathMtn=0', () => {
    const result = calculate(WITH_CATH_RA);
    const accumRows = result.rows.filter((r) => r.fundEndBalances !== undefined);
    const postCryst = accumRows.filter((r) => r.age >= 60);
    expect(postCryst.length).toBeGreaterThan(0);
    expect(postCryst.every((r) => r.fundEndBalances!.cathRa === 0)).toBe(true);
    expect(postCryst.every((r) => r.fundEndBalances!.cathMtn === 0)).toBe(true);
  });

  it('cathCrystallisedAtCliveAge is null when cathRetirementAge >= retirementAge', () => {
    const result = calculate({ ...BASE, cathCurrentAge: 55, cathRetirementAge: 65, cathRaBalance: 1_000_000 });
    expect(result.cathCrystallisedAtCliveAge).toBeNull();
  });

  it('higher cathRetirementAge delays crystallisation (still capped at min 60)', () => {
    const early = calculate({ ...WITH_CATH_RA, cathRetirementAge: 57 });
    const late  = calculate({ ...WITH_CATH_RA, cathRetirementAge: 63 });
    expect(early.cathCrystallisedAtCliveAge).toBe(60);  // max(57,60)=60
    expect(late.cathCrystallisedAtCliveAge).toBe(63);   // max(63,60)=63
  });
});
