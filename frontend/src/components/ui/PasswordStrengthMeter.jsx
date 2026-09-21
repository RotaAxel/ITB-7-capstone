// Scores a password 0-4 by checking length + character-class variety, and
// renders it as a small segmented bar + label. Used anywhere a user sets a new
// password (registration, reset-password) so weak passwords are visible before
// submit, not just rejected after.
const LEVELS = [
  { label: 'Very weak', color: '#C0392B' },
  { label: 'Weak',      color: '#E67E22' },
  { label: 'Fair',      color: '#F1C40F' },
  { label: 'Good',      color: '#2980B9' },
  { label: 'Strong',    color: '#27AE60' },
]

export function scorePassword(password = '') {
  if (!password) return 0
  let score = 0
  if (password.length >= 8)  score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password))              score++
  if (/[^A-Za-z0-9]/.test(password))    score++
  return Math.min(score, LEVELS.length - 1)
}

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null
  const score = scorePassword(password)
  const { label, color } = LEVELS[score]

  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {LEVELS.map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i <= score ? color : '#E5E7E9' }}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] font-medium" style={{ color }}>{label}</p>
    </div>
  )
}
