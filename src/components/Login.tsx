import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Lock, Mail, User } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { signUpTeacher, loginTeacher, loginStudent, loading, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isTeacherLogin, setIsTeacherLogin] = useState(false);
  const [isStudentLogin, setIsStudentLogin] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [teacherAccessPassword, setTeacherAccessPassword] = useState('');
  const [teacherAccessGranted, setTeacherAccessGranted] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  useEffect(() => {
    if (profile?.role === 'teacher') {
      navigate('/teacher/dashboard');
    } else if (profile?.role === 'student') {
      navigate('/student/dashboard');
    }
  }, [profile, navigate]);

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email');
      return;
    }
    
    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (isSignUp && !username) {
      setError('Please enter a username');
      return;
    }

    try {
      if (isSignUp) {
        await signUpTeacher(email, password, username);
      } else {
        await loginTeacher(email, password);
      }
    } catch (err: any) {
      let errorMessage = err.message || (isSignUp ? 'Failed to create account. Please try again.' : 'Invalid email or password. Please try again.');
      if (isSignUp && err.message?.includes('already registered')) {
        errorMessage = 'This email is already registered. Please use the "Already have an account? Login" button to log in instead.';
      }
      setError(errorMessage);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!studentEmail) {
      setError('Please enter your email');
      return;
    }
    
    if (!studentPassword) {
      setError('Please enter your password');
      return;
    }

    try {
      // Email + password login for students (created by teacher)
      await loginStudent(studentEmail, studentPassword);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please check your credentials and try again.');
    }
  };

  const handleTeacherAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (teacherAccessPassword === 'mahliyo_teacher_admin') {
      try {
        // Automatically log in with the teacher account
        await loginTeacher('ukamolxodjayev@gmail.com', 'mahliyo_teacher_admin');
        // Navigation will happen automatically via useEffect when profile is set
      } catch (err: any) {
        setError(err.message || 'Failed to access teacher dashboard');
      }
    } else {
      setError('Invalid access password');
    }
  };

  if (isTeacherLogin && !teacherAccessGranted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-black p-3 rounded-xl">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">
              Teacher Access
            </h1>
            <p className="text-center text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
              Enter the access password to continue
            </p>

            <form onSubmit={handleTeacherAccessSubmit} className="space-y-4">
              <div>
                <label htmlFor="accessPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="accessPassword"
                    type="password"
                    value={teacherAccessPassword}
                    onChange={(e) => setTeacherAccessPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                    placeholder="Enter access password"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={!teacherAccessPassword}
                  className="w-full bg-black text-white px-4 py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTeacherLogin(false);
                    setIsStudentLogin(true);
                    setTeacherAccessPassword('');
                    setTeacherAccessGranted(false);
                    setError('');
                  }}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 transition underline"
                >
                  Back to student login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isTeacherLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-black p-3 rounded-xl">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">
              Teacher Login
            </h1>
            <p className="text-center text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
              Enter your email and password to continue
            </p>

            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                      placeholder="Enter your username"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                    placeholder="Enter your email"
                    disabled={loading}
                    autoFocus={!isSignUp}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={loading || !email || !password || (isSignUp && !username)}
                  className="w-full bg-black text-white px-4 py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (isSignUp ? 'Creating account...' : 'Logging in...') : (isSignUp ? 'Sign Up' : 'Login')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                  }}
                  disabled={loading}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isStudentLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-black p-3 rounded-xl">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
              Course Platform
            </h1>
            <p className="text-center text-gray-600 mb-8">
              Sign in to continue as a student
            </p>

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="studentEmail"
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                    placeholder="Enter your email"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="studentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="studentPassword"
                    type="password"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={loading || !studentEmail || !studentPassword}
                  className="w-full bg-black text-white px-4 py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
                <div className="pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsStudentLogin(false);
                      setIsTeacherLogin(true);
                      setStudentEmail('');
                      setStudentPassword('');
                      setEmail('');
                      setPassword('');
                      setUsername('');
                      setError('');
                      setIsSignUp(false);
                      setTeacherAccessGranted(false);
                      setTeacherAccessPassword('');
                    }}
                    disabled={loading}
                    className="w-full text-sm text-gray-600 hover:text-gray-800 transition underline"
                  >
                    Continue as a Teacher
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // This should never be reached since isStudentLogin defaults to true
  return null;
}
