import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Course } from '../lib/supabase';
import { BookOpen, FileText, LogOut, Clock, HelpCircle, Star, Users } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  time_minutes: number | null;
  created_at: string;
  updated_at: string;
  question_count?: number;
  average_rating?: number;
  participants_count?: number;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lessons' | 'tests'>('lessons');

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadCourses(), loadTests()]);
    setLoading(false);
  };

  const loadCourses = async () => {
    try {
      // Students can access all courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (coursesError) {
        console.error('Error loading courses:', coursesError);
        return;
      }

      if (coursesData) {
        setCourses(coursesData);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const loadTests = async () => {
    try {
      // Students can access all tests
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading tests:', error);
        return;
      }

      if (data) {
        // Fetch question counts and ratings for each test
        const testsWithDetails = await Promise.all(
          data.map(async (test) => {
            // Get question count
            const { count: questionCount } = await supabase
              .from('test_questions')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);

            // Get ratings and calculate average
            const { data: ratingsData } = await supabase
              .from('test_ratings')
              .select('rating, user_id')
              .eq('test_id', test.id);

            let averageRating = 0;
            let participantsCount = 0;
            if (ratingsData && ratingsData.length > 0) {
              const sum = ratingsData.reduce((acc, r) => acc + r.rating, 0);
              averageRating = sum / ratingsData.length;
              // Count unique users who have rated (passed the test)
              const uniqueUsers = new Set(ratingsData.map(r => r.user_id));
              participantsCount = uniqueUsers.size;
            }

            return {
              ...test,
              question_count: questionCount || 0,
              average_rating: averageRating,
              participants_count: participantsCount,
            };
          })
        );

        setTests(testsWithDetails);
      }
    } catch (error) {
      console.error('Error loading tests:', error);
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
            <h1 className="text-xl font-bold text-black">Course platform</h1>
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
        {/* Toggle Switch */}
        <div className="mb-8">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('lessons')}
              className={`flex-1 px-3 sm:px-6 py-2 rounded-md font-medium transition text-sm sm:text-base ${
                activeTab === 'lessons'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lessons ({courses.length})
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`flex-1 px-6 py-2 rounded-md font-medium transition ${
                activeTab === 'tests'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tests ({tests.length})
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Lessons Section */}
          {activeTab === 'lessons' && (
            <div>
              {courses.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-black mb-2">No lessons yet</h3>
                  <p className="text-gray-600">No lessons available at the moment.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm">
                  <div className="divide-y divide-gray-200">
                    {courses.map((course) => (
                      <div 
                        key={course.id} 
                        className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition"
                        onClick={() => navigate(`/student/lesson/${course.id}/view`)}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1">{course.title}</h3>
                          <p className="text-gray-600 text-sm truncate">{course.description || 'No description'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tests Section */}
          {activeTab === 'tests' && (
            <div>
              {tests.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-black mb-2">No tests yet</h3>
                  <p className="text-gray-600">No tests available at the moment.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm">
                  <div className="divide-y divide-gray-200">
                    {tests.map((test) => (
                      <div 
                        key={test.id} 
                        className="p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition"
                        onClick={() => navigate(`/student/test/${test.id}/view`)}
                      >
                        <div className="flex-1 min-w-0 mb-3 sm:mb-4">
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1">{test.title}</h3>
                          <p className="text-gray-600 text-sm">{test.description || 'No description'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          {/* Time Card */}
                          <div className="bg-green-50 rounded-lg p-2 sm:p-3">
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <div className="bg-green-100 rounded-lg p-1 sm:p-1.5 flex-shrink-0">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 mb-0.5">Time</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-900">
                                  {test.time_minutes || 0} {test.time_minutes === 1 ? 'min' : 'min'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Questions Card */}
                          <div className="bg-blue-50 rounded-lg p-2 sm:p-3">
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <div className="bg-blue-100 rounded-lg p-1 sm:p-1.5 flex-shrink-0">
                                <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 mb-0.5">Questions</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-900">
                                  {test.question_count || 0}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Rating Card */}
                          <div className="bg-yellow-50 rounded-lg p-2 sm:p-3">
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <div className="bg-yellow-100 rounded-lg p-1 sm:p-1.5 flex-shrink-0">
                                <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600 fill-yellow-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 mb-0.5">Rating</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-900">
                                  {test.average_rating && test.average_rating > 0 ? test.average_rating.toFixed(1) : '0.0'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Participants Card */}
                          <div className="bg-purple-50 rounded-lg p-2 sm:p-3">
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <div className="bg-purple-100 rounded-lg p-1 sm:p-1.5 flex-shrink-0">
                                <Users className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 mb-0.5">Participants</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-900">
                                  {test.participants_count || 0}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
