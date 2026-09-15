import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, MailCheck, ArrowLeft } from 'lucide-react'
import api from '@/api/axios'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import Alert from '@/components/ui/Alert'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

export default function ForgotPassword() {
  const [apiError, setApiError] = useState('')
  const [sent,     setSent]     = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }) => {
    setApiError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setApiError(err.response?.data?.message || 'Something went wrong. Please try again.')
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

          {sent ? (
            <>
              <div className="w-16 h-16 bg-[#D5F5E3] rounded-full flex items-center justify-center mx-auto mb-5">
                <MailCheck className="h-8 w-8 text-[#27AE60]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1C2833] text-center mb-1">Check your email</h2>
              <p className="text-[#1C2833] text-sm text-center mb-2">
                If that email is registered with CABS, we've sent a link to reset your password.
              </p>
              <p className="text-[#1C2833]/70 text-xs text-center">The link expires in 60 minutes.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-[#FADBD8] rounded-full flex items-center justify-center mx-auto mb-5">
                <KeyRound className="h-8 w-8 text-[#C0392B]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1C2833] text-center mb-1">Forgot your password?</h2>
              <p className="text-[#1C2833] text-sm text-center mb-7">
                Enter your account email and we'll send you a link to reset it.
              </p>

              {apiError && <Alert variant="error" className="mb-5">{apiError}</Alert>}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div>
                  <Label htmlFor="email" required>Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    error={!!errors.email}
                    className="focus:border-[#C0392B] focus:ring-[#FADBD8]"
                    {...register('email')}
                  />
                  {errors.email && <p className="mt-1 text-xs text-[#C0392B]">{errors.email.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#C0392B] hover:bg-[#96281B] text-white font-semibold py-2.5 px-6 rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Send reset link
                </button>
              </form>
            </>
          )}

          <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#C0392B] hover:text-[#96281B]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
