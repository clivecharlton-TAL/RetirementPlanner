<script lang="ts">
  import type { ProjectionResult } from '../lib/types';
  import { formatZAR, formatZARCompact } from '../lib/formatter';

  export let result: ProjectionResult;

  $: success = result.successAge !== null;
  $: hasCap = result.rows.some((r) => r.drawdownCapped && r.drawdownCapType === 'max');
  $: capCount = result.rows.filter((r) => r.drawdownCapped && r.drawdownCapType === 'max').length;
  $: firstCapAge = result.rows.find((r) => r.drawdownCapped && r.drawdownCapType === 'max')?.age ?? null;
  $: raTax = result.raLumpSumTaxPaid;
</script>

<div class="banner" class:success class:failure={!success}>
  {#if success}
    <span class="icon">✓</span>
    <div class="text">
      <strong>Congratulations</strong> — at age {result.successAge}, you will still have
      <strong>{formatZAR(result.finalBalance)}</strong> remaining.
      {#if raTax > 0}
        <span class="ra-tax">
          RA lump sum tax at retirement: <strong>{formatZAR(raTax)}</strong>
          (applied to 1/3 of RA balance converted to cash).
        </span>
      {/if}
      {#if hasCap}
        <span class="cap-warn">
          ⚠ FSCA 17.5% drawdown cap applied across {capCount} retirement year{capCount !== 1 ? 's' : ''},
          starting at age {firstCapAge}. Actual income will be capped at 17.5% of the living annuity value.
        </span>
      {/if}
    </div>
  {:else}
    <span class="icon">!</span>
    <div class="text">
      <strong>Your plan runs out at age {result.failureAge}.</strong>
      Consider adjusting your inputs — increase savings, reduce income replacement, or delay retirement.
      {#if raTax > 0}
        <span class="ra-tax">
          Note: RA lump sum tax of {formatZAR(raTax)} was applied at retirement.
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0.75rem;
    border-radius: var(--radius);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .success {
    background: var(--green-light);
    border-left: 4px solid var(--green);
    color: var(--green);
  }

  .failure {
    background: var(--red-light);
    border-left: 4px solid var(--red);
    color: var(--red);
  }

  .icon {
    font-size: 1rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .text {
    flex: 1;
  }

  .text strong { font-weight: 600; }

  .ra-tax {
    display: block;
    margin-top: 0.3rem;
    color: var(--gray);
    font-size: 0.78rem;
  }

  .cap-warn {
    display: block;
    margin-top: 0.3rem;
    color: var(--amber);
    font-size: 0.78rem;
  }
</style>
