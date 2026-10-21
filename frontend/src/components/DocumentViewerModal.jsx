import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

const EXT_BY_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

// Generic inline preview for any blob-served document — contracts,
// authorization/request letters, residency proofs — so clients can look at
// what they're about to download before committing to a file on disk, the
// same way "View Receipt" already works. PDFs render in an iframe, images in
// an <img>; Download stays available in the footer either way.
export default function DocumentViewerModal({ title, url, filename, onClose }) {
  const [doc, setDoc] = useState(null) // { url, mimeType } | null
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get(url, { responseType: 'blob' })
      .then(res => { if (!cancelled) setDoc({ url: URL.createObjectURL(res.data), mimeType: res.data.type }) })
      .catch(() => { if (!cancelled) { setFailed(true); toast.error('Failed to load the document.') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])

  const handleClose = () => {
    if (doc) URL.revokeObjectURL(doc.url)
    onClose()
  }

  const download = () => {
    if (!doc) return
    const ext = EXT_BY_MIME[doc.mimeType] || 'bin'
    const a = document.createElement('a')
    a.href = doc.url
    a.download = `${filename}.${ext}`
    a.click()
  }

  return (
    <Modal
      title={title}
      onClose={handleClose}
      size="xl"
      footer={
        <div className="flex justify-between items-center">
          <p className="text-xs text-[#1C2833]">Keep a copy for your records.</p>
          <Button variant="outline" onClick={download} disabled={!doc} className="flex items-center gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      }
    >
      {loading && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}
      {!loading && failed && <p className="text-center text-red-500 py-6">Failed to load the document.</p>}
      {!loading && doc && (
        doc.mimeType === 'application/pdf' ? (
          <iframe src={doc.url} title={title} className="w-full h-[70vh] rounded-lg border border-[#E5E7E9]" />
        ) : (
          <img src={doc.url} alt={title} className="max-w-full max-h-[70vh] w-auto h-auto object-contain mx-auto block rounded-lg border border-[#E5E7E9]" />
        )
      )}
    </Modal>
  )
}
