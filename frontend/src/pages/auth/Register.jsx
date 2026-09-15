import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import Input  from '@/components/ui/Input'
import Label  from '@/components/ui/Label'
import Alert  from '@/components/ui/Alert'
import { CheckCircle2, Eye, EyeOff, UserPlus } from 'lucide-react'

const schema = z.object({
  full_name:             z.string().min(2, 'Full name must be at least 2 characters'),
  email:                 z.string().email('Invalid email address'),
  password:              z.string().min(8, 'Password must be at least 8 characters'),
  password_confirmation: z.string(),
  age:                   z.coerce.number().int().min(5).max(150).optional().or(z.literal('')),
  gender:                z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  address:               z.string().optional(),
  contact_number:        z.string().max(20).optional(),
}).refine(d => d.password === d.password_confirmation, {
  path: ['password_confirmation'],
  message: 'Passwords do not match',
})

export default function Register() {
  const navigate    = useNavigate()
  const { register: authRegister } = useAuth()
  const [apiError,  setApiError]   = useState('')
  const [success,   setSuccess]    = useState(false)
  const [showPass,  setShowPass]   = useState(false)
  const [showPass2, setShowPass2]  = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setApiError('')
    const payload = {
      ...data,
      age:    data.age    || undefined,
      gender: data.gender || undefined,
    }
    const result = await authRegister(payload)

    if (!result.success) {
      const firstError = result.errors
        ? Object.values(result.errors).flat()[0]
        : result.message
      setApiError(firstError)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(result.email)}`, { replace: true }), 1500)
  }

  const inputFocus = 'focus:border-[#C0392B] focus:ring-[#FADBD8]'
  const errText    = 'mt-1 text-xs text-[#C0392B]'

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-[#C0392B]/20 backdrop-blur-sm" />
        <div className="relative z-10 bg-white rounded-2xl shadow-xl p-10 text-center max-w-sm w-full border border-[#FADBD8]">
          <div className="w-16 h-16 bg-[#D5F5E3] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-[#27AE60]" />
          </div>
          <h2 className="text-xl font-bold text-[#1C2833] mb-2">Registration Successful!</h2>
          <p className="text-[#1C2833] text-sm">Redirecting you to verify your email…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-[#C0392B]/20 backdrop-blur-sm" />

      {/* Split card */}
      <div className="relative z-10 w-full max-w-4xl flex rounded-2xl shadow-2xl overflow-hidden my-6">

        {/* Left panel — red */}
        <div className="hidden md:flex md:w-5/12 flex-col items-center justify-center p-10 bg-[#C0392B] relative overflow-hidden flex-shrink-0">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-white/10 rounded-full" />

          <div className="relative z-10 text-center">
            <div className="w-40 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg p-2.5 border border-white/20">
              <img src="/logoCabs.png" alt="CABS — Cabuyao Athletes Basic School" className="w-full h-full object-contain" />
            </div>
            <p className="text-white/60 text-xs max-w-[200px] mx-auto leading-relaxed">
              Create your account and start reserving sports facilities today.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {[['Free', 'No sign-up fee'], ['Fast', 'Book in minutes'], ['Easy', 'Simple steps']].map(([title, sub]) => (
                <div key={title} className="bg-white rounded-xl p-3 border border-white/20 shadow-sm">
                  <p className="text-[#C0392B] font-bold text-xs">{title}</p>
                  <p className="text-[#1C2833] text-[10px] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — white, scrollable */}
        <div className="flex-1 bg-white flex items-start justify-center p-8 overflow-y-auto max-h-screen">
          <div className="w-full max-w-sm py-2">

            {/* Mobile logo */}
            <div className="md:hidden text-center mb-6">
              <div className="w-28 h-16 bg-[#FADBD8] rounded-xl flex items-center justify-center mx-auto mb-3 shadow p-1.5 border border-[#FADBD8]">
                <img src="/logoCabs.png" alt="CABS — Cabuyao Athletes Basic School" className="w-full h-full object-contain" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-[#1C2833] mb-1">Create your account</h2>
            <p className="text-[#1C2833] text-sm mb-7">Join CABS and reserve facilities online</p>

            {apiError && (
              <Alert variant="error" className="mb-5">{apiError}</Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

              <div>
                <Label htmlFor="full_name" required>Full name</Label>
                <Input id="full_name" placeholder="Juan dela Cruz" error={!!errors.full_name} className={inputFocus} {...register('full_name')} />
                {errors.full_name && <p className={errText}>{errors.full_name.message}</p>}
              </div>

              <div>
                <Label htmlFor="email" required>Email address</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" error={!!errors.email} className={inputFocus} {...register('email')} />
                {errors.email && <p className={errText}>{errors.email.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password" required>Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min 8 characters"
                      error={!!errors.password}
                      className={`pr-10 ${inputFocus}`}
                      {...register('password')}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C2833] hover:text-[#1C2833]" tabIndex={-1}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className={errText}>{errors.password.message}</p>}
                </div>
                <div>
                  <Label htmlFor="password_confirmation" required>Confirm</Label>
                  <div className="relative">
                    <Input
                      id="password_confirmation"
                      type={showPass2 ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      error={!!errors.password_confirmation}
                      className={`pr-10 ${inputFocus}`}
                      {...register('password_confirmation')}
                    />
                    <button type="button" onClick={() => setShowPass2(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C2833] hover:text-[#1C2833]" tabIndex={-1}>
                      {showPass2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password_confirmation && <p className={errText}>{errors.password_confirmation.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">Age <span className="text-[#1C2833] font-normal">(Optional)</span></Label>
                  <Input id="age" type="number" min="5" max="150" placeholder="22" error={!!errors.age} className={inputFocus} {...register('age')} />
                  {errors.age && <p className={errText}>{errors.age.message}</p>}
                </div>
                <div>
                  <Label htmlFor="gender">Gender <span className="text-[#1C2833] font-normal">(Optional)</span></Label>
                  <select
                    id="gender"
                    className="block w-full rounded-lg border border-[#FADBD8] px-3 py-2 text-sm text-[#1C2833] bg-white focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B]"
                    {...register('gender')}
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="contact_number">Contact number</Label>
                <Input id="contact_number" type="tel" placeholder="09XX XXX XXXX" error={!!errors.contact_number} className={inputFocus} {...register('contact_number')} />
                {errors.contact_number && <p className={errText}>{errors.contact_number.message}</p>}
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <textarea
                  id="address"
                  rows={2}
                  placeholder="Brgy. Sala, Cabuyao, Laguna"
                  className="block w-full rounded-lg border border-[#FADBD8] px-3 py-2 text-sm text-[#1C2833] bg-white placeholder-[#717D7E] focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none"
                  {...register('address')}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#C0392B] hover:bg-[#96281B] text-white font-semibold py-2.5 px-6 rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Create account
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#1C2833]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#C0392B] hover:text-[#96281B]">Sign in</Link>
            </p>

            <p className="text-center text-xs text-[#1C2833]/60 mt-6">
              © {new Date().getFullYear()} Cabuyao Athletes Basic School
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
