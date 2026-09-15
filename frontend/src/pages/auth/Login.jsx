import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import Input  from '@/components/ui/Input'
import Label  from '@/components/ui/Label'
import Alert  from '@/components/ui/Alert'
import { Eye, EyeOff, LogIn } from 'lucide-react'

const schema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login } = useAuth()
  const [apiError, setApiError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email, password }) => {
    setApiError('')
    const result = await login(email, password)

    if (!result.success) {
      if (result.needsVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`, { replace: true })
        return
      }
      setApiError(result.message)
      return
    }

    const role = result.user.role
    const from  = location.state?.from?.pathname

    if (from && from !== '/login') {
      navigate(from, { replace: true })
    } else if (role === 'administrator') {
      navigate('/admin/dashboard', { replace: true })
    } else if (role === 'staff') {
      navigate('/staff/dashboard', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-[#C0392B]/20 backdrop-blur-sm" />

      {/* Split card */}
      <div className="relative z-10 w-full max-w-4xl flex rounded-2xl shadow-2xl overflow-hidden">

        {/* Left panel — BEIGE */}
        <div className="hidden md:flex md:w-5/12 flex-col items-center justify-center p-10 bg-[#C0392B] relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute top-1/2 right-4 w-4 h-4 bg-[#C0392B] rounded-full opacity-20" />

          <div className="relative z-10 text-center">
            <div className="w-40 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg p-2.5 border border-[#FADBD8]">
              <img src="/logoCabs.png" alt="CABS — Cabuyao Athletes Basic School" className="w-full h-full object-contain" />
            </div>
            <p className="text-white/70 text-sm max-w-[220px] mx-auto leading-relaxed">
              Online facility reservation — book sports facilities anytime, anywhere.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {[
                ['Fast',     'Instant confirmation'],
                ['Booking',  'Reserve in seconds'],
                ['Security', 'Protected payments'],
              ].map(([title, sub]) => (
                <div key={title} className="bg-white rounded-xl p-3 border border-[#FADBD8] shadow-sm">
                  <p className="text-[#C0392B] font-bold text-sm">{title}</p>
                  <p className="text-[#1C2833] text-xs mt-1 leading-snug">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — WHITE */}
        <div className="flex-1 bg-white flex items-center justify-center p-8">
          <div className="w-full max-w-sm">

            {/* Mobile logo */}
            <div className="md:hidden text-center mb-6">
              <div className="w-28 h-16 bg-[#FADBD8] rounded-xl flex items-center justify-center mx-auto mb-3 shadow p-1.5 border border-[#FADBD8]">
                <img src="/logoCabs.png" alt="CABS — Cabuyao Athletes Basic School" className="w-full h-full object-contain" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-[#1C2833] mb-1">Welcome back</h2>
            <p className="text-[#1C2833] text-sm mb-7">Sign in to your CABS account</p>

            {apiError && (
              <Alert variant="error" className="mb-5">{apiError}</Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              <div>
                <Label htmlFor="email" required>Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  error={!!errors.email}
                  className="focus:border-[#C0392B] focus:ring-[#EDE4CC]"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-[#C0392B]">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" required>Password</Label>
                  <Link to="/forgot-password" className="text-xs font-medium text-[#C0392B] hover:text-[#96281B]">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    error={!!errors.password}
                    className="pr-10 focus:border-[#C0392B] focus:ring-[#EDE4CC]"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C2833] hover:text-[#1C2833]"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-[#C0392B]">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#C0392B] hover:bg-[#96281B] text-white font-semibold py-2.5 px-6 rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Sign in
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#1C2833]">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-[#C0392B] hover:text-[#96281B]">
                Create one
              </Link>
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
