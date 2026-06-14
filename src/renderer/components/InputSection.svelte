<script lang="ts">
  export let title: string;
</script>

<section>
  <h2>{title}</h2>
  <div class="content">
    <slot />
  </div>
</section>

<style>
  section {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    font-family: var(--sans);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gray);
    margin-bottom: 0.5rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
</style>
