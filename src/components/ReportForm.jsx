// src/components/ReportForm.jsx
import React, { useEffect, useState } from 'react'
import LocationIQAutocomplete from './LocationIQAutocomplete'
import { apiUrl } from '../utils/api' // <- added: use absolute backend URLs

function generateCaptcha() {
  return Math.floor(1000 + Math.random() * 9000)
}

export default function ReportForm({ onAddReport }) {
  const [captcha, setCaptcha] = useState(generateCaptcha())
  const [statusMsg, setStatusMsg] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fileKey, setFileKey] = useState(Date.now())
  const [previewUrl, setPreviewUrl] = useState(null)

  const [formData, setFormData] = useState({
    contact: '',
    name: '',
    complaintType: '',
    location: '',
    address: '',
    comment: '',
    email: '',
    imageFile: null,
    captchaInput: '',
    lat: null,
    lng: null,
  })

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleInputChange = (e) => {
    const { name, value, files } = e.target
    if (files && files.length > 0) {
      const file = files[0]
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(file))
      setFormData((s) => ({ ...s, imageFile: file }))
    } else {
      setFormData((s) => ({ ...s, [name]: value }))
    }
  }

  const onPlaceSelected = ({ address, lat, lng }) => {
    setFormData((s) => ({
      ...s,
      location: address || s.location,
      address: s.address ? s.address : address || s.address,
      lat: lat ?? s.lat,
      lng: lng ?? s.lng,
    }))
    setStatusMsg('Location selected')
  }

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setStatusMsg('Geolocation not supported')
      return
    }
    setCapturing(true)
    setStatusMsg('Requesting device location… (allow permission)')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((s) => ({
          ...s,
          location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }))
        setStatusMsg('Device location captured')
        setCapturing(false)
      },
      (err) => {
        console.warn('geolocation error', err)
        setStatusMsg('Unable to get device location')
        setCapturing(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const ensureLocation = () =>
    new Promise((resolve) => {
      if (formData.lat != null && formData.lng != null) return resolve(true)
      if (!navigator.geolocation) return resolve(false)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData((s) => ({
            ...s,
            location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }))
          setStatusMsg('Device location captured')
          resolve(true)
        },
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!formData.contact || !formData.name || !formData.complaintType || !formData.comment) {
      setStatusMsg('Please fill required fields: Contact, Name, Complaint type, Comment.')
      return
    }

    if (String(formData.captchaInput).trim() !== String(captcha)) {
      setStatusMsg('Invalid captcha. Enter the number shown.')
      return
    }

    setStatusMsg('Preparing submission…')
    await ensureLocation()

    console.debug('Submitting report, formData snapshot:', {
      location_text: formData.location,
      address: formData.address,
      lat: formData.lat,
      lng: formData.lng,
      hasImage: !!formData.imageFile,
    })

    const fd = new FormData()
    if (formData.imageFile) fd.append('photo', formData.imageFile)

    fd.append('contact', formData.contact)
    fd.append('name', formData.name)
    fd.append('type', formData.complaintType)
    fd.append('description', formData.comment)

    fd.append('address', formData.address || '')
    fd.append('email', formData.email || '')

    fd.append('location_text', formData.location || '')
    fd.append('location', formData.location || '')

    if (formData.lat != null && formData.lng != null) {
      fd.append('lat', String(formData.lat))
      fd.append('lng', String(formData.lng))
      fd.append('location_lat', String(formData.lat))
      fd.append('location_lng', String(formData.lng))
    }

    setSubmitting(true)
    setStatusMsg('Submitting report…')

    try {
      // <-- use apiUrl helper so Netlify built frontend calls your Render backend
      const res = await fetch(apiUrl('/api/reports'), { method: 'POST', body: fd })
      let serverReport = null
      if (res.ok) {
        try {
          serverReport = await res.json()
        } catch {
          serverReport = null
        }
        setStatusMsg('Report submitted — thank you!')

        const reportToAdd =
          serverReport && (serverReport.id || serverReport.title)
            ? serverReport
            : {
                title: formData.complaintType || (formData.comment || '').slice(0, 30),
                coords:
                  formData.lat != null && formData.lng != null
                    ? `${Number(formData.lat).toFixed(6)}, ${Number(formData.lng).toFixed(6)}`
                    : formData.location || '',
                status: 'submitted',
                date: new Date().toLocaleDateString(),
              }

        onAddReport?.(reportToAdd)

        // Reset form state
        setFormData({
          contact: '',
          name: '',
          complaintType: '',
          location: '',
          comment: '',
          email: '',
          address: '',
          imageFile: null,
          captchaInput: '',
          lat: null,
          lng: null,
        })
        setCaptcha(generateCaptcha())

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
        }
        setFileKey(Date.now())
      } else {
        const t = await res.text().catch(() => null)
        console.error('server submit failed', res.status, t)
        setStatusMsg('Submission failed — server error')
      }
    } catch (err) {
      console.error('network error', err)
      setStatusMsg('Network error — check your connection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-live="polite">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Contact No. *</span>
          <input
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            required
            placeholder="Enter Contact Number"
            inputMode="tel"
            pattern="[\d\s+-]{6,20}"
            title="Enter a valid phone number"
            disabled={submitting}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-gray-50"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Complainant Name *</span>
          <input
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Enter Complainant Name"
            disabled={submitting}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-gray-50"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Complaint (Related to) *</span>
        <select
          name="complaintType"
          value={formData.complaintType}
          onChange={handleInputChange}
          required
          disabled={submitting}
          className="mt-1 w-full px-3 py-2 rounded-lg border bg-gray-50"
        >
          <option value="">-- Select --</option>
          <option value="pothole">Pothole</option>
          <option value="streetlight">Streetlight</option>
          <option value="trash">Trash</option>
          <option value="graffiti">Graffiti</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Complaint Location *</span>
        <div className="flex gap-2 mt-1">
          <div className="flex-1">
            <LocationIQAutocomplete onSelect={onPlaceSelected} disabled={submitting} />
          </div>

          <button
            type="button"
            onClick={captureLocation}
            disabled={capturing || submitting}
            aria-label="Capture current location"
            className="px-3 py-2 border rounded-lg bg-white"
          >
            {capturing ? 'Capturing…' : '📍'}
          </button>
        </div>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Selected place (you can edit)"
            disabled={submitting}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-white text-sm"
          />
          <input
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Address (optional)"
            disabled={submitting}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-white text-sm"
          />
        </div>

        {formData.lat != null && formData.lng != null && (
          <div className="text-xs text-gray-500 mt-2">
            Lat: {Number(formData.lat).toFixed(6)}, Lng: {Number(formData.lng).toFixed(6)}
          </div>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Complaint / Comment *</span>
        <textarea
          name="comment"
          value={formData.comment}
          onChange={handleInputChange}
          maxLength={1000}
          required
          placeholder="Enter Complaint Details"
          disabled={submitting}
          className="mt-1 w-full h-36 px-3 py-2 rounded-lg border bg-gray-50"
        />
        <div className="text-xs text-gray-500 text-right">
          {1000 - (formData.comment?.length || 0)} characters remaining.
        </div>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email (Optional)</span>
          <input
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter Email ID"
            type="email"
            disabled={submitting}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-gray-50"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Address (Optional)</span>
          <input
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Enter Address"
            disabled={submitting}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-gray-50"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Image, if any</span>
        <input
          key={fileKey}
          type="file"
          name="imageFile"
          accept="image/*"
          onChange={handleInputChange}
          disabled={submitting}
          className="mt-2 w-full border-dashed border-2 border-gray-200 p-4 rounded-lg"
        />
        {previewUrl && (
          <div className="mt-2">
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-48 rounded-md object-contain border"
            />
          </div>
        )}
      </label>

      <div className="grid grid-cols-3 gap-4 items-end">
        <label className="col-span-2 block">
          <span className="text-sm font-medium text-gray-700">Captcha *</span>
          <input
            name="captchaInput"
            value={formData.captchaInput}
            onChange={handleInputChange}
            required
            placeholder="Enter Captcha Here"
            disabled={submitting}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-gray-50"
          />
        </label>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold select-all" aria-hidden>
            {captcha}
          </div>
          <button
            type="button"
            onClick={() => {
              setCaptcha(generateCaptcha())
              setStatusMsg('')
            }}
            className="px-2 py-1 border rounded-lg"
            disabled={submitting}
            aria-label="Regenerate captcha"
          >
            ↻
          </button>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full md:w-auto bg-blue-500 text-white py-3 rounded-lg disabled:opacity-60 px-8"
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
        {statusMsg && <div className="mt-3 text-sm text-gray-600" role="status">{statusMsg}</div>}
      </div>
    </form>
  )
}
