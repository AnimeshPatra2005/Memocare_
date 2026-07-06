import React from 'react'
import Navbar from '../components/layout/Navbar'

export default function History() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0c',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Navbar />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'Space Mono, monospace',
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          marginBottom: '16px',
          color: '#10b981',
          fontFamily: 'Dela Gothic One, cursive',
        }}>
          Patient Records History
        </h1>
        <p style={{ color: '#888888', textAlign: 'center', maxWidth: '600px', lineHeight: '1.6' }}>
          This page will retrieve, decrypt client-side, and present past MRI and Cognitive Assessment reports.
        </p>
      </div>
    </div>
  )
}
