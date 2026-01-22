import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';

export default function EditStudent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadStudent();
    }
  }, [id]);

  const loadStudent = async () => {
    setLoading(true);
    setError('');
    try {
      if (!id || !profile?.id) {
        throw new Error('Missing student ID or teacher profile');
      }

      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('role', 'student')
        .eq('created_by', profile.id) // Ensure teacher can only edit their own students
        .single();

      if (studentError) {
        throw new Error(studentError.message || 'Student not found or you do not have permission');
      }

      if (!studentData) {
        throw new Error('Student not found');
      }

      setFullName(studentData.full_name || '');
      setEmail(studentData.email || '');
      setPassword(''); // Don't load password for security
    } catch (err: any) {
      console.error('Error loading student:', err);
      setError(err.message || 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!fullName || !email) {
      setError('Please fill in all required fields');
      setSubmitting(false);
      return;
    }

    if (!id) {
      setError('Student ID is missing');
      setSubmitting(false);
      return;
    }

    try {
      // First, get the current student data to check what changed
      const { data: currentStudent, error: fetchError } = await supabase
        .from('profiles')
        .select('email, initial_password')
        .eq('id', id)
        .eq('created_by', profile?.id) // Ensure teacher can only edit their own students
        .single();

      if (fetchError) {
        throw new Error('Student not found or you do not have permission to edit this student');
      }

      const emailChanged = currentStudent.email !== email;
      const passwordChanged = password && password.length > 0;

      // Update profile table
      const updates: any = {
        full_name: fullName,
        email: email,
      };

      // Only update password if provided
      if (passwordChanged) {
        updates.initial_password = password;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .eq('created_by', profile?.id);

      if (profileError) {
        throw new Error(profileError.message || 'Failed to update student profile');
      }

      // Note: Updating auth user email/password requires admin API (Edge Function)
      // For now, the profile is updated but auth user credentials may not match
      // In production, deploy an Edge Function to sync auth user updates
      if (emailChanged || passwordChanged) {
        console.warn('Profile updated, but auth user email/password may need manual update via Edge Function');
      }

      // Navigate back to profile page
      navigate('/teacher/profile');
    } catch (err: any) {
      console.error('Error updating student:', err);
      setError(err.message || 'Failed to update student. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

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
              <h1 className="text-xl font-bold text-black">Edit Student</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-black mb-6">Edit Student</h2>

          <form onSubmit={handleEditStudent} className="space-y-4">
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
                New Password (leave blank to keep current)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                placeholder="Enter new password"
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
                {submitting ? 'Saving...' : 'Save Changes'}
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
