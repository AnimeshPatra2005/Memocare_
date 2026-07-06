// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { deriveKeyFromPassword } from '../lib/crypto'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [cryptoKey, setCryptoKey] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen for Supabase auth state changes (e.g. session expiration)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (!session) {
        // If logged out, immediately destroy the encryption key
        setCryptoKey(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Log in with Email + Password, then derive the encryption key.
   */
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // Derive and store the key in React state (memory only)
    const key = await deriveKeyFromPassword(password, email)
    setCryptoKey(key)

    return data
  }

  /**
   * Register a new user, then derive the encryption key.
   */
  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error

    // Derive and store the key in React state (memory only)
    const key = await deriveKeyFromPassword(password, email)
    setCryptoKey(key)

    return data
  }

  /**
   * Log out and wipe the session and key from memory.
   */
  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error("Error logging out:", error.message)
    setCryptoKey(null)
  }

  const value = {
    user,
    session,
    cryptoKey,
    login,
    signUp,
    logout,
    isAuthenticated: !!user && !!cryptoKey,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

// Custom hook for easy context usage in components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
