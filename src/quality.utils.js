// Focus is requested only after a failed submission, never on every keystroke.
export function focusFirstInvalid(form) {
  const field = form?.querySelector('[aria-invalid="true"]:not(:disabled)')
  field?.focus()
  return Boolean(field)
}

export function formatProgressPercent(percent) {
  if (percent > 0 && percent < 0.1) return '< 0,1'
  if (percent < 100 && percent > 99.9) return '> 99,9'
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(percent)
}
