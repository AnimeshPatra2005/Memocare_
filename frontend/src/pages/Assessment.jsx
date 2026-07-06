import React from 'react'
import Navbar from '../components/layout/Navbar'

export default function Assessment() {
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
          color: '#f59e0b',
          fontFamily: 'Dela Gothic One, cursive',
        }}>
          Cognitive Assessment
        </h1>
        <p style={{ color: '#888888', textAlign: 'center', maxWidth: '600px', lineHeight: '1.6' }}>
          This page will display a detailed clinical questionnaire and evaluate cognitive health markers.
        </p>
      </div>
    </div>
  )
}
