import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import {
  Building2, Calendar, Users, Lock, MapPin, Clock,
  CheckCircle2, ArrowRight, Star, Shield, Zap,
} from 'lucide-react'
import Badge from '@/components/ui/Badge'

function getSportTheme(name = '') {
  const n = name.toLowerCase()
  if (n.includes('basketball'))                          return { color: '#E97316', dark: '#C2410C', label: 'Basketball Court' }
  if (n.includes('volleyball'))                          return { color: '#3B82F6', dark: '#1D4ED8', label: 'Volleyball Court'  }
  if (n.includes('swim') || n.includes('pool'))          return { color: '#06B6D4', dark: '#0E7490', label: 'Swimming Pool'    }
  if (n.includes('track') || n.includes('athlet') || n.includes('run')) return { color: '#22C55E', dark: '#15803D', label: 'Athletics Track' }
  if (n.includes('football') || n.includes('soccer'))   return { color: '#16A34A', dark: '#14532D', label: 'Football Field'   }
  if (n.includes('badminton'))                           return { color: '#9333EA', dark: '#7E22CE', label: 'Badminton Court'  }
  if (n.includes('tennis'))                              return { color: '#84CC16', dark: '#4D7C0F', label: 'Tennis Court'     }
  if (n.includes('baseball'))                            return { color: '#78350F', dark: '#451A03', label: 'Baseball Field'  }
  if (n.includes('gym') || n.includes('gymnasium') || n.includes('multi')) return { color: '#6366F1', dark: '#4338CA', label: 'Gymnasium' }
  if (n.includes('field'))                               return { color: '#2E8B57', dark: '#1F5C3A', label: 'Open Field'      }
  return { color: '#C0392B', dark: '#96281B', label: 'Sports Facility' }
}

function FacilityPlaceholder({ name }) {
  const theme = getSportTheme(name)
  return (
    <div className="w-full h-full flex flex-col items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.dark})` }}>
      <Building2 className="h-10 w-10 text-white/60 mb-2" />
      <p className="text-white text-xs font-semibold">{theme.label}</p>
    </div>
  )
}

const STEPS = [
  { icon: Building2, step: '01', title: 'Browse Facilities', desc: 'Explore all available sports facilities, schedules, and amenities — no account needed.' },
  { icon: Users,     step: '02', title: 'Create an Account', desc: 'Register for free in minutes to unlock full access to the reservation system.'          },
  { icon: Calendar,  step: '03', title: 'Book & Pay Online',  desc: 'Choose your preferred date and time, then complete payment securely through PayMongo.'  },
]

const FEATURES = [
  { icon: Zap,          title: 'Instant Booking',      desc: 'Reserve a facility in under 2 minutes with our streamlined booking flow.'           },
  { icon: Shield,       title: 'Secure Payments',      desc: 'Payments are processed safely via PayMongo — GCash, Maya, card, and more.'         },
  { icon: Calendar,     title: 'Live Availability',    desc: 'See real-time availability before you book — no double-bookings ever.'             },
  { icon: CheckCircle2, title: 'Instant Confirmation', desc: 'Get an instant confirmation and downloadable receipt right after your payment.'    },
  { icon: Star,         title: 'Managed Amenities',    desc: 'Each facility lists its available equipment and amenities so you come prepared.'   },
  { icon: Users,        title: 'Multi-role Access',    desc: 'Clients book, staff manage schedules, and admins oversee everything in one system.' },
]

export default function GuestPage() {
  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['public', 'facilities'],
    queryFn: () => api.get('/public/facilities').then(r => r.data),
  })

  return (
    <div className="min-h-screen bg-white text-[#1C2833]">

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E5E7E9] shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logoCabs.png" alt="CABS" className="h-9 w-auto object-contain" />
            <p className="text-[10px] text-[#1C2833] leading-none">Reservation System</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"
              className="text-sm font-medium text-[#1C2833] hover:text-[#C0392B] transition-colors px-3 py-1.5">
              Sign In
            </Link>
            <Link to="/register"
              className="text-sm font-semibold bg-[#C0392B] hover:bg-[#96281B] text-white px-4 py-2 rounded-lg transition-colors">
              Register Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Facilities ───────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-[#1C2833]">Our Facilities</h1>
              <p className="text-[#1C2833] text-sm mt-1">Browse all available sports facilities</p>
            </div>
            <Link to="/register" className="text-sm text-[#C0392B] font-semibold hover:underline flex items-center gap-1">
              Register to book <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-[#F2F3F4] animate-pulse rounded-2xl h-64" />
              ))}
            </div>
          ) : facilities.length === 0 ? (
            <div className="text-center py-16 text-[#1C2833]">No facilities available at the moment.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {facilities.map(facility => (
                <div key={facility.id} className="bg-white rounded-2xl border border-[#E5E7E9] overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                  {/* Image */}
                  <div className="h-44 relative overflow-hidden">
                    {facility.image_url ? (
                      <img src={facility.image_url} alt={facility.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <FacilityPlaceholder name={facility.name} />
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge status={facility.status} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-[#1C2833] mb-1">{facility.name}</h3>

                    {facility.location && (
                      <p className="text-xs text-[#1C2833] flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-[#C0392B]" /> {facility.location}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-[#1C2833] mb-3">
                      {facility.capacity && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {facility.capacity} max
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> ₱{Number(facility.price_per_hour).toLocaleString()}/hr
                      </span>
                    </div>

                    {facility.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {facility.amenities.slice(0, 3).map(a => (
                          <span key={a.id} className="text-[10px] bg-[#F2F3F4] text-[#1C2833] px-2 py-0.5 rounded-full">{a.name}</span>
                        ))}
                        {facility.amenities.length > 3 && (
                          <span className="text-[10px] text-[#1C2833] py-0.5">+{facility.amenities.length - 3} more</span>
                        )}
                      </div>
                    )}

                    {/* Locked reserve button */}
                    <Link to="/register"
                      className="w-full flex items-center justify-center gap-2 bg-[#FADBD8] hover:bg-[#C0392B] text-[#C0392B] hover:text-white font-semibold py-2 rounded-lg text-sm transition-colors group/btn">
                      <Lock className="h-3.5 w-3.5 group-hover/btn:hidden" />
                      <span className="group-hover/btn:hidden">Login to Reserve</span>
                      <span className="hidden group-hover/btn:flex items-center gap-1.5">Register Now <ArrowRight className="h-3.5 w-3.5" /></span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[#FADBD8]/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-[#1C2833]">How It Works</h2>
            <p className="text-[#1C2833] text-sm mt-2">Get started in three simple steps</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 bg-[#C0392B] rounded-2xl mb-4 shadow-md">
                  <Icon className="h-7 w-7 text-white" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-white border-2 border-[#C0392B] rounded-full flex items-center justify-center text-[10px] font-black text-[#C0392B]">{step}</span>
                </div>
                <h3 className="font-bold text-[#1C2833] mb-2">{title}</h3>
                <p className="text-[#1C2833] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Schedule preview ─────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[#FADBD8]/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-[#1C2833]">Facility Schedules</h2>
            <p className="text-[#1C2833] text-sm mt-2">
              Check when facilities are open. Register to see real-time availability and book your slot.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7E9] overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-[#C0392B] px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Weekly Schedule Overview</h3>
              <span className="text-white/70 text-xs">Mon – Sun</span>
            </div>

            {/* Schedule grid */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-[#F2F3F4] border-b border-[#E5E7E9]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#1C2833]">Facility</th>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <th key={d} className="px-3 py-3 text-center text-xs font-semibold text-[#1C2833]">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7E9]">
                  {facilities.slice(0, 5).map(f => (
                    <tr key={f.id} className="hover:bg-[#FADBD8]/10 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[#1C2833] text-xs">{f.name}</p>
                        {f.location && <p className="text-[10px] text-[#1C2833]">{f.location}</p>}
                      </td>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        <td key={d} className="px-3 py-3 text-center">
                          {f.status === 'available' ? (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#27AE60]" title="Available" />
                          ) : f.status === 'under_maintenance' ? (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F39C12]" title="Maintenance" />
                          ) : (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#E5E7E9]" title="Unavailable" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {facilities.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-[#1C2833] text-sm">No facilities available</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer — locked CTA */}
            <div className="px-6 py-4 border-t border-[#E5E7E9] bg-[#FADBD8]/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#27AE60]" /><span className="text-xs text-[#1C2833]">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]" /><span className="text-xs text-[#1C2833]">Maintenance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7E9]" /><span className="text-xs text-[#1C2833]">Unavailable</span>
                </div>
              </div>
              <Link to="/register"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#C0392B] hover:underline">
                <Lock className="h-3 w-3" /> Register to see live booking slots
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-[#1C2833]">Everything You Need</h2>
            <p className="text-[#1C2833] text-sm mt-2">A complete facility management and reservation platform</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border border-[#E5E7E9] rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-[#FADBD8] rounded-xl flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-[#C0392B]" />
                </div>
                <h3 className="font-bold text-[#1C2833] text-sm mb-1">{title}</h3>
                <p className="text-[#1C2833] text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Restricted features notice ───────────────────────────────────── */}
      <section className="py-10 px-6 bg-[#1C2833]">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#FADBD8]" /> Features available after registration
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['Online Booking & Reservations', 'Secure Online Payment', 'Booking History & Receipts', 'Real-time Notifications'].map(f => (
              <div key={f} className="flex items-start gap-2 bg-white/5 rounded-xl px-4 py-3">
                <Lock className="h-3.5 w-3.5 text-[#FADBD8] mt-0.5 flex-shrink-0" />
                <p className="text-white/70 text-xs leading-snug">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#C0392B] text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-white mb-3">Ready to Book?</h2>
          <p className="text-white/80 text-sm mb-8 leading-relaxed">
            Create your free account and start reserving CABS sports facilities online in minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/register"
              className="flex items-center gap-2 bg-white text-[#C0392B] font-bold px-8 py-3 rounded-xl hover:bg-[#FADBD8] transition-colors shadow-lg text-sm">
              Create Free Account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login"
              className="text-white/80 hover:text-white text-sm font-medium underline underline-offset-2 transition-colors">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-[#E5E7E9] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logoCabs.png" alt="CABS" className="h-9 w-auto object-contain" />
            <div>
              <p className="font-bold text-[#C0392B] text-sm">CABS</p>
              <p className="text-[10px] text-[#1C2833]">Cabuyao Athletes Basic School</p>
            </div>
          </div>
          <p className="text-xs text-[#1C2833]">
            © {new Date().getFullYear()} Cabuyao Athletes Basic School. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#1C2833]">
            <Link to="/terms" className="hover:text-[#C0392B] transition-colors">Terms &amp; Conditions</Link>
            <Link to="/login" className="hover:text-[#C0392B] transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-[#C0392B] transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
