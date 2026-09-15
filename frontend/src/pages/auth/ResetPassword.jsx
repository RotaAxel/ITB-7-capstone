import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import api from '@/api/axios'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import Alert from '@/components/ui/Alert'

const schema = z.object({
  password:              z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string(),
}).refine(d => d.password === d.password_confirmation, {
  path: ['password_confirmation'],
  message: 'Passwords do not match',
})

export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const params   = new URLSearchParams(location.search)
  const token    = params.get('token') || ''
  const email    = params.get('email') || ''

  const [apiError,  setApiError]  = useState('')
  const [success,   setSuccess]   = useState(false)
  const [showPass,  setShowPass]  = useState(false)
  const [showPass2, setShowPass2] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setApiError('')
    try {
      await api.post('/auth/reset-password', { ...data, token, email })
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      const errors  = err.response?.data?.errors
      setApiError(errors ? Object.values(errors).flat()[0] : (err.response?.data?.message || 'Failed to reset password.'))
    }
  }

  if (!token || !email) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-[#C0392B]/20 backdrop-blur-sm" />
        <div className="relative z-10 bg-white rounded-2xl shadow-xl p-10 text-center max-w-sm w-full border border-[#FADBD8]">
          <h2 className="text-xl font-bold text-[#1C2833] mb-2">Invalid reset link</h2>
          <p className="text-[#1C2833] text-sm mb-6">This password reset link is missing or malformed.</p>
          <Link to="/forgot-password" className="font-semibold text-[#C0392B] hover:text-[#96281B]">Request a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-[#C0392B]/20 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 border border-[#FADBD8]">

          {success ? (
            <>
              <div className="w-16 h-16 bg-[#D5F5E3] rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-8 w-8 text-[#27AE60]" />
              </div>
              <h2 className="text-xl font-bold text-[#1C2833] text-center mb-2">Password reset!</h2>
              <p className="text-[#1C2833] text-sm text-center">Redirecting you to sign in…</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-[#FADBD8] rounded-full flex items-center justify-center mx-auto mb-5">
                <KeyRound className="h-8 w-8 text-[#C0392B]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1C2833] text-center mb-1">Set a new password</h2>
              <p className="text-[#1C2833] text-sm text-center mb-7">for <strong>{email}</strong></p>

              {apiError && <Alert variant="error" className="mb-5">{apiError}</Alert>}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div>
                  <Label htmlFor="password" required>New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min 8 characters"
                      error={!!errors.password}
                      className="pr-10 focus:border-[#C0392B] focus:ring-[#FADBD8]"
                      {...register('password')}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C2833]" tabIndex={-1}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-[#C0392B]">{errors.password.message}</p>}
                </div>

                <div>
                  <Label htmlFor="password_confirmation" required>Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="password_confirmation"
                      type={showPass2 ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      error={!!errors.password_confirmation}
                      className="pr-10 focus:border-[#C0392B] focus:ring-[#FADBD8]"
                      {...register('password_confirmation')}
                    />
                    <button type="button" onClick={() => setShowPass2(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C2833]" tabIndex={-1}>
                      {showPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password_confirmation && <p className="mt-1 text-xs text-[#C0392B]">{errors.password_confirmation.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#C0392B] hover:bg-[#96281B] text-white font-semibold py-2.5 px-6 rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Reset password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
