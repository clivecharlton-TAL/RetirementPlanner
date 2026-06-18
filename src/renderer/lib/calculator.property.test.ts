/**
 * Property-based tests for the retirement calculator.
 *
 * Every test here asserts a mathematical invariant that must hold for ALL
 * valid inputs — not just the specific examples in calculator.test.ts.
 * fast-check generates 200 random input combinations per property and
 * automatically shrinks any failing case to its minimal reproducer.
 *
 * Run alongside unit tests: npm test
 *
 * IMPORTANT: Property callbacks use explicit boolean returns or `throw` rather
 * than vitest's `expect()` API, which has incompatible return semantics with
 * fast-check v4's property runner. `throw new Error(msg)` produces the same
 * shrunk counterexample with a clear failure message.
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { calculate, computeRaLumpSumTax } from './calculator';
import type { Inputs } from './types';

// ─── FSCA constants (must match calculator.ts) ────────────────────────────────
const FSCA_MIN = 0.025;
const FSCA_MAX = 0.175;

// How many random inputs per property. 200 gives strong coverage without
// adding more than ~2 s to the build. Raise to 1000 for a deeper audit.
const RUNS = 200;

// ─── Numeric helpers ──────────────────────────────────────────────────────────

/** True when |a - b| < 10^(-digits) / 2 (same threshold as toBeCloseTo). */
const isClose = (a: number, b: number, digits = 8): boolean =>
  Math.abs(a - b) < Math.pow(10, -digits) / 2;

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Percentage rate in [0, max], in steps of 0.001.
 * Using integers mapped to rationals avoids floating-point edge cases in
 * the generators themselves.
 */
const arbPct = (max = 0.25) =>
  fc.integer({ min: 0, max: Math.round(max * 1000) }).map(n => n / 1000);

/** Monetary amount in [0, max], in steps of R10 000. */
const arbR = (max = 30_000_000) =>
  fc.integer({ min: 0, max: Math.round(max / 10_000) }).map(n => n * 10_000);

/**
 * Produces a complete, valid Inputs object with correlated age fields.
 * retirementAge is always strictly greater than currentAge.
 * bonusTranche yearsFromNow and variableBonusExclusion indices always fall
 * within the [0, yearsWorking-1] accumulation window.
 */
const arbInputs: fc.Arbitrary<Inputs> =
  fc.integer({ min: 35, max: 60 }).chain(currentAge =>
    fc.integer({ min: currentAge + 1, max: 75 }).chain(retirementAge => {
      const yw = retirementAge - currentAge; // always >= 1
      const yearIdx = fc.integer({ min: 0, max: yw - 1 });

      return fc.record({
        currentAge:              fc.constant(currentAge),
        retirementAge:           fc.constant(retirementAge),
        retirementYears:         fc.integer({ min: 5, max: 35 }),
        annualIncome:            arbR(5_000_000),
        inflationRate:           arbPct(0.12),
        // My savings
        raBalance:               arbR(),
        raReturnRate:            arbPct(),
        unitTrustBalance:        arbR(),
        unitTrustReturnRate:     arbPct(),
        ukPensionBalance:        arbR(5_000_000),
        ukPensionReturnRate:     arbPct(),
        tfSavingsBalance:        arbR(2_000_000),
        tfSavingsReturnRate:     arbPct(),
        annualSavings:           arbR(2_000_000),
        savingsGrowthRate:       arbPct(0.15),
        bonusTranches: fc.array(
          fc.record({ amount: arbR(1_000_000), yearsFromNow: yearIdx }),
          { maxLength: 4 }
        ),
        // Cath's investments
        cathTfSavingsBalance:    arbR(2_000_000),
        cathTfSavingsReturnRate: arbPct(),
        cathUnitTrustBalance:    arbR(),
        cathUnitTrustReturnRate: arbPct(),
        cathRaBalance:           arbR(),
        cathRaReturnRate:        arbPct(),
        cathMtnBalance:          arbR(),
        cathMtnReturnRate:       arbPct(),
        // Rental
        grossRentalIncome:       arbR(2_000_000),
        rentalEscalationRate:    arbPct(0.15),
        vacancyCostRate:         arbPct(0.50),
        // Retirement
        otherPensionIncome:      arbR(500_000),
        pensionGrowthRate:       arbPct(0.10),
        incomeReplacementRate:   fc.integer({ min: 10, max: 100 }).map(n => n / 100),
        postReturnRate:          arbPct(),
        // Tax
        marginalTaxRate:         fc.integer({ min: 0, max: 45 }).map(n => n / 100),
        // Uncertainty
        uncertainty: fc.record({
          returnRate:    arbPct(0.05),
          savingsAmount: arbPct(0.10),
          savingsGrowth: arbPct(0.10),
          pensionAmount: arbPct(0.10),
          pensionGrowth: arbPct(0.10),
        }),
        // Mortgage (display-only; not used in projection)
        mortgageBalance:         fc.constant(0),
        vehicleFinanceBalance:   fc.constant(0),
        mortgageInterestRate:    fc.constant(0.115),
        // Surplus reinvestment
        surplusReinvestmentRate: fc.integer({ min: 0, max: 100 }).map(n => n / 100),
        // Variable bonus
        variableBonusEnabled:    fc.boolean(),
        variableBonusRate:       fc.integer({ min: 0, max: 100 }).map(n => n / 100),
        variableBonusExclusions: fc.array(yearIdx, { maxLength: Math.min(5, yw) }),
      }) as unknown as fc.Arbitrary<Inputs>;
    })
  );

// ─── 1. SA Lump Sum Tax — pure function properties ────────────────────────────

describe('computeRaLumpSumTax — property tests', () => {
  it('is monotonically non-decreasing: tax(a) ≥ tax(b) when a ≥ b ≥ 0', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 20_000_000 }),
      fc.integer({ min: 0, max: 20_000_000 }),
      (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return computeRaLumpSumTax(hi) >= computeRaLumpSumTax(lo);
      }
    ), { numRuns: RUNS });
  });

  it('is always non-negative: tax(x) ≥ 0', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 20_000_000 }),
      (x) => computeRaLumpSumTax(x) >= 0
    ), { numRuns: RUNS });
  });

  it('never exceeds the lump sum: tax(x) ≤ x', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 20_000_000 }),
      (x) => computeRaLumpSumTax(x) <= x
    ), { numRuns: RUNS });
  });

  it('is zero for every amount at or below R550 000 (first bracket)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 550_000 }),
      (x) => computeRaLumpSumTax(x) === 0
    ), { numRuns: RUNS });
  });

  it('is positive for every amount above R550 000', () => {
    fc.assert(fc.property(
      fc.integer({ min: 550_001, max: 20_000_000 }),
      (x) => computeRaLumpSumTax(x) > 0
    ), { numRuns: RUNS });
  });

  it('effective rate (tax/lumpSum) is non-decreasing — bracket schedule is progressive', () => {
    fc.assert(fc.property(
      fc.integer({ min: 550_001, max: 20_000_000 }),
      fc.integer({ min: 550_001, max: 20_000_000 }),
      (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return computeRaLumpSumTax(hi) / hi >= computeRaLumpSumTax(lo) / lo - 1e-12;
      }
    ), { numRuns: RUNS });
  });

  it('is continuous at bracket boundaries — no negative jump, increment bounded by marginal rate', () => {
    fc.assert(fc.property(
      fc.constantFrom(550_000, 770_000, 1_155_000),
      fc.integer({ min: 1, max: 1_000 }),
      (boundary, delta) => {
        const below = computeRaLumpSumTax(boundary);
        const above = computeRaLumpSumTax(boundary + delta);
        return above >= below && above - below <= delta * 0.36 + 1;
      }
    ), { numRuns: RUNS });
  });
});

// ─── 2. Row structure invariants ──────────────────────────────────────────────

describe('calculate — row structure', () => {
  it('accumulation rows have null drawdownRate; drawdown rows have a non-null rate', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows) {
        const isAcc = row.age < inputs.retirementAge;
        if (isAcc && row.drawdownRate !== null)
          throw new Error(`Age ${row.age}: accumulation row has non-null drawdownRate`);
        if (!isAcc && row.drawdownRate === null)
          throw new Error(`Age ${row.age}: drawdown row has null drawdownRate`);
      }
    }), { numRuns: RUNS });
  });

  it('ages form a consecutive integer sequence starting at currentAge', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].age !== inputs.currentAge + i)
          throw new Error(`rows[${i}].age = ${rows[i].age}, expected ${inputs.currentAge + i}`);
      }
    }), { numRuns: RUNS });
  });

  it('no NaN in any numeric row field (base track)', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows) {
        const fields: [string, number | null][] = [
          ['balance', row.balance], ['interest', row.interest],
          ['savingsOrDrawdown', row.savingsOrDrawdown], ['endBalance', row.endBalance],
          ['netRentalIncome', row.netRentalIncome], ['pensionIncome', row.pensionIncome],
          ['availableToInvest', row.availableToInvest],
          ['cumulativeReinvestment', row.cumulativeReinvestment],
        ];
        if (row.drawdownRate !== null) fields.push(['drawdownRate', row.drawdownRate]);
        for (const [name, val] of fields) {
          if (isNaN(val as number))
            throw new Error(`Age ${row.age}: ${name} is NaN`);
        }
      }
    }), { numRuns: RUNS });
  });

  it('no NaN in the low/high uncertainty band tracks', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rowsLow, rowsHigh } = calculate(inputs);
      for (const row of [...rowsLow, ...rowsHigh]) {
        if (isNaN(row.balance))    throw new Error(`Age ${row.age}: balance NaN in uncertainty track`);
        if (isNaN(row.endBalance)) throw new Error(`Age ${row.age}: endBalance NaN in uncertainty track`);
      }
    }), { numRuns: RUNS });
  });

  it('endBalance is always ≥ 0 (no negative portfolio)', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows) {
        if (row.endBalance < 0)
          throw new Error(`Age ${row.age}: endBalance is negative (${row.endBalance})`);
      }
    }), { numRuns: RUNS });
  });

  it('within each phase, row[n+1].balance = row[n].endBalance', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (let i = 0; i < rows.length - 1; i++) {
        const curr = rows[i];
        const next = rows[i + 1];
        // RA lump-sum tax causes a deliberate discontinuity at the accumulation/drawdown
        // boundary, so only check continuity within the same phase.
        const samePhase =
          (curr.age < inputs.retirementAge) === (next.age < inputs.retirementAge);
        if (samePhase && !isClose(next.balance, curr.endBalance, 0))
          throw new Error(
            `Age ${curr.age}→${next.age}: endBalance ${curr.endBalance} ≠ next.balance ${next.balance}`
          );
      }
    }), { numRuns: RUNS });
  });

  it('accumulation row count = retirementAge − currentAge', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      const accCount = rows.filter(r => r.age < inputs.retirementAge).length;
      const expected = inputs.retirementAge - inputs.currentAge;
      if (accCount !== expected)
        throw new Error(`accCount ${accCount} ≠ ${expected}`);
    }), { numRuns: RUNS });
  });

  it('drawdown row count does not exceed retirementYears', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      const drawCount = rows.filter(r => r.age >= inputs.retirementAge).length;
      if (drawCount > inputs.retirementYears)
        throw new Error(`drawCount ${drawCount} > retirementYears ${inputs.retirementYears}`);
    }), { numRuns: RUNS });
  });
});

// ─── 3. FSCA compliance ───────────────────────────────────────────────────────

describe('calculate — FSCA drawdown compliance', () => {
  it('every drawdown rate is within [2.5%, 17.5%]', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows.filter(r => r.drawdownRate !== null)) {
        const r = row.drawdownRate!;
        if (r < FSCA_MIN - 1e-10 || r > FSCA_MAX + 1e-10)
          throw new Error(`Age ${row.age}: drawdownRate ${r} outside [${FSCA_MIN}, ${FSCA_MAX}]`);
      }
    }), { numRuns: RUNS });
  });

  it('drawdownCapped ↔ drawdownCapType is not null', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows.filter(r => r.drawdownRate !== null)) {
        if (row.drawdownCapped !== (row.drawdownCapType !== null))
          throw new Error(
            `Age ${row.age}: drawdownCapped=${row.drawdownCapped} but capType=${row.drawdownCapType}`
          );
      }
    }), { numRuns: RUNS });
  });

  it('when drawdownCapType = "max", drawdownRate ≈ FSCA_MAX (17.5%)', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows.filter(r => r.drawdownCapType === 'max')) {
        if (!isClose(row.drawdownRate!, FSCA_MAX))
          throw new Error(`Age ${row.age}: capped-max rate ${row.drawdownRate} ≠ ${FSCA_MAX}`);
      }
    }), { numRuns: RUNS });
  });

  it('when drawdownCapType = "min", drawdownRate ≈ FSCA_MIN (2.5%)', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows.filter(r => r.drawdownCapType === 'min')) {
        if (!isClose(row.drawdownRate!, FSCA_MIN))
          throw new Error(`Age ${row.age}: capped-min rate ${row.drawdownRate} ≠ ${FSCA_MIN}`);
      }
    }), { numRuns: RUNS });
  });
});

// ─── 4. FSCA rate formula correctness ─────────────────────────────────────────
//
// The FSCA drawdown rate must equal portfolioDrawdown / balance — the fraction
// of the living annuity VALUE drawn FROM the annuity.  Pension and rental are
// external income sources and must NOT inflate this rate.

describe('calculate — FSCA rate uses portfolio draw, not gross income', () => {
  it('drawdownRate = |savingsOrDrawdown| / balance for every row with balance > 0', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows.filter(r => r.drawdownRate !== null && r.balance > 0)) {
        const expected = Math.abs(row.savingsOrDrawdown) / row.balance;
        if (!isClose(row.drawdownRate!, expected))
          throw new Error(
            `Age ${row.age}: drawdownRate ${row.drawdownRate} ≠ portfolioDraw/balance (${expected})`
          );
      }
    }), { numRuns: RUNS });
  });

  it('more pension income does not increase the FSCA drawdown rate', () => {
    fc.assert(fc.property(
      arbInputs.map(i => ({ ...i, grossRentalIncome: 0 })), // isolate pension effect
      fc.integer({ min: 10_000, max: 500_000 }),
      (inputs, extraPension) => {
        const base = calculate(inputs);
        const more = calculate({ ...inputs, otherPensionIncome: inputs.otherPensionIncome + extraPension });
        const baseRow = base.rows.find(r => r.age === inputs.retirementAge);
        const moreRow = more.rows.find(r => r.age === inputs.retirementAge);
        if (!baseRow || !moreRow || baseRow.drawdownRate === null || moreRow.drawdownRate === null) return;
        // More pension ⟹ less drawn from living annuity ⟹ rate ≤ base rate
        if (moreRow.drawdownRate > baseRow.drawdownRate + 1e-10)
          throw new Error(
            `More pension raised drawdownRate: ${moreRow.drawdownRate} > ${baseRow.drawdownRate}`
          );
      }
    ), { numRuns: RUNS });
  });

  it('more rental income does not increase the FSCA drawdown rate', () => {
    fc.assert(fc.property(
      arbInputs,
      fc.integer({ min: 10_000, max: 1_000_000 }),
      (inputs, extraRental) => {
        const base = calculate(inputs);
        const more = calculate({ ...inputs, grossRentalIncome: inputs.grossRentalIncome + extraRental });
        const baseRow = base.rows.find(r => r.age === inputs.retirementAge);
        const moreRow = more.rows.find(r => r.age === inputs.retirementAge);
        if (!baseRow || !moreRow || baseRow.drawdownRate === null || moreRow.drawdownRate === null) return;
        if (moreRow.drawdownRate > baseRow.drawdownRate + 1e-10)
          throw new Error(
            `More rental raised drawdownRate: ${moreRow.drawdownRate} > ${baseRow.drawdownRate}`
          );
      }
    ), { numRuns: RUNS });
  });
});

// ─── 5. Monotonicity properties ───────────────────────────────────────────────

describe('calculate — monotonicity', () => {
  it('more annual savings → final balance never decreases', () => {
    fc.assert(fc.property(
      arbInputs,
      fc.integer({ min: 10_000, max: 500_000 }),
      (inputs, extra) => {
        const base = calculate(inputs).finalBalance;
        const more = calculate({ ...inputs, annualSavings: inputs.annualSavings + extra }).finalBalance;
        if (more < base - 1)
          throw new Error(`More savings reduced finalBalance: ${more} < ${base}`);
      }
    ), { numRuns: RUNS });
  });

  it('higher RA balance → final balance never decreases', () => {
    fc.assert(fc.property(
      arbInputs,
      fc.integer({ min: 1, max: 5_000 }).map(n => n * 10_000),
      (inputs, extra) => {
        const base = calculate(inputs).finalBalance;
        const more = calculate({ ...inputs, raBalance: inputs.raBalance + extra }).finalBalance;
        if (more < base - 1)
          throw new Error(`Higher raBalance reduced finalBalance: ${more} < ${base}`);
      }
    ), { numRuns: RUNS });
  });

  it('higher unit trust balance → final balance never decreases', () => {
    fc.assert(fc.property(
      arbInputs,
      fc.integer({ min: 1, max: 5_000 }).map(n => n * 10_000),
      (inputs, extra) => {
        const base = calculate(inputs).finalBalance;
        const more = calculate({ ...inputs, unitTrustBalance: inputs.unitTrustBalance + extra }).finalBalance;
        if (more < base - 1)
          throw new Error(`Higher unitTrustBalance reduced finalBalance: ${more} < ${base}`);
      }
    ), { numRuns: RUNS });
  });

  it('lower income replacement rate → final balance never decreases', () => {
    fc.assert(fc.property(
      arbInputs.filter(i => i.incomeReplacementRate >= 0.2),
      (inputs) => {
        const base = calculate(inputs).finalBalance;
        const less = calculate({ ...inputs, incomeReplacementRate: inputs.incomeReplacementRate - 0.1 }).finalBalance;
        if (less < base - 1)
          throw new Error(`Lower replacement rate reduced finalBalance: ${less} < ${base}`);
      }
    ), { numRuns: RUNS });
  });

  it('variable bonus enabled (no exclusions) → final balance ≥ when disabled', () => {
    fc.assert(fc.property(
      arbInputs.map(i => ({ ...i, variableBonusExclusions: [] })),
      (inputs) => {
        const off = calculate({ ...inputs, variableBonusEnabled: false }).finalBalance;
        const on  = calculate({ ...inputs, variableBonusEnabled: true  }).finalBalance;
        if (on < off - 1)
          throw new Error(`Enabling variable bonus reduced finalBalance: ${on} < ${off}`);
      }
    ), { numRuns: RUNS });
  });

  it('excluding a bonus year never increases the final balance', () => {
    fc.assert(fc.property(
      arbInputs.filter(i => i.retirementAge - i.currentAge >= 2),
      (inputs) => {
        const yw = inputs.retirementAge - inputs.currentAge;
        const yearToExclude = yw - 1;
        const withExcl    = calculate({ ...inputs, variableBonusEnabled: true, variableBonusExclusions: [yearToExclude] }).finalBalance;
        const withoutExcl = calculate({ ...inputs, variableBonusEnabled: true, variableBonusExclusions: [] }).finalBalance;
        if (withExcl > withoutExcl + 1)
          throw new Error(`Excluding a year raised finalBalance: ${withExcl} > ${withoutExcl}`);
      }
    ), { numRuns: RUNS });
  });
});

// ─── 6. Cone of uncertainty ───────────────────────────────────────────────────

describe('calculate — cone of uncertainty', () => {
  it('zero uncertainty collapses all three tracks to identical end balances', () => {
    fc.assert(fc.property(
      arbInputs.map(i => ({
        ...i,
        uncertainty: { returnRate: 0, savingsAmount: 0, savingsGrowth: 0, pensionAmount: 0, pensionGrowth: 0 },
      })),
      (inputs) => {
        const { rows, rowsLow, rowsHigh } = calculate(inputs);
        for (let i = 0; i < rows.length; i++) {
          if (!isClose(rowsLow[i]?.endBalance ?? -1, rows[i].endBalance, 0))
            throw new Error(`rowsLow[${i}].endBalance diverged with zero uncertainty`);
          if (!isClose(rowsHigh[i]?.endBalance ?? -1, rows[i].endBalance, 0))
            throw new Error(`rowsHigh[${i}].endBalance diverged with zero uncertainty`);
        }
      }
    ), { numRuns: RUNS });
  });

  it('high track end balance ≥ base ≥ low at the last accumulation age', () => {
    fc.assert(fc.property(
      arbInputs.filter(i => i.uncertainty.returnRate > 0 || i.uncertainty.savingsAmount > 0),
      (inputs) => {
        const { rows, rowsLow, rowsHigh } = calculate(inputs);
        const lastAccAge = inputs.retirementAge - 1;
        const base = rows.find(r => r.age === lastAccAge);
        const low  = rowsLow.find(r => r.age === lastAccAge);
        const high = rowsHigh.find(r => r.age === lastAccAge);
        if (!base || !low || !high) return; // valid if plan is very short
        if (high.endBalance < base.endBalance - 1)
          throw new Error(`highTrack (${high.endBalance}) < base (${base.endBalance}) at last acc. age`);
        if (base.endBalance < low.endBalance - 1)
          throw new Error(`base (${base.endBalance}) < lowTrack (${low.endBalance}) at last acc. age`);
      }
    ), { numRuns: RUNS });
  });
});

// ─── 7. RA lump sum tax bounds ────────────────────────────────────────────────

describe('calculate — RA lump sum tax', () => {
  it('raLumpSumTaxPaid is always non-negative', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const tax = calculate(inputs).raLumpSumTaxPaid;
      if (tax < 0) throw new Error(`raLumpSumTaxPaid is negative: ${tax}`);
    }), { numRuns: RUNS });
  });

  it('raLumpSumTaxPaid = 0 when all RA-type balances are zero', () => {
    fc.assert(fc.property(
      arbInputs.map(i => ({ ...i, raBalance: 0, cathRaBalance: 0, cathMtnBalance: 0 })),
      (inputs) => {
        const tax = calculate(inputs).raLumpSumTaxPaid;
        if (tax !== 0) throw new Error(`Expected 0 RA tax with no RA balances, got ${tax}`);
      }
    ), { numRuns: RUNS });
  });

  it('higher raBalance → raLumpSumTaxPaid never decreases', () => {
    fc.assert(fc.property(
      arbInputs,
      fc.integer({ min: 1, max: 5_000 }).map(n => n * 10_000),
      (inputs, extra) => {
        const base = calculate(inputs).raLumpSumTaxPaid;
        const more = calculate({ ...inputs, raBalance: inputs.raBalance + extra }).raLumpSumTaxPaid;
        if (more < base - 1)
          throw new Error(`Higher raBalance reduced RA tax: ${more} < ${base}`);
      }
    ), { numRuns: RUNS });
  });
});

// ─── 8. Surplus reinvestment invariants ───────────────────────────────────────

describe('calculate — surplus reinvestment', () => {
  it('availableToInvest and cumulativeReinvestment are always ≥ 0', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs);
      for (const row of rows) {
        if (row.availableToInvest < 0)
          throw new Error(`Age ${row.age}: availableToInvest is negative (${row.availableToInvest})`);
        if (row.cumulativeReinvestment < 0)
          throw new Error(`Age ${row.age}: cumulativeReinvestment is negative (${row.cumulativeReinvestment})`);
      }
    }), { numRuns: RUNS });
  });

  it('pre-retirement rows always report zero available-to-invest and zero reinvestment pot', () => {
    fc.assert(fc.property(arbInputs, (inputs) => {
      const { rows } = calculate(inputs, 0);
      for (const row of rows.filter(r => r.age < inputs.retirementAge)) {
        if (row.availableToInvest !== 0)
          throw new Error(`Age ${row.age}: pre-ret availableToInvest = ${row.availableToInvest}`);
        if (row.cumulativeReinvestment !== 0)
          throw new Error(`Age ${row.age}: pre-ret cumulativeReinvestment = ${row.cumulativeReinvestment}`);
      }
    }), { numRuns: RUNS });
  });

  it('zero surplusReinvestmentRate → cumulativeReinvestment is always zero', () => {
    fc.assert(fc.property(
      arbInputs.map(i => ({ ...i, surplusReinvestmentRate: 0 })),
      (inputs) => {
        const { rows } = calculate(inputs, 100_000);
        for (const row of rows) {
          if (row.cumulativeReinvestment !== 0)
            throw new Error(`Age ${row.age}: cumulativeReinvestment = ${row.cumulativeReinvestment} with rate=0`);
        }
      }
    ), { numRuns: RUNS });
  });

  it('higher reinvestment rate → cumulativeReinvestment at final row is at least as large', () => {
    fc.assert(fc.property(
      arbInputs.filter(i => i.annualIncome > 0 || i.raBalance + i.unitTrustBalance > 0),
      (inputs) => {
        const low  = calculate({ ...inputs, surplusReinvestmentRate: 0.25 }, 0);
        const high = calculate({ ...inputs, surplusReinvestmentRate: 0.75 }, 0);
        const lastLow  = low.rows.at(-1);
        const lastHigh = high.rows.at(-1);
        if (!lastLow || !lastHigh) return;
        if (lastHigh.cumulativeReinvestment < lastLow.cumulativeReinvestment - 1)
          throw new Error(
            `Higher reinvestment rate produced lower pot: ${lastHigh.cumulativeReinvestment} < ${lastLow.cumulativeReinvestment}`
          );
      }
    ), { numRuns: RUNS });
  });
});
