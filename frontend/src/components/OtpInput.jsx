import { useRef } from 'react'

function OtpInput({ length = 6, value, onChange, disabled = false, error = false }) {
  const inputRefs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  function setDigitAt(index, digit) {
    const next = digits.slice()
    next[index] = digit
    onChange(next.join(''))
  }

  function focusInput(index) {
    inputRefs.current[index]?.focus()
    inputRefs.current[index]?.select()
  }

  function handleChange(index, rawValue) {
    const cleaned = rawValue.replace(/\D/g, '')
    if (!cleaned) {
      setDigitAt(index, '')
      return
    }
    const digit = cleaned[cleaned.length - 1]
    setDigitAt(index, digit)
    if (index < length - 1) focusInput(index + 1)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        setDigitAt(index, '')
        return
      }
      if (index > 0) {
        event.preventDefault()
        setDigitAt(index - 1, '')
        focusInput(index - 1)
      }
      return
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusInput(index - 1)
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault()
      focusInput(index + 1)
    }
  }

  function handlePaste(event) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted)
    focusInput(Math.min(pasted.length, length - 1))
  }

  return (
    <div className="flex justify-center gap-2.5" role="group" aria-label="6-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-invalid={error || undefined}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            'w-11 rounded-[var(--radius-input)] border bg-[var(--color-surface)] text-center text-xl font-semibold text-[var(--color-text)]',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]'
              : 'border-[var(--color-border)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]',
          ].join(' ')}
          style={{ height: '52px' }}
        />
      ))}
    </div>
  )
}

export { OtpInput }