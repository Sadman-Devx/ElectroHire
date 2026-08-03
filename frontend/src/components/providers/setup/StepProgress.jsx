/**
 * "Step X of Y" label + progress bar — Day 5 spec: "Step Indicator
 * (Step 2 of 2 + Progress Bar)".
 */
function StepProgress({ currentStep, totalSteps, label }) {
  const clampedStep = Math.min(Math.max(currentStep, 0), totalSteps)
  const percent = totalSteps > 0 ? Math.round((clampedStep / totalSteps) * 100) : 0

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Step {currentStep} of {totalSteps}
          {label ? <> — {label}</> : null}
        </p>
        <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{percent}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Setup progress: ${label || 'step ' + currentStep} `}
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export { StepProgress }