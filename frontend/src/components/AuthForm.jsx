// frontend/src/components/AuthForm.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthForm.css'

export default function AuthForm() {
    const { login, signUp } = useAuth()
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrorMsg('')
        setLoading(true)

        try {
            if (isSignUp) {
                await signUp(email, password)
                alert('Verification email sent! Check your inbox to confirm your registration.')
            } else {
                await login(email, password)
                // Login derives the key and stores it in context memory. Navigate to Dashboard:
                navigate('/dashboard')
            }
        } catch (err) {
            setErrorMsg(err.message || 'An error occurred during authentication.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-[400px]">
            <form className="form" onSubmit={handleSubmit}>
                <p>
                    Welcome, <span>{isSignUp ? 'sign up to create account' : 'sign in to continue'}</span>
                </p>

                {errorMsg && (
                    <div style={{ color: '#ef4444', fontFamily: 'Space Mono, monospace', fontSize: '14px', marginBottom: '10px' }}>
                        ⚠️ {errorMsg}
                    </div>
                )}

                <input
                    className="oauthButton"
                    style={{ cursor: 'text', textAlign: 'left', background: '#fff', boxShadow: 'none' }}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    className="oauthButton"
                    style={{ cursor: 'text', textAlign: 'left', background: '#fff', boxShadow: 'none' }}
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button className="oauthButton" type="submit" disabled={loading} style={{ background: '#323232', color: '#fff' }}>
                    {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
                    <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 17 5-5-5-5"></path>
                        <path d="m13 17 5-5-5-5"></path>
                    </svg>
                </button>

                <div className="separator">
                    <div></div>
                    <span
                        onClick={() => setIsSignUp(!isSignUp)}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </span>
                    <div></div>
                </div>
            </form>
        </div>
    )
}
