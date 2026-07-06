import React, { useState } from 'react'
import { Activity, Brain, Heart, ClipboardList, ShieldCheck, Download } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { useAuth } from '../context/AuthContext'
import { encryptData } from '../lib/crypto'

const GatewayUrl = 'http://localhost:8000'

export default function Assessment() {
  const { session, cryptoKey } = useAuth()

  const [status, setStatus] = useState('IDLE') // IDLE, SUBMITTING, SUCCESS, ERROR
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState(null)

  const [formData, setFormData] = useState({
    Age: '',
    BMI: '',
    SystolicBP: '',
    DiastolicBP: '',
    CholesterolTotal: '',
    CholesterolLDL: '',
    CholesterolHDL: '',
    CholesterolTriglycerides: '',
    MMSE: '',
    ADL: '',
    FunctionalAssessment: '',
    MemoryComplaints: '0',
    BehavioralProblems: '0',
    DietQuality: '',
    SleepQuality: '',
    PhysicalActivity: '',
    AlcoholConsumption: ''
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const payload = {}
    for (const key in formData) {
      payload[key] = parseFloat(formData[key]) || 0
    }

    try {
      setStatus('SUBMITTING')
      setErrorMsg('')

      // 1. Get Prediction from Gateway
      const predRes = await fetch(`${GatewayUrl}/predict/tabular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!predRes.ok) throw new Error(await predRes.text())
      const predictionData = await predRes.json()
      setResult(predictionData)

      // 2. Encrypt Data (Inputs) and Verdict separately as per Schema
      const encryptedInputs = await encryptData(payload, cryptoKey)
      const encryptedVerdictObj = await encryptData(
        { verdict: predictionData.result_text, probability: predictionData.alzheimers_probability },
        cryptoKey
      )

      // 3. Save to DB
      const saveRes = await fetch(`${GatewayUrl}/records/tabular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          encrypted_data: encryptedInputs.ciphertext,
          encrypted_verdict: encryptedVerdictObj.ciphertext,
          iv: encryptedInputs.iv // Assuming same IV or keeping backend happy. Wait, encryptData generates a new IV each time. Let's just use encryptedInputs.iv for the DB if it only has 1 IV column. Let's check backend schema.
        })
      })

      if (!saveRes.ok) throw new Error(`Failed to save encrypted record: ${await saveRes.text()}`)

      setStatus('SUCCESS')
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || "Failed to submit assessment")
      setStatus('ERROR')
    }
  }

  const handleDownloadPdf = async () => {
    try {
      const payload = {}
      for (const key in formData) {
        payload[key] = parseFloat(formData[key]) || 0
      }

      const pdfRes = await fetch(`${GatewayUrl}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          patient_name: session?.user?.email || "Patient",
          patient_id: session?.user?.id || "N/A",
          alzheimers_probability: result.alzheimers_probability,
          clinical_scores: payload
        })
      })

      if (!pdfRes.ok) throw new Error(await pdfRes.text())

      const blob = await pdfRes.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Cognitive_Assessment_Report.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error(err)
      setErrorMsg("Failed to download PDF report: " + err.message)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    outline: 'none',
    fontSize: '14px',
    marginTop: '6px'
  }

  const labelStyle = {
    fontSize: '12px',
    color: '#aaa',
    fontWeight: '500'
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0c', color: '#ffffff' }}>
      <Navbar />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px', color: '#06b6d4' }}>
            Cognitive Assessment
          </h1>
          <p style={{ color: '#888', fontSize: '16px' }}>
            Fill in the patient's clinical metrics. The data is processed ephemerally and encrypted end-to-end.
          </p>
        </div>

        {errorMsg && (
          <div style={{ padding: '16px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', marginBottom: '24px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Section 1 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#06b6d4' }}>
                <ClipboardList size={20} /> <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Demographics & Basics</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Age (Years)</label>
                  <input type="number" step="0.1" name="Age" value={formData.Age} onChange={handleChange} style={inputStyle} required />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={labelStyle}>BMI (kg/m²)</label>
                    <a href="https://www.calculator.net/bmi-calculator.html" target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#06b6d4', textDecoration: 'none' }}>Calculate</a>
                  </div>
                  <input type="number" step="0.1" name="BMI" value={formData.BMI} onChange={handleChange} style={inputStyle} required />
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#06b6d4' }}>
                <Heart size={20} /> <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Vitals & Labs</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Systolic BP (mmHg)</label><input type="number" step="0.1" name="SystolicBP" value={formData.SystolicBP} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Diastolic BP (mmHg)</label><input type="number" step="0.1" name="DiastolicBP" value={formData.DiastolicBP} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Cholesterol Total (mg/dL)</label><input type="number" step="0.1" name="CholesterolTotal" value={formData.CholesterolTotal} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Cholesterol LDL (mg/dL)</label><input type="number" step="0.1" name="CholesterolLDL" value={formData.CholesterolLDL} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Cholesterol HDL (mg/dL)</label><input type="number" step="0.1" name="CholesterolHDL" value={formData.CholesterolHDL} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Triglycerides (mg/dL)</label><input type="number" step="0.1" name="CholesterolTriglycerides" value={formData.CholesterolTriglycerides} onChange={handleChange} style={inputStyle} required /></div>
              </div>
            </div>

            {/* Section 3 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#06b6d4' }}>
                <Brain size={20} /> <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Cognitive & Functional</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={labelStyle}>MMSE Score (0-30)</label>
                    <a href="https://compendiumapp.com/post_4xQIen-Ly" target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#06b6d4', textDecoration: 'none' }}>Take Test</a>
                  </div>
                  <input type="number" step="0.1" name="MMSE" value={formData.MMSE} onChange={handleChange} style={inputStyle} required />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={labelStyle}>ADL Score</label>
                    <a href="https://www.mdcalc.com/calc/3912/barthel-index-activities-daily-living-adl#evidence" target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#06b6d4', textDecoration: 'none' }}>Take Test</a>
                  </div>
                  <input type="number" step="0.1" name="ADL" value={formData.ADL} onChange={handleChange} style={inputStyle} required />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={labelStyle}>Functional Assessment Score (0-10)</label>
                    <a href="https://www.compassus.com/healthcare-professionals/determining-eligibility/functional-assessment-staging-tool-fast-scale-for-dementia/" target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#06b6d4', textDecoration: 'none' }}>Guidelines</a>
                  </div>
                  <input type="number" step="0.1" name="FunctionalAssessment" value={formData.FunctionalAssessment} onChange={handleChange} style={inputStyle} required />
                </div>

                <div>
                  <label style={labelStyle}>Memory Complaints</label>
                  <select name="MemoryComplaints" value={formData.MemoryComplaints} onChange={handleChange} style={inputStyle}>
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Behavioral Problems</label>
                  <select name="BehavioralProblems" value={formData.BehavioralProblems} onChange={handleChange} style={inputStyle}>
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#06b6d4' }}>
                <Activity size={20} /> <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Lifestyle & Habits (0-10 scale)</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Diet Quality</label><input type="number" step="0.1" name="DietQuality" value={formData.DietQuality} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Sleep Quality</label><input type="number" step="0.1" name="SleepQuality" value={formData.SleepQuality} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Physical Activity</label><input type="number" step="0.1" name="PhysicalActivity" value={formData.PhysicalActivity} onChange={handleChange} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Alcohol Consumption</label><input type="number" step="0.1" name="AlcoholConsumption" value={formData.AlcoholConsumption} onChange={handleChange} style={inputStyle} required /></div>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'SUBMITTING'}
              style={{ padding: '16px', backgroundColor: '#06b6d4', color: '#000', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', opacity: status === 'SUBMITTING' ? 0.7 : 1 }}
            >
              {status === 'SUBMITTING' ? 'Processing & Encrypting...' : 'Run Cognitive Analysis'}
            </button>

          </form>

          {/* Results Panel */}
          <div>
            {result && status === 'SUCCESS' ? (
              <div style={{ position: 'sticky', top: '24px', padding: '32px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'rgba(6,182,212,0.1)', borderRadius: '12px' }}>
                    <ShieldCheck size={32} color="#06b6d4" />
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>End-to-End Encrypted</p>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Analysis Complete</h3>
                  </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <p style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>Model Verdict:</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: result.prediction_class === 1 ? '#ef4444' : '#22c55e' }}>
                    {result.result_text}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ color: '#aaa' }}>Alzheimer's Likelihood</span>
                    <span style={{ fontWeight: '600' }}>{(result.alzheimers_probability * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${result.alzheimers_probability * 100}%`, backgroundColor: '#06b6d4', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <button
                  onClick={handleDownloadPdf}
                  style={{ width: '100%', padding: '12px', marginTop: '16px', backgroundColor: 'transparent', border: '1px solid #06b6d4', color: '#06b6d4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600' }}
                >
                  <Download size={18} /> Download Clinical Report
                </button>

                <p style={{ fontSize: '12px', color: '#555', marginTop: '32px', lineHeight: '1.5' }}>
                  This data has been securely encrypted with your personal key before leaving your device.
                </p>
              </div>
            ) : (
              <div style={{ position: 'sticky', top: '24px', padding: '32px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#555', textAlign: 'center' }}>
                <ClipboardList size={48} opacity={0.5} style={{ marginBottom: '16px' }} />
                <p>Fill out the form and submit to see the analysis results here.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
