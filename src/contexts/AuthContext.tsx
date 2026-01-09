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
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    let cancelled = false;
    
    const checkSession = async () => {
      try {
        console.log('Checking session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (cancelled) return;
        
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
          } else if (data) {
            console.log('Profile loaded:', data);
            setProfile(data);
          } else {
            console.log('No profile found for user');
          }
        } else {
          console.log('No session found');
        }
      } catch (error) {
        console.error('Error checking session:', error);
        if (cancelled) return;
      } finally {
        if (!cancelled) {
          console.log('Setting loading to false');
          setLoading(false);
        }
      }
    };
    
    checkSession();
    
    return () => {
      cancelled = true;
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (data) {
          setProfile(data);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
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
        throw new Error(authError.message);
      }

      if (!authData.user) {
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
        throw new Error(profileError.message || 'Failed to create profile');
      }

      // Set the profile
      setProfile(profileData);
    } catch (error: any) {
      console.error('Error signing up teacher:', error);
      throw error;
    } finally {
      setLoading(false);
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
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Authentication failed');
      }

      // Load the profile for the authenticated user
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        throw new Error('No profile found for this user. Please sign up first.');
      }

      if (profileData.role !== 'teacher') {
        await supabase.auth.signOut();
        throw new Error('This account is not a teacher account');
      }

      setProfile(profileData);
    } catch (error: any) {
      console.error('Error logging in teacher:', error);
      throw error; // Re-throw so the Login component can handle it
    } finally {
      setLoading(false);
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
        throw new Error(authError.message);
      }

      if (!authData.user) {
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
        throw new Error(profileError.message || 'Failed to create profile');
      }

      // Set the profile
      setProfile(profileData);
    } catch (error: any) {
      console.error('Error signing up student:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginStudent = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Authentication failed');
      }

      // Load the profile for the authenticated user
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        throw new Error('No profile found for this user. Please sign up first.');
      }

      if (profileData.role !== 'student') {
        await supabase.auth.signOut();
        throw new Error('This account is not a student account');
      }

      setProfile(profileData);
    } catch (error: any) {
      console.error('Error logging in student:', error);
      throw error; // Re-throw so the Login component can handle it
    } finally {
      setLoading(false);
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
