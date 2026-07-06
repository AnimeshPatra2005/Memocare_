import React, { useState, useRef } from 'react'
import { UploadCloud, FileImage, Activity, ShieldCheck } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { useAuth } from '../context/AuthContext'
import { encryptData } from '../lib/crypto'

export default function MriAnalysis() {
  const { session, cryptoKey } = useAuth()

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('IDLE') // IDLE, PREDICTING, ENCRYPTING, SAVING, SUCCESS, ERROR
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState(null)

  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileSelection(droppedFile)
    } else {
      setErrorMsg('Please upload a valid image file (JPG, PNG).')
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      handleFileSelection(selectedFile)
    }
  }

  const handleFileSelection = (selectedFile) => {
    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
    setErrorMsg('')
    setStatus('IDLE')
    setResult(null)
  }

  const handleAnalyze = async () => {
    if (!file) return

    try {
      setStatus('PREDICTING')
      setErrorMsg('')

      // 1. Post image to Gateway for prediction
      const formData = new FormData()
      formData.append('file', file)

      const gatewayUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000'
      const predictRes = await fetch(`${gatewayUrl}/predict/mri`, {
        method: 'POST',
        body: formData,
      })

      if (!predictRes.ok) {
        throw new Error(`Prediction failed: ${await predictRes.text()}`)
      }

      const predictionData = await predictRes.json()
      setResult(predictionData)

      setStatus('ENCRYPTING')

      // 2. Encrypt the verdict
      const { ciphertext, iv } = await encryptData(predictionData.prediction, cryptoKey)

      setStatus('SAVING')

      // 3. Save the encrypted record securely
      const saveRes = await fetch(`${gatewayUrl}/records/mri`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          encrypted_verdict: ciphertext,
          iv: iv
        })
      })

      if (!saveRes.ok) {
        throw new Error(`Failed to save encrypted record: ${await saveRes.text()}`)
      }

      setStatus('SUCCESS')

    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'An error occurred during analysis.')
      setStatus('ERROR')
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0c', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', fontFamily: 'Space Mono, monospace' }}>
        <div style={{ maxWidth: '800px', width: '100%' }}>

          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px', color: '#06b6d4', fontFamily: 'Dela Gothic One, cursive' }}>
            MRI Brain Scan Analysis
          </h1>
          <p style={{ color: '#888888', marginBottom: '32px', lineHeight: '1.6' }}>
            Upload a brain MRI scan for AI-powered dementia detection. Your scan is processed in-memory and discarded. The verdict is encrypted end-to-end.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>

            {/* Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${file ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px',
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: file ? 'rgba(6, 182, 212, 0.05)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
              />

              {!file ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <UploadCloud size={48} color="#06b6d4" opacity={0.8} />
                  <div>
                    <p style={{ fontSize: '18px', fontWeight: '600' }}>Drag & drop your MRI scan</p>
                    <p style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>or click to browse files (JPG, PNG)</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  {preview ? (
                    <img src={preview} alt="MRI Preview" style={{ width: '160px', height: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                  ) : (
                    <FileImage size={48} color="#06b6d4" />
                  )}
                  <p style={{ fontSize: '16px', fontWeight: '600' }}>{file.name}</p>
                  <p style={{ fontSize: '12px', color: '#888' }}>
                    {file.size >= 1024 * 1024 
                      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
                      : `${(file.size / 1024).toFixed(2)} KB`}
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleAnalyze}
                disabled={!file || status === 'PREDICTING' || status === 'ENCRYPTING' || status === 'SAVING'}
                style={{
                  backgroundColor: '#06b6d4',
                  color: '#000',
                  padding: '16px 48px',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: (!file || status === 'PREDICTING' || status === 'ENCRYPTING' || status === 'SAVING') ? 'not-allowed' : 'pointer',
                  opacity: (!file || status === 'PREDICTING' || status === 'ENCRYPTING' || status === 'SAVING') ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)'
                }}
              >
                {status === 'IDLE' && <Activity size={20} />}
                {status === 'PREDICTING' && "Analyzing Scan..."}
                {status === 'ENCRYPTING' && "Encrypting Verdict..."}
                {status === 'SAVING' && "Saving Securely..."}
                {status === 'SUCCESS' && "Analysis Complete"}
                {status === 'ERROR' && "Retry Analysis"}
                {status === 'IDLE' && "Analyze MRI"}
              </button>
            </div>

            {/* Results Panel */}
            {result && status === 'SUCCESS' && (
              <div style={{
                marginTop: '16px',
                padding: '32px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <ShieldCheck size={28} color="#10b981" />
                  <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>Diagnosis Result Secured</h2>
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <p style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>Predicted Class:</p>
                  <p style={{ fontSize: '32px', fontWeight: '700', color: '#fff' }}>
                    {result.prediction.replace(/_/g, ' ')}
                  </p>
                  <p style={{ fontSize: '16px', color: '#06b6d4', marginTop: '8px' }}>
                    Confidence: {(result.confidence * 100).toFixed(1)}%
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>Probability Breakdown:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(result.all_probabilities).map(([className, prob]) => (
                      <div key={className}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                          <span>{className.replace(/_/g, ' ')}</span>
                          <span>{(prob * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${prob * 100}%`,
                            backgroundColor: className === result.prediction ? '#06b6d4' : '#555'
                          }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

