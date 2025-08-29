import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, Farmer } from '../lib/supabase'

interface AuthContextType {
  user: Farmer | null
  loading: boolean
  signUp: (email: string, password: string, userData: any) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Farmer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          return
        }
        
        if (session?.user) {
          // Fetch farmer details
          const { data: farmer, error: farmerError } = await supabase
            .from('farmers')
            .select('*')
            .eq('email', session.user.email)
            .single()
          
          if (farmerError) {
            console.error('Farmer fetch error:', farmerError)
            await supabase.auth.signOut()
            setUser(null)
          } else {
            setUser(farmer)
          }
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Session check error:', error)
        await supabase.auth.signOut()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null)
        } else if (session?.user) {
          const { data: farmer, error: farmerError } = await supabase
            .from('farmers')
            .select('*')
            .eq('email', session.user.email)
            .single()
          
          if (farmerError) {
            console.error('Farmer fetch error:', farmerError)
            await supabase.auth.signOut()
            setUser(null)
          } else {
            setUser(farmer)
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error)
        await supabase.auth.signOut()
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, userData: any) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    // Insert farmer data
    const { error: insertError } = await supabase
      .from('farmers')
      .insert([{ email, password, ...userData }])
    
    if (insertError) throw insertError
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
    setUser(null)
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}