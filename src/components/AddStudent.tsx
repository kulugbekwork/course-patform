import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, X } from 'lucide-react';

export default function AddStudent() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!fullName || !email || !password) {
      setError('Please fill in all fields');
      setSubmitting(false);
      return;
    }

    if (!profile?.id) {
      setError('Teacher profile not found');
      setSubmitting(false);
      return;
    }

    try {
      // Check if user already exists by checking profiles table first
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        throw new Error('A student with this email already exists. Please use a different email.');
      }

      // Use direct signUp (Edge Function not deployed yet)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        // Handle specific error cases
        if (authError.message?.includes('already registered') || authError.message?.includes('User already registered')) {
          throw new Error('A user with this email already exists. Please use a different email.');
        }
        throw new Error(authError.message || 'Failed to create user account');
      }

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Create profile for the student
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: email.split('@')[0], // Use email prefix as username
          role: 'student',
          created_by: profile.id,
          full_name: fullName,
          initial_password: password,
          email: email, // Store email for display
        });

      if (profileError) {
        // If profile creation fails, try to clean up the auth user
        if (authData.user) {
          // Note: We can't delete auth users from client side, but we can log it
          console.warn('Profile creation failed, auth user may need manual cleanup:', authData.user.id);
        }
        throw new Error(profileError.message || 'Failed to create student profile');
      }

      // Navigate back to profile page
      navigate('/teacher/profile');
    } catch (err: any) {
      console.error('Error adding student:', err);
      let errorMessage = err.message || 'Failed to add student. Please try again.';
      
      // Provide helpful error messages
      if (err.message?.includes('already exists') || err.message?.includes('already registered')) {
        errorMessage = 'A student with this email already exists. Please use a different email address.';
      } else if (err.message?.includes('email') && err.message?.includes('confirm')) {
        errorMessage = 'Student account created but email confirmation may be required. Please check your Supabase settings to disable email confirmation for development.';
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/teacher/profile')}
                className="flex items-center justify-center text-black hover:text-gray-600 transition"
                title="Back to Profile"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-black">Add Student</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-black mb-6">Add New Student</h2>

          <form onSubmit={handleAddStudent} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                placeholder="Enter full name"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                placeholder="Enter email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Adding...' : 'Add Student'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/teacher/profile')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
