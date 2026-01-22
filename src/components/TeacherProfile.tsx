import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile } from '../lib/supabase';
import { Plus, User, ArrowLeft, MoreVertical, LogOut } from 'lucide-react';

interface StudentProfile extends Profile {
  isActive?: boolean;
}

export default function TeacherProfile() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (profile?.id) {
      loadStudents();
      checkActiveSessions();
      // Check for active sessions periodically
      const interval = setInterval(checkActiveSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [profile?.id]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Load students created by this teacher
      const { data: studentProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
        .eq('created_by', profile?.id)
      .eq('role', 'student')
      .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Map students with active status
      const studentsWithStatus: StudentProfile[] = (studentProfiles || []).map((student) => ({
        ...student,
        isActive: false, // Will be updated by checkActiveSessions
      }));

      setStudents(studentsWithStatus);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveSessions = async () => {
    if (!profile?.id) return;
    
    try {
      // Get current session to check if any student is currently logged in
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;

      // Update students with active status based on current session
      setStudents(prev => prev.map(s => ({
        ...s,
        isActive: s.id === currentUserId
      })));
    } catch (error) {
      console.error('Error checking active sessions:', error);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && menuRefs.current[openMenuId]) {
        if (!menuRefs.current[openMenuId]?.contains(event.target as Node)) {
          setOpenMenuId(null);
      }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const handleChange = (student: StudentProfile) => {
    setOpenMenuId(null);
    navigate(`/teacher/profile/edit-student/${student.id}`);
  };

  const handleDelete = async (student: StudentProfile) => {
    if (!confirm(`Are you sure you want to delete ${student.full_name || student.username}? This action cannot be undone.`)) {
      setOpenMenuId(null);
      return;
    }

    try {
      // Call Edge Function to delete both profile and auth user
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to delete students');
      }

      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseAnonKey) {
        throw new Error('Supabase anon key not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/delete_student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          studentId: student.id,
        }),
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorMessage = `Failed to delete student (Status: ${response.status})`;
        try {
          const errorResult = await response.json();
          errorMessage = errorResult.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use the status text
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Reload students list
      await loadStudents();
      alert('Student deleted successfully');
    } catch (error: any) {
      console.error('Error deleting student:', error);
      const errorMessage = error.message || 'Failed to delete student. Please try again.';
      alert(`Error: ${errorMessage}\n\nIf this persists, the Edge Function may not be deployed. Please check the Supabase dashboard.`);
    } finally {
      setOpenMenuId(null);
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
                onClick={() => navigate('/teacher/dashboard')}
                className="flex items-center justify-center text-black hover:text-gray-600 transition"
                title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
              <h1 className="text-xl font-bold text-black">Profile</h1>
            </div>
            <button
              onClick={signOut}
              className="flex items-center justify-center text-black hover:text-gray-600 transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-black">Students</h2>
            <button
            onClick={() => navigate('/teacher/profile/add-student')}
            className="flex items-center justify-center bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition space-x-2"
            >
            <Plus className="w-5 h-5" />
            <span>Add Student</span>
            </button>
        </div>

        {students.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-black mb-2">No students yet</h3>
            <p className="text-gray-600">Get started by adding your first student</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="divide-y divide-gray-200">
              {students.map((student) => (
                <div key={student.id} className="p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">
                      {student.full_name || student.username}
                      </h3>
                    <div className="relative" ref={(el) => { menuRefs.current[student.id] = el; }}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === student.id ? null : student.id)}
                        className="text-gray-400 hover:text-gray-600 transition p-1"
                        title="More options"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {openMenuId === student.id && (
                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <button
                            onClick={() => handleChange(student)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            Change
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-600">Email: <span className="text-gray-900">{student.email || 'N/A'}</span></span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-600">Password: <span className="text-gray-900">{student.initial_password || 'N/A'}</span></span>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
        )}
      </div>
    </div>
  );
}
