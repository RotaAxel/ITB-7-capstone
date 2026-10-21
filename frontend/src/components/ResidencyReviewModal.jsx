import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Label from '@/components/ui/Label'
import { RESIDENCY_META } from '@/constants/residency'

// Shared by the staff-facing full User Management page (AdminUsers.jsx) and
// the admin-facing residency-only review page (AdminResidencyVerification.jsx)
// — same review UI and PUT /admin/users/{id}/residency call either way, just
// reached from a different page depending on role.
export default function ResidencyReviewModal({ user, onClose, onUpdated }) {
  const [preview, setPreview] = useState(null) // { url, mimeType } | null
  // Starts true whenever there's a proof to fetch — set false only inside the
  // async .finally() below, never synchronously in the effect body itself.
  const [loading, setLoading] = useState(Boolean(user.residency_proof_path))
  const [note,    setNote]    = useState(user.residency_admin_note ?? '')

  useEffect(() => {
    if (!user.residency_proof_path) return
    let cancelled = false
    api.get(`/users/${user.id}/residency-proof`, { responseType: 'blob' })
      .then(res => { if (!cancelled) setPreview({ url: URL.createObjectURL(res.data), mimeType: res.data.type }) })
      .catch(() => toast.error('Failed to load the residency proof.'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  // Revokes the object URL on every path out of this modal (Escape, backdrop
  // click, X button, Close button, or a successful verify/reject all funnel
  // through here via Modal's single onClose prop or this same handler).
  const handleClose = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    onClose()
  }

  const downloadProof = () => {
    if (!preview) return
    const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[preview.mimeType] || 'bin'
    const a = document.createElement('a')
    a.href = preview.url
    a.download = `residency-proof-user-${user.id}.${ext}`
    a.click()
  }

  const verifyMutation = useMutation({
    mutationFn: status => api.put(`/admin/users/${user.id}/residency`, { status, note }),
    onSuccess: () => {
      toast.success('Residency status updated.')
      onUpdated?.()
      handleClose()
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to update residency status.'),
  })

  return (
    <Modal
      title={`Residency Proof — ${user.full_name}`}
      onClose={handleClose}
      size="2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-medium ${RESIDENCY_META[user.residency_status].cls}`}>
            Current status: {RESIDENCY_META[user.residency_status].label}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Close</Button>
            <Button
              variant="danger"
              loading={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate('rejected')}
            >
              Reject
            </Button>
            <Button
              loading={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate('verified')}
              className="bg-[#1E8449] hover:bg-[#196F3D]"
            >
              Verify as Cabuyeño
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : preview ? (
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-sm text-[#1C2833]">Submitted document:</p>
            <Button size="sm" variant="outline" onClick={downloadProof}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        ) : null}

        {!loading && preview && (
          preview.mimeType === 'application/pdf' ? (
            <iframe
              src={preview.url}
              title="Residency proof"
              className="w-full h-[60vh] rounded-lg border border-[#E5E7E9]"
            />
          ) : (
            <img
              src={preview.url}
              alt="Residency proof"
              className="max-w-full max-h-[60vh] w-auto h-auto object-contain mx-auto block rounded-lg border border-[#E5E7E9]"
            />
          )
        )}

        <div>
          <Label>Note (shown to the client if rejected)</Label>
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Document is unreadable, or doesn't show a Cabuyao address."
            className="mt-1 w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none"
          />
        </div>
      </div>
    </Modal>
  )
}
