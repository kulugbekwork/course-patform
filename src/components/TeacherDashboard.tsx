import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Course } from '../lib/supabase';
import { Plus, BookOpen, Edit, Trash2, MoreVertical, FileText, User, ListMusic } from 'lucide-react';
import CreateTypePopup from './CreateTypePopup';

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
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [lessonPlaylists, setLessonPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openTestMenuId, setOpenTestMenuId] = useState<string | null>(null);
  const [openPlaylistMenuId, setOpenPlaylistMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'tests'>('lessons');
  const [showCreatePopup, setShowCreatePopup] = useState(false);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Only load if we haven't loaded yet
    if (profile?.id && !hasLoadedRef.current) {
      loadData();
      hasLoadedRef.current = true;
    }
  }, [profile?.id]);


  const loadData = async (force = false) => {
    // Don't reload if data already exists, unless forced
    if (!force && courses.length > 0 && tests.length > 0 && hasLoadedRef.current) {
      return;
    }
    
    setLoading(true);
    await Promise.all([loadCourses(), loadTests(), loadPlaylists(), loadLessonPlaylists()]);
    setLoading(false);
  };

  const loadCourses = async () => {
    // Fetch in parallel
    const [coursesResult, coursePlaylistsResult] = await Promise.all([
      supabase
        .from('courses')
        .select('*')
        .eq('teacher_id', profile?.id)
        .order('created_at', { ascending: false }),
      supabase.from('course_playlists').select('course_id'),
    ]);

    const allCourses = coursesResult.data;
    const coursePlaylists = coursePlaylistsResult.data;

    if (!allCourses) {
      setCourses([]);
      return;
    }

    if (coursePlaylists && coursePlaylists.length > 0) {
      const linkedCourseIds = new Set(coursePlaylists.map(cp => cp.course_id));
      // Filter out courses that are in playlists
      const filteredCourses = allCourses.filter(course => !linkedCourseIds.has(course.id));
      setCourses(filteredCourses);
    } else {
      setCourses(allCourses);
    }
  };

  const loadTests = async () => {
    // Fetch in parallel
    const [testsResult, playlistTestsResult] = await Promise.all([
      supabase
        .from('tests')
        .select('*')
        .eq('teacher_id', profile?.id)
        .order('created_at', { ascending: false }),
      supabase.from('playlist_tests').select('test_id'),
    ]);

    const allTests = testsResult.data;
    const playlistTests = playlistTestsResult.data;

    if (!allTests) {
      setTests([]);
      return;
    }

    if (playlistTests && playlistTests.length > 0) {
      const testIdsInPlaylists = new Set(playlistTests.map(pt => pt.test_id));
      // Filter out tests that are in playlists
      const filteredTests = allTests.filter(test => !testIdsInPlaylists.has(test.id));
      setTests(filteredTests);
    } else {
      setTests(allTests);
    }
  };

  const loadPlaylists = async () => {
    // Fetch in parallel
    const [playlistsResult, playlistTestsResult] = await Promise.all([
      supabase
        .from('playlists')
        .select('*')
        .eq('teacher_id', profile?.id)
        .order('created_at', { ascending: false }),
      supabase.from('playlist_tests').select('playlist_id'),
    ]);

    const allPlaylists = playlistsResult.data;
    const playlistTests = playlistTestsResult.data;

    if (!allPlaylists) {
      setPlaylists([]);
      return;
    }

    if (playlistTests && playlistTests.length > 0) {
      const testPlaylistIds = new Set(playlistTests.map(pt => pt.playlist_id));
      // Filter playlists that contain tests (these are test playlists)
      const testPlaylists = allPlaylists.filter(p => testPlaylistIds.has(p.id));
      setPlaylists(testPlaylists);
    } else {
      setPlaylists([]);
    }
  };

  const loadLessonPlaylists = async () => {
    if (!profile?.id) return;
    try {
      // Fetch courses and course_playlists in parallel
      const [coursesResult, playlistTestsResult] = await Promise.all([
        supabase.from('courses').select('id').eq('teacher_id', profile.id),
        supabase.from('playlist_tests').select('playlist_id'),
      ]);

      const coursesData = coursesResult.data;
      const playlistTestsData = playlistTestsResult.data;

      if (!coursesData || coursesData.length === 0) {
        setLessonPlaylists([]);
        return;
      }

      const courseIds = coursesData.map(c => c.id);
      const { data: coursePlaylistsData } = await supabase
        .from('course_playlists')
        .select('playlist_id')
        .in('course_id', courseIds);

      if (coursePlaylistsData && coursePlaylistsData.length > 0) {
        const playlistIds = [...new Set(coursePlaylistsData.map(cp => cp.playlist_id))];
        
        // Filter out playlists that contain tests
        const testPlaylistIds = new Set(playlistTestsData?.map(pt => pt.playlist_id) || []);
        const lessonPlaylistIds = playlistIds.filter(id => !testPlaylistIds.has(id));
        
        if (lessonPlaylistIds.length > 0) {
          const { data: playlistsData } = await supabase
            .from('playlists')
            .select('*')
            .in('id', lessonPlaylistIds)
            .eq('teacher_id', profile.id)
            .order('created_at', { ascending: false });

          setLessonPlaylists(playlistsData || []);
        } else {
          setLessonPlaylists([]);
        }
      } else {
        setLessonPlaylists([]);
      }
    } catch (error) {
      console.error('Error loading lesson playlists:', error);
      setLessonPlaylists([]);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (!error) {
      // Update state immediately for instant feedback
      setCourses(courses.filter(c => c.id !== courseId));
      // Refresh to update playlists if needed
      loadData(true);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return;

    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testId);

    if (!error) {
      // Update state immediately for instant feedback
      setTests(tests.filter(t => t.id !== testId));
      // Refresh to update playlists if needed
      loadData(true);
    }
  };

  const handleDeletePlaylist = async (playlistId: string, isLessonPlaylist: boolean) => {
    if (!confirm('Are you sure you want to delete this playlist? The items will be available again in the dashboard.')) return;

    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId)
      .eq('teacher_id', profile?.id);

    if (!error) {
      // Update state immediately
      if (isLessonPlaylist) {
        setLessonPlaylists(lessonPlaylists.filter(p => p.id !== playlistId));
      } else {
        setPlaylists(playlists.filter(p => p.id !== playlistId));
      }
      // Force refresh to show courses/tests that were in the playlist
      loadData(true);
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
              onClick={() => navigate('/teacher/profile')}
              className="flex items-center justify-center text-black hover:text-gray-600 transition"
              title="Profile"
            >
              <User className="w-5 h-5" />
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
              Lessons
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`flex-1 px-6 py-2 rounded-md font-medium transition ${
                activeTab === 'tests'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tests
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
                onClick={() => setShowCreatePopup(true)}
                className="flex items-center justify-center bg-black text-white p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-gray-800 transition sm:space-x-2"
                title="Create"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Create</span>
              </button>
            </div>

            {courses.length === 0 && lessonPlaylists.length === 0 ? (
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
                  {lessonPlaylists.map((playlist) => (
                    <div key={playlist.id} className="flex items-center justify-between p-3 sm:p-4 relative">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/teacher/lesson-playlist/${playlist.id}/view`)}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <ListMusic className="w-4 h-4 text-gray-500" />
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900">{playlist.title}</h3>
                        </div>
                        <p className="text-gray-600 text-sm truncate">{playlist.description || 'No description'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Mode: {playlist.access_mode === 'sequential' ? 'Sequential' : 'Any'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-2 sm:ml-4 relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPlaylistMenuId(openPlaylistMenuId === playlist.id ? null : playlist.id);
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                        {openPlaylistMenuId === playlist.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenPlaylistMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeTab === 'lessons') {
                                    navigate(`/teacher/lesson-playlist/${playlist.id}`);
                                  } else {
                                    navigate(`/teacher/playlist/${playlist.id}`);
                                  }
                                  setOpenPlaylistMenuId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePlaylist(playlist.id, true);
                                  setOpenPlaylistMenuId(null);
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
                onClick={() => setShowCreatePopup(true)}
                className="flex items-center justify-center bg-black text-white p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-gray-800 transition sm:space-x-2"
                title="Create"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Create</span>
              </button>
            </div>

            {tests.length === 0 && playlists.length === 0 ? (
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
                  {playlists.map((playlist) => (
                    <div key={playlist.id} className="flex items-center justify-between p-3 sm:p-4 relative">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/teacher/playlist/${playlist.id}/view`)}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <ListMusic className="w-4 h-4 text-gray-500" />
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900">{playlist.title}</h3>
                        </div>
                        <p className="text-gray-600 text-sm truncate">{playlist.description || 'No description'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Mode: {playlist.access_mode === 'sequential' ? 'Sequential' : 'Any'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-2 sm:ml-4 relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPlaylistMenuId(openPlaylistMenuId === playlist.id ? null : playlist.id);
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                        {openPlaylistMenuId === playlist.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenPlaylistMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeTab === 'lessons') {
                                    navigate(`/teacher/lesson-playlist/${playlist.id}`);
                                  } else {
                                    navigate(`/teacher/playlist/${playlist.id}`);
                                  }
                                  setOpenPlaylistMenuId(null);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePlaylist(playlist.id, false);
                                  setOpenPlaylistMenuId(null);
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

      {showCreatePopup && (
        <CreateTypePopup
          onClose={() => setShowCreatePopup(false)}
          mode={activeTab === 'tests' ? 'test' : 'lesson'}
          onSelectTest={(mode) => {
            if (mode === 'create') {
              navigate('/teacher/test/new');
            } else {
              navigate('/teacher/test/new/upload');
            }
          }}
          onSelectPlaylist={() => {
            if (activeTab === 'lessons') {
              navigate('/teacher/lesson-playlist/new');
            } else {
              navigate('/teacher/playlist/new');
            }
          }}
          onSelectLesson={() => navigate('/teacher/lesson/new')}
        />
      )}
    </div>
  );
}
