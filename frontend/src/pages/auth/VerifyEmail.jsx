import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MailCheck, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Alert from '@/components/ui/Alert'

export default function VerifyEmail() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { verifyEmail, resendVerificationCode } = useAuth()

  const email = new URLSearchParams(location.search).get('email') || location.state?.email || ''

  const [digits,     setDigits]     = useState(['', '', '', '', '', ''])
  const [apiError,   setApiError]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending,  setResending]  = useState(false)
  const [cooldown,   setCooldown]   = useState(0)
  const inputRefs = useRef([])

  useEffect(() => {
    if (!email) navigate('/login', { replace: true })
  }, [email, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleDigitChange = (i, value) => {
    const v = value.replace(/\D/g, '').slice(-1)
    setDigits(d => { const next = [...d]; next[i] = v; return next })
    if (v && i < 5) inputRefs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    setDigits(pasted.padEnd(6, '').split('').slice(0, 6))
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }

  const code = digits.join('')

  const onSubmit = async (e) => {
    e.preventDefault()
    if (code.length !== 6) {
      setApiError('Enter the 6-digit code from your email.')
      return
    }
    setApiError('')
    setSubmitting(true)
    const result = await verifyEmail(email, code)
    setSubmitting(false)

    if (!result.success) {
      setApiError(result.message)
      return
    }

    toast.success('Email verified! Welcome to CABS.')
    const role = result.user.role
    if (role === 'administrator')    navigate('/admin/dashboard', { replace: true })
    else if (role === 'staff')       navigate('/staff/dashboard', { replace: true })
    else                             navigate('/dashboard', { replace: true })
  }

  const onResend = async () => {
    setResending(true)
    const result = await resendVerificationCode(email)
    setResending(false)
    if (result.success) {
      toast.success(result.message)
      setCooldown(60)
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-[#C0392B]/20 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 border border-[#FADBD8]">
          <div className="w-16 h-16 bg-[#FADBD8] rounded-full flex items-center justify-center mx-auto mb-5">
            <MailCheck className="h-8 w-8 text-[#C0392B]" />
          </div>

          <h2 className="text-2xl font-bold text-[#1C2833] text-center mb-1">Verify your email</h2>
          <p className="text-[#1C2833] text-sm text-center mb-7">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
          </p>

          {apiError && <Alert variant="error" className="mb-5">{apiError}</Alert>}

          <form onSubmit={onSubmit} noValidate>
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-lg border border-[#E5E7E9] focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B]"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-[#C0392B] hover:bg-[#96281B] text-white font-semibold py-2.5 px-6 rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Verify account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#1C2833]">
            Didn&apos;t get a code?{' '}
            <button
              type="button"
              onClick={onResend}
              disabled={resending || cooldown > 0}
              className="font-semibold text-[#C0392B] hover:text-[#96281B] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
            </button>
          </p>

          <p className="mt-4 text-center text-xs text-[#1C2833]/70">
            Wrong email?{' '}
            <Link to="/register" className="font-semibold text-[#C0392B] hover:text-[#96281B]">Start over</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
