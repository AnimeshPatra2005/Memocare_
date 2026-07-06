import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import logoSrc from '../../assets/memocare_logo.png'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // Derive display name from user email
  const userEmail = user?.email || 'Guest'
  const userName = userEmail.split('@')[0]
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1)

  // Generate initials for avatar fallback
  const initials = formattedName.split(/[._-]/).map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      console.error("Error signing out:", error.message)
    }
  }

  return (
    <nav style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 48px',
      backgroundColor: '#0a0a0c',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Logo + Brand */}
      <div
        onClick={() => navigate('/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
      >
        <img
          src={logoSrc}
          alt="MemoCare Logo"
          style={{ width: '44px', height: '44px', objectFit: 'contain' }}
        />
        <span style={{
          fontSize: '26px',
          fontWeight: '700',
          color: '#ffffff',
          letterSpacing: '-0.5px',
          fontFamily: 'Dela Gothic One, cursive',
        }}>
          MemoCare
        </span>
      </div>

      {/* User info & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontSize: '18px',
            color: '#cccccc',
            fontFamily: 'Space Mono, monospace',
          }}>
            Welcome, {formattedName}
          </span>

          {/* Avatar circle */}
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#2a2a2a',
            border: '2px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '700',
            fontFamily: 'Space Mono, monospace',
            flexShrink: 0,
          }}>
            {initials}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'Space Mono, monospace',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
            e.currentTarget.style.borderColor = '#ef4444'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}

