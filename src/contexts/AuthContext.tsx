import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile, supabase } from '../lib/supabase';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  setDemoProfile: (role: 'teacher' | 'student') => void;
  signUpTeacher: (email: string, password: string, username: string) => Promise<void>;
  loginTeacher: (email: string, password: string) => Promise<void>;
  signUpStudent: (email: string, password: string, username: string) => Promise<void>;
  loginStudent: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false); // Start with false to show login immediately

  // Ensure loading is false when profile exists
  useEffect(() => {
    if (profile && loading) {
      setLoading(false);
    }
  }, [profile, loading]);

  // Check for existing session on mount
  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    
    const checkSession = async () => {
      try {
        // Use Promise.race to add a timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 5000);
        });
        
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (cancelled) return;
        
        // If timeout occurred, result will be null
        if (!result) {
          // Session check timed out, but don't show error - just continue
          setLoading(false);
          return;
        }
        
        const { data: { session }, error: sessionError } = result as { data: { session: any }, error: any };
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          console.log('Session found, loading profile for user:', session.user.id);
          // Load profile for authenticated user
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (cancelled) return;
          
          if (profileError) {
            console.error('Profile error:', profileError);
            setLoading(false);
          } else if (data) {
            console.log('Profile loaded:', data);
            setProfile(data);
            setLoading(false);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setLoading(false);
        // Don't block UI on errors
      }
    };
    
    // Check session in background (don't await)
    checkSession();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      
      if (session?.user) {
        // Only load profile if we don't already have one (to avoid race conditions with login functions)
        if (!profile) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          if (data) {
            setProfile(data);
            setLoading(false); // Ensure loading is false when profile is set
          }
        } else {
          // If we already have a profile, ensure loading is false
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    
    subscription = authSubscription;

    return () => {
      cancelled = true;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const setDemoProfile = async (role: 'teacher' | 'student') => {
    setLoading(true);
    try {
      // Find the first profile with the requested role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', role)
        .limit(1)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        console.error(`No ${role} profile found in database. Please create a ${role} account first.`);
        alert(`No ${role} account found. Please create a ${role} account in your database first.`);
        return;
      }

      // Get the password for authentication
      const password = profileData.initial_password || 'demo123'; // Default password for demo
      
      // Try different email domains
      const emailDomains = ['@platform.com', '@platform.local'];
      let authenticated = false;
      let lastAuthError = null;

      for (const domain of emailDomains) {
        const email = `${profileData.username}${domain}`;
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!authError) {
          authenticated = true;
          console.log('Successfully authenticated user:', email);
          break;
        } else {
          lastAuthError = authError;
          console.warn(`Failed to authenticate with ${email}:`, authError.message);
        }
      }

      if (!authenticated) {
        console.error('Could not authenticate user. Auth errors:', lastAuthError);
        console.error('Profile ID:', profileData.id);
        console.error('Username:', profileData.username);
        console.error('Tried password:', password ? '***' : 'null');
        // Don't show alert, just log the error - profile will be set anyway
      }

      // Set profile after authentication attempt (even if auth failed, profile is set for UI)
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
      alert('Error loading profile. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const signUpTeacher = async (email: string, password: string, username: string) => {
    setLoading(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setLoading(false);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        setLoading(false);
        throw new Error('Failed to create user');
      }

      // Create profile for the new teacher
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          role: 'teacher',
          created_by: null,
          initial_password: password,
        })
        .select()
        .single();

      if (profileError) {
        // If profile creation fails, sign out the user
        await supabase.auth.signOut();
        setLoading(false);
        throw new Error(profileError.message || 'Failed to create profile');
      }

      // Set the profile and loading in correct order
      setProfile(profileData);
      setLoading(false);
    } catch (error: any) {
      console.error('Error signing up teacher:', error);
      setLoading(false);
      throw error;
    }
  };

  const loginTeacher = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setLoading(false);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        setLoading(false);
        throw new Error('Authentication failed');
      }

      // Load the profile for the authenticated user
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        setLoading(false);
        throw profileError;
      }
      
      if (!profileData) {
        setLoading(false);
        throw new Error('No profile found for this user. Please sign up first.');
      }

      if (profileData.role !== 'teacher') {
        await supabase.auth.signOut();
        setLoading(false);
        throw new Error('This account is not a teacher account');
      }

      // Set profile and loading in the correct order
      setProfile(profileData);
      setLoading(false);
    } catch (error: any) {
      console.error('Error logging in teacher:', error);
      setLoading(false);
      throw error; // Re-throw so the Login component can handle it
    }
  };

  const signUpStudent = async (email: string, password: string, username: string) => {
    setLoading(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setLoading(false);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        setLoading(false);
        throw new Error('Failed to create user');
      }

      // Create profile for the new student
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          role: 'student',
          created_by: null,
          initial_password: password,
        })
        .select()
        .single();

      if (profileError) {
        // If profile creation fails, sign out the user
        await supabase.auth.signOut();
        setLoading(false);
        throw new Error(profileError.message || 'Failed to create profile');
      }

      // Set the profile and loading in correct order
      setProfile(profileData);
      setLoading(false);
    } catch (error: any) {
      console.error('Error signing up student:', error);
      setLoading(false);
      throw error;
    }
  };

  const loginStudent = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (!email || !password) {
        setLoading(false);
        throw new Error('Please enter both email and password');
      }

      // Email + password login for students
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        setLoading(false);
        // More specific error messages
        if (authError.message?.includes('Email not confirmed')) {
          throw new Error('Please check your email and confirm your account before logging in.');
        }
        if (authError.message?.includes('Invalid login credentials') || authError.message?.includes('Invalid password')) {
          throw new Error('Invalid email or password. Please check your credentials.');
        }
        throw new Error(authError.message || 'Invalid email or password. Please check your credentials.');
      }

      if (!authData.user) {
        setLoading(false);
        throw new Error('Authentication failed');
      }

      // Load the profile for the authenticated user
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        setLoading(false);
        throw profileError;
      }
      
      if (!profileData) {
        setLoading(false);
        throw new Error('No profile found for this user. Please sign up first.');
      }

      if (profileData.role !== 'student') {
        await supabase.auth.signOut();
        setLoading(false);
        throw new Error('This account is not a student account');
      }

      // Set profile and loading in the correct order
      setProfile(profileData);
      setLoading(false);
    } catch (error: any) {
      console.error('Error logging in student:', error);
      setLoading(false);
      throw error; // Re-throw so the Login component can handle it
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, setDemoProfile, signUpTeacher, loginTeacher, signUpStudent, loginStudent, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
