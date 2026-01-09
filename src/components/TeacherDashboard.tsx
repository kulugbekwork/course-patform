import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Course } from '../lib/supabase';
import { Plus, BookOpen, Edit, Trash2, MoreVertical, FileText, LogOut } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  created_at: string;
  updated_at: string;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openTestMenuId, setOpenTestMenuId] = useState<string | null>(null);
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
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('teacher_id', profile?.id)
      .order('created_at', { ascending: false });

    if (data) setCourses(data);
  };

  const loadTests = async () => {
    const { data } = await supabase
      .from('tests')
      .select('*')
      .eq('teacher_id', profile?.id)
      .order('created_at', { ascending: false });

    if (data) setTests(data);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (!error) {
      loadCourses();
    }
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return;

    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testId);

    if (!error) {
      loadTests();
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-black">Lessons</h2>
              <button
                onClick={() => navigate('/teacher/lesson/new')}
                className="flex items-center justify-center bg-black text-white p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-gray-800 transition sm:space-x-2"
                title="Add Lesson"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Lesson</span>
              </button>
            </div>

            {courses.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-black mb-2">No lessons yet</h3>
                <p className="text-gray-600">Get started by creating your first lesson</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="divide-y divide-gray-200">
                  {courses.map((course) => (
                    <div key={course.id} className="flex items-center justify-between p-3 sm:p-4 relative">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/teacher/lesson/${course.id}/view`)}
                      >
                        <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1">{course.title}</h3>
                        <p className="text-gray-600 text-sm truncate">{course.description || 'No description'}</p>
                      </div>
                      <div className="flex-shrink-0 ml-2 sm:ml-4 relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === course.id ? null : course.id);
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                        {openMenuId === course.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/teacher/lesson/${course.id}`);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                              <div className="border-t border-gray-200 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCourse(course.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </>
                        )}
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
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-black">Tests</h2>
              <button
                onClick={() => navigate('/teacher/test/new')}
                className="flex items-center justify-center bg-black text-white p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-gray-800 transition sm:space-x-2"
                title="Add Test"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Test</span>
              </button>
            </div>

            {tests.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-black mb-2">No tests yet</h3>
                <p className="text-gray-600">Get started by creating your first test</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="divide-y divide-gray-200">
                  {tests.map((test) => (
                    <div key={test.id} className="flex items-center justify-between p-3 sm:p-4 relative">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/teacher/test/${test.id}/view`)}
                      >
                        <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1">{test.title}</h3>
                        <p className="text-gray-600 text-sm truncate">{test.description || 'No description'}</p>
                      </div>
                      <div className="flex-shrink-0 ml-2 sm:ml-4 relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenTestMenuId(openTestMenuId === test.id ? null : test.id);
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                        {openTestMenuId === test.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenTestMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/teacher/test/${test.id}`);
                                  setOpenTestMenuId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                              <div className="border-t border-gray-200 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTest(test.id);
                                  setOpenTestMenuId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </>
                        )}
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
