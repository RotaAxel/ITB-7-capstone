import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { User, Lock, Save, ArrowLeft, MapPin, Upload, FileCheck, Clock, CheckCircle2, XCircle } from 'lucide-react'
import api from '@/api/axios'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import Badge from '@/components/ui/Badge'
import DocumentViewerModal from '@/components/DocumentViewerModal'

// Mirrors User::residency_status on the backend.
const RESIDENCY_META = {
  unverified: { label: 'Not Submitted', icon: MapPin,       cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  pending:    { label: 'Pending Review', icon: Clock,        cls: 'bg-[#FEF9E7] text-[#B7950B] border-[#F9E79F]' },
  verified:   { label: 'Verified Cabuyeño', icon: CheckCircle2, cls: 'bg-[#EAFAF1] text-[#1E8449] border-[#A9DFBF]' },
  rejected:   { label: 'Rejected',       icon: XCircle,       cls: 'bg-[#FADBD8] text-[#C0392B] border-[#F1948A]' },
}

export default function ProfilePage() {
  const { user, refreshUser, isClient } = useAuth()
  const navigate = useNavigate()
  const [residencyFile, setResidencyFile] = useState(null)
  const [viewingProof, setViewingProof] = useState(false)

  const [profile, setProfile] = useState({
    full_name:      user?.full_name      ?? '',
    age:            user?.age            ?? '',
    gender:         user?.gender         ?? '',
    address:        user?.address        ?? '',
    contact_number: user?.contact_number ?? '',
  })

  const [passwords, setPasswords] = useState({
    current_password:      '',
    password:              '',
    password_confirmation: '',
  })

  const setP = (k, v) => setProfile(f => ({ ...f, [k]: v }))
  const setPw = (k, v) => setPasswords(f => ({ ...f, [k]: v }))

  const profileMutation = useMutation({
    mutationFn: data => api.put('/auth/profile', data),
    onSuccess: async () => {
      await refreshUser()
      toast.success('Profile updated.')
    },
    onError: err => {
      const errors = err.response?.data?.errors
      if (errors) toast.error(Object.values(errors).flat()[0])
      else toast.error(err.response?.data?.message || 'Failed to update profile.')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: data => api.put('/auth/password', data),
    onSuccess: () => {
      toast.success('Password changed.')
      setPasswords({ current_password: '', password: '', password_confirmation: '' })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to change password.'),
  })

  const residencyMutation = useMutation({
    mutationFn: file => {
      const fd = new FormData()
      fd.append('residency_proof', file)
      return api.post('/auth/residency-proof', fd)
    },
    onSuccess: async () => {
      await refreshUser()
      setResidencyFile(null)
      toast.success('Residency proof submitted — an admin will review it.')
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to submit residency proof.'),
  })

  const handleProfileSave = () => {
    profileMutation.mutate({
      full_name:      profile.full_name,
      age:            profile.age ? Number(profile.age) : null,
      gender:         profile.gender  || null,
      address:        profile.address || null,
      contact_number: profile.contact_number || null,
    })
  }

  const handlePasswordSave = () => {
    if (passwords.password !== passwords.password_confirmation) {
      toast.error('New passwords do not match.')
      return
    }
    if (passwords.password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    passwordMutation.mutate(passwords)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[#1C2833] hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">My Profile</h1>
        <p className="text-[#1C2833] text-sm mt-0.5">Manage your account information</p>
      </div>

      {/* Identity banner */}
      <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4">
        <div className="w-14 h-14 rounded-full bg-[#C0392B] flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-bold">
            {user?.full_name?.[0]?.toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{user?.full_name}</p>
          <p className="text-sm text-[#1C2833] truncate">{user?.email}</p>
        </div>
        <div className="ml-auto shrink-0">
          <Badge status={user?.role} />
        </div>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#1C2833]" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={profile.full_name}
              onChange={e => setP('full_name', e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Age</Label>
              <Input
                type="number"
                min={1}
                max={150}
                value={profile.age}
                onChange={e => setP('age', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Gender</Label>
              <select
                value={profile.gender}
                onChange={e => setP('gender', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] bg-white"
              >
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Contact Number</Label>
            <Input
              value={profile.contact_number}
              onChange={e => setP('contact_number', e.target.value)}
              placeholder="09XX XXX XXXX"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Address</Label>
            <textarea
              rows={2}
              value={profile.address}
              onChange={e => setP('address', e.target.value)}
              placeholder="Brgy. Sala, Cabuyao, Laguna"
              className="mt-1 w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              loading={profileMutation.isPending}
              onClick={handleProfileSave}
            >
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Residency Verification — Cabuyeño residents get a discounted rate on
          facilities that have one configured (see Facility::resident_price_per_hour).
          Uploading proof doesn't grant it by itself; an admin has to review and
          verify it first. Client accounts only — staff/admin don't book facilities. */}
      {isClient && (() => {
        const status = user?.residency_status || 'unverified'
        const meta = RESIDENCY_META[status]
        const Icon = meta.icon
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#1C2833]" /> Residency Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-[#1C2833]">
                Upload a barangay certificate or valid ID showing a Cabuyao address to qualify for the
                discounted Cabuyeño rate on facilities that offer one. An admin reviews it before it
                takes effect.
              </p>

              <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-sm font-medium ${meta.cls}`}>
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" /> {meta.label}
                </span>
                {user?.residency_proof_path && (
                  <Button size="sm" variant="outline" onClick={() => setViewingProof(true)}>
                    View Submitted File
                  </Button>
                )}
              </div>

              {status === 'rejected' && user?.residency_admin_note && (
                <p className="text-xs text-[#C0392B]">Reason: {user.residency_admin_note}</p>
              )}

              {residencyFile ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#A9DFBF] bg-[#EAFAF1]">
                  <span className="flex items-center gap-2 min-w-0 text-sm text-[#1E8449]">
                    <FileCheck className="h-4 w-4 shrink-0" />
                    <span className="truncate">{residencyFile.name}</span>
                  </span>
                  <Button
                    size="sm"
                    loading={residencyMutation.isPending}
                    onClick={() => residencyMutation.mutate(residencyFile)}
                  >
                    Submit
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-lg border-2 border-dashed border-[#E5E7E9] cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="h-5 w-5 text-[#1C2833]" />
                  <span className="text-sm text-[#1C2833]">
                    {user?.residency_proof_path ? 'Click to upload a replacement — PDF, JPG, or PNG (max 5MB)' : 'Click to upload — PDF, JPG, or PNG (max 5MB)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => { const file = e.target.files[0]; if (file) setResidencyFile(file) }}
                  />
                </label>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#1C2833]" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Current Password</Label>
            <Input
              type="password"
              value={passwords.current_password}
              onChange={e => setPw('current_password', e.target.value)}
              placeholder="Enter current password"
              className="mt-1"
            />
          </div>
          <div>
            <Label>New Password</Label>
            <Input
              type="password"
              value={passwords.password}
              onChange={e => setPw('password', e.target.value)}
              placeholder="Min 8 characters"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={passwords.password_confirmation}
              onChange={e => setPw('password_confirmation', e.target.value)}
              placeholder="Repeat new password"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              loading={passwordMutation.isPending}
              onClick={handlePasswordSave}
            >
              <Lock className="h-4 w-4" /> Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {viewingProof && (
        <DocumentViewerModal
          title="Residency Proof"
          url={`/users/${user.id}/residency-proof`}
          filename={`residency-proof-user-${user.id}`}
          onClose={() => setViewingProof(false)}
        />
      )}
    </div>
  )
}
