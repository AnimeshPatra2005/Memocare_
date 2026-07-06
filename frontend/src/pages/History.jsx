import React, { useState, useEffect } from 'react'
import { Calendar, Brain, Activity, ClipboardList, ShieldCheck, Download, Eye, EyeOff, Loader, Trash2 } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { useAuth } from '../context/AuthContext'
import { decryptData } from '../lib/crypto'

const GatewayUrl = import.meta.env.VITE_API_GATEWAY_URL || window.location.origin

export default function History() {
  const { session, cryptoKey } = useAuth()
  
  const [activeTab, setActiveTab] = useState('tabular') // 'tabular' or 'mri'
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  
  const [mriRecords, setMriRecords] = useState([])
  const [tabularRecords, setTabularRecords] = useState([])
  const [expandedTabular, setExpandedTabular] = useState(null) // ID of tabular record expanded

  useEffect(() => {
    if (session && cryptoKey) {
      fetchAndDecryptRecords()
    }
  }, [session, cryptoKey])

  const fetchAndDecryptRecords = async () => {
    try {
      setLoading(true)
      setErrorMsg('')

      // 1. Fetch encrypted records from gateway
      const [mriRes, tabRes] = await Promise.all([
        fetch(`${GatewayUrl}/records/mri`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch(`${GatewayUrl}/records/tabular`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ])

      if (!mriRes.ok) throw new Error("Failed to fetch MRI records")
      if (!tabRes.ok) throw new Error("Failed to fetch tabular records")

      const rawMri = await mriRes.json()
      const rawTab = await tabRes.json()

      // 2. Decrypt MRI records
      const decryptedMri = await Promise.all(rawMri.map(async (record) => {
        try {
          const plainVerdict = await decryptData(record.encrypted_verdict, record.iv, cryptoKey)
          return {
            ...record,
            verdict: plainVerdict,
            decrypted: true
          }
        } catch (e) {
          console.error("MRI decryption error:", e)
          return { ...record, verdict: "Decryption Failed", decrypted: false }
        }
      }))

      // 3. Decrypt Tabular records
      const decryptedTab = await Promise.all(rawTab.map(async (record) => {
        try {
          const plainDataStr = await decryptData(record.encrypted_data, record.iv, cryptoKey)
          
          let plainVerdictStr
          if (record.encrypted_verdict.includes(':')) {
            const [verdictIv, verdictCipher] = record.encrypted_verdict.split(':')
            plainVerdictStr = await decryptData(verdictCipher, verdictIv, cryptoKey)
          } else {
            plainVerdictStr = await decryptData(record.encrypted_verdict, record.iv, cryptoKey)
          }
          
          const inputs = JSON.parse(plainDataStr)
          const verdictObj = JSON.parse(plainVerdictStr)

          return {
            ...record,
            inputs,
            verdict: verdictObj.verdict,
            probability: verdictObj.probability,
            decrypted: true
          }
        } catch (e) {
          console.error("Tabular decryption error:", e)
          return { ...record, verdict: "Decryption Failed", decrypted: false }
        }
      }))

      setMriRecords(decryptedMri)
      setTabularRecords(decryptedTab)

    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || "Failed to load screening history")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async (record) => {
    try {
      const pdfRes = await fetch(`${GatewayUrl}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          patient_name: session?.user?.email || "Patient",
          patient_id: session?.user?.id || "N/A",
          alzheimers_probability: record.probability,
          clinical_scores: record.inputs
        })
      })

      if (!pdfRes.ok) throw new Error("Failed to generate PDF")
      
      const blob = await pdfRes.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Cognitive_Assessment_Report_${record.id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert("Failed to download PDF report: " + err.message)
    }
  }

  const handleDeleteRecord = async (type, id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return
    
    try {
      const res = await fetch(`${GatewayUrl}/records/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (!res.ok) throw new Error(await res.text())

      if (type === 'mri') {
        setMriRecords(prev => prev.filter(r => r.id !== id))
      } else {
        setTabularRecords(prev => prev.filter(r => r.id !== id))
      }
    } catch (err) {
      alert("Failed to delete record: " + err.message)
    }
  }

  const formatDate = (dateString) => {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const tabStyle = (tabId) => ({
    padding: '12px 24px',
    backgroundColor: activeTab === tabId ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
    border: 'none',
    borderBottom: activeTab === tabId ? '2px solid #06b6d4' : '2px solid transparent',
    color: activeTab === tabId ? '#06b6d4' : '#888',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s'
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0c', color: '#ffffff' }}>
      <Navbar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px', color: '#06b6d4' }}>
            Medical History
          </h1>
          <p style={{ color: '#888', fontSize: '16px' }}>
            View and download your past clinical records. All data is decrypted locally on your browser.
          </p>
        </div>

        {errorMsg && (
          <div style={{ padding: '16px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', marginBottom: '24px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Tab Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
          <button style={tabStyle('tabular')} onClick={() => setActiveTab('tabular')}>
            <ClipboardList size={18} /> Cognitive Assessments
          </button>
          <button style={tabStyle('mri')} onClick={() => setActiveTab('mri')}>
            <Brain size={18} /> MRI Scans
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
            <Loader className="animate-spin" size={32} color="#06b6d4" />
            <p style={{ color: '#888' }}>Retrieving and decrypting records locally...</p>
          </div>
        ) : (
          <div>
            {/* Cognitive Assessments Tab */}
            {activeTab === 'tabular' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {tabularRecords.length === 0 ? (
                  <div style={{ padding: '48px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center', color: '#555' }}>
                    No cognitive assessments found.
                  </div>
                ) : (
                  tabularRecords.map((record) => (
                    <div 
                      key={record.id} 
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '12px',
                        padding: '24px',
                        transition: 'all 0.3s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                            <Calendar size={14} /> {formatDate(record.created_at)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px', fontWeight: '700', color: record.verdict === 'High Likelihood' ? '#ef4444' : '#22c55e' }}>
                              {record.verdict}
                            </span>
                            <span style={{ fontSize: '14px', color: '#888' }}>
                              Probability: {(record.probability * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button
                            onClick={() => setExpandedTabular(expandedTabular === record.id ? null : record.id)}
                            style={{ padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
                          >
                            {expandedTabular === record.id ? <EyeOff size={16} /> : <Eye size={16} />}
                            {expandedTabular === record.id ? 'Hide Details' : 'View Details'}
                          </button>
                          
                          {record.decrypted && (
                            <button
                              onClick={() => handleDownloadPdf(record)}
                              style={{ padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid #06b6d4', borderRadius: '6px', color: '#06b6d4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600' }}
                            >
                              <Download size={16} /> Report
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteRecord('tabular', record.id)}
                            style={{ padding: '10px 12px', backgroundColor: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = '#ef4444' }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)' }}
                            title="Delete Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Expandable detailed patient inputs */}
                      {expandedTabular === record.id && record.decrypted && (
                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                          {Object.entries(record.inputs).map(([key, val]) => (
                            <div key={key} style={{ backgroundColor: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                              <p style={{ margin: 0, fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </p>
                              <p style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: '600', color: '#fff' }}>
                                {key === 'MemoryComplaints' || key === 'BehavioralProblems' 
                                  ? (val === 1 ? 'Yes' : 'No') 
                                  : val}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* MRI Scans Tab */}
            {activeTab === 'mri' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {mriRecords.length === 0 ? (
                  <div style={{ padding: '48px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center', color: '#555' }}>
                    No MRI scans found.
                  </div>
                ) : (
                  mriRecords.map((record) => (
                    <div 
                      key={record.id} 
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '12px',
                        padding: '24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                          <Calendar size={14} /> {formatDate(record.created_at)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '20px', fontWeight: '700', color: record.verdict.toLowerCase().includes('non_demented') ? '#22c55e' : '#ef4444' }}>
                            {record.verdict.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#10b981' }}>
                          <ShieldCheck size={16} /> Encrypted
                        </div>
                        <button
                          onClick={() => handleDeleteRecord('mri', record.id)}
                          style={{ padding: '8px', backgroundColor: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = '#ef4444' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)' }}
                          title="Delete Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
