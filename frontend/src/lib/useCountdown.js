import { useEffect, useState } from 'react'

export function useCountdown(initialSeconds) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timeoutId = setTimeout(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [secondsLeft])

  function restart() {
    setSecondsLeft(initialSeconds)
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`

  return { secondsLeft, isExpired: secondsLeft <= 0, restart, formatted }
}