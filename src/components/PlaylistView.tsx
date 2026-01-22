import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Lock, Unlock, CheckCircle } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_available: boolean;
  is_completed: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_available: boolean;
  is_completed: boolean;
}

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  access_mode: 'any' | 'sequential';
}

export default function PlaylistView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isTestPlaylist, setIsTestPlaylist] = useState(false);
  const [error, setError] = useState('');

  const loadPlaylist = useCallback(async () => {
    if (!id || !profile?.id) return;
    setError('');

    try {
      // Fetch playlist, playlistTests, and coursePlaylists in parallel
      const [playlistResult, playlistTestsResult, coursePlaylistsResult] = await Promise.all([
        supabase.from('playlists').select('*').eq('id', id).single(),
        supabase
          .from('playlist_tests')
          .select('test_id, order_index')
          .eq('playlist_id', id)
          .order('order_index', { ascending: true }),
        supabase.from('course_playlists').select('course_id').eq('playlist_id', id),
      ]);

      const { data: playlistData, error: playlistError } = playlistResult;
      const { data: playlistTests } = playlistTestsResult;
      const { data: coursePlaylists } = coursePlaylistsResult;

      if (playlistError) throw playlistError;
      if (!playlistData) throw new Error('Playlist not found');
      setPlaylist(playlistData);

      // Determine playlist type
      if (playlistTests && playlistTests.length > 0) {
        // This is a test playlist
        setIsTestPlaylist(true);
        
        const testIds = playlistTests.map(pt => pt.test_id);
        const { data: testsData, error: testDetailsError } = await supabase
          .from('tests')
          .select('id, title, description')
          .in('id', testIds);

        if (testDetailsError) throw testDetailsError;

        // Load student progress (only for students)
        let completedTestIds: string[] = [];
        if (profile?.role === 'student') {
          const { data: progressData } = await supabase
            .from('playlist_student_progress')
            .select('current_test_id, completed_test_ids')
            .eq('playlist_id', id)
            .eq('student_id', profile.id)
            .maybeSingle();

          completedTestIds = progressData?.completed_test_ids || [];
        }

        // Map tests with availability and completion status
        const testsWithStatus: Test[] = playlistTests.map(pt => {
          const test = testsData?.find(t => t.id === pt.test_id);
          if (!test) return null;

          const isCompleted = profile?.role === 'student' ? completedTestIds.includes(test.id) : false;
          let isAvailable = true; // Teachers can always see all tests

          if (profile?.role === 'student' && playlistData.access_mode === 'sequential') {
            // Sequential mode: first test is always available, others unlock after previous completion
            if (pt.order_index === 0) {
              isAvailable = true;
            } else {
              const previousTest = playlistTests[pt.order_index - 1];
              isAvailable = completedTestIds.includes(previousTest.test_id);
            }
          }

          return {
            id: test.id,
            title: test.title,
            description: test.description,
            order_index: pt.order_index,
            is_available: isAvailable,
            is_completed: isCompleted,
          };
        }).filter((t): t is Test => t !== null);

        setTests(testsWithStatus);
      } else if (coursePlaylists && coursePlaylists.length > 0) {
        // This is a lesson playlist
        setIsTestPlaylist(false);
        
        const courseIds = coursePlaylists.map(cp => cp.course_id);
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('id, title, description')
          .in('id', courseIds);

        if (coursesError) throw coursesError;

        // Load student progress for lesson playlists (using completed_test_ids to store completed course IDs)
        let completedCourseIds: string[] = [];
        if (profile?.role === 'student') {
          const { data: progressData } = await supabase
            .from('playlist_student_progress')
            .select('completed_test_ids')
            .eq('playlist_id', id)
            .eq('student_id', profile.id)
            .maybeSingle();

          // Reuse completed_test_ids field to store completed course IDs for lesson playlists
          completedCourseIds = progressData?.completed_test_ids || [];
        }

        // Map courses with order and availability
        const coursesWithOrder: Course[] = coursePlaylists.map((cp, index) => {
          const course = coursesData?.find(c => c.id === cp.course_id);
          if (!course) return null;

          const isCompleted = profile?.role === 'student' ? completedCourseIds.includes(course.id) : false;
          let isAvailable = true; // Teachers can always see all courses

          if (profile?.role === 'student' && playlistData.access_mode === 'sequential') {
            // Sequential mode: first course is always available, others unlock after previous completion
            if (index === 0) {
              isAvailable = true;
            } else {
              const previousCourse = coursePlaylists[index - 1];
              isAvailable = completedCourseIds.includes(previousCourse.course_id);
            }
          }

          return {
            id: course.id,
            title: course.title,
            description: course.description,
            order_index: index,
            is_available: isAvailable,
            is_completed: isCompleted,
          };
        }).filter((c): c is Course => c !== null);

        setCourses(coursesWithOrder);
      } else {
        // Empty playlist
        setIsTestPlaylist(true);
        setTests([]);
        setCourses([]);
      }
    } catch (err: any) {
      console.error('Error loading playlist:', err);
      setError(err.message || 'Failed to load playlist');
    }
  }, [id, profile?.id, profile?.role]);

  useEffect(() => {
    if (id && profile?.id) {
      loadPlaylist();
    }
  }, [id, profile?.id, loadPlaylist]);

  const handleTestClick = async (test: Test) => {
    if (!test.is_available) return;

    const basePath = profile?.role === 'student' ? '/student' : '/teacher';
    
    if (profile?.role === 'student') {
      try {
        // Update progress: set current test and mark as started
        const { data: existingProgress } = await supabase
          .from('playlist_student_progress')
          .select('*')
          .eq('playlist_id', id)
          .eq('student_id', profile?.id)
          .maybeSingle();

        if (existingProgress) {
          await supabase
            .from('playlist_student_progress')
            .update({
              current_test_id: test.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProgress.id);
        } else {
          await supabase
            .from('playlist_student_progress')
            .insert({
              playlist_id: id,
              student_id: profile?.id,
              current_test_id: test.id,
            });
        }

        // Navigate to test
        navigate(`${basePath}/test/${test.id}/take`);
      } catch (err: any) {
        console.error('Error updating progress:', err);
      }
    } else {
      // Teacher: just view the test
      navigate(`${basePath}/test/${test.id}/view`);
    }
  };

  const handleCourseClick = async (course: Course) => {
    if (!course.is_available) return;

    const basePath = profile?.role === 'student' ? '/student' : '/teacher';
    
    // Don't mark as completed automatically - let the student click "Complete" button in lesson view
    navigate(`${basePath}/lesson/${course.id}/view`);
  };

  const markTestCompleted = useCallback(async (testId: string) => {
    if (!id || !profile?.id) return;
    
    try {
      const { data: existingProgress } = await supabase
        .from('playlist_student_progress')
        .select('*')
        .eq('playlist_id', id)
        .eq('student_id', profile.id)
        .maybeSingle();

      const completedTestIds = existingProgress?.completed_test_ids || [];
      if (!completedTestIds.includes(testId)) {
        const updatedCompleted = [...completedTestIds, testId];
        
        if (existingProgress) {
          await supabase
            .from('playlist_student_progress')
            .update({
              completed_test_ids: updatedCompleted,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProgress.id);
        } else {
          await supabase
            .from('playlist_student_progress')
            .insert({
              playlist_id: id,
              student_id: profile.id,
              completed_test_ids: updatedCompleted,
            });
        }

        // Reload to update availability
        loadPlaylist();
      }
    } catch (err: any) {
      console.error('Error marking test as completed:', err);
    }
  }, [id, profile?.id, loadPlaylist]);

  // Listen for test completion (from TestTake component)
  useEffect(() => {
    if (!id || !profile?.id || !isTestPlaylist) return;

    const handleTestCompleted = (event: CustomEvent) => {
      const testId = event.detail.testId;
      if (testId) {
        markTestCompleted(testId);
      }
    };

    window.addEventListener('testCompleted' as any, handleTestCompleted as EventListener);
    return () => {
      window.removeEventListener('testCompleted' as any, handleTestCompleted as EventListener);
    };
  }, [id, profile?.id, isTestPlaylist, markTestCompleted]);

  // Listen for lesson completion (from LessonView component)
  useEffect(() => {
    const handleLessonCompleted = (event: CustomEvent) => {
      const courseId = event.detail.courseId;
      if (courseId && !isTestPlaylist) {
        // Reload playlist to update availability
        loadPlaylist();
      }
    };

    window.addEventListener('lessonCompleted' as any, handleLessonCompleted as EventListener);
    return () => {
      window.removeEventListener('lessonCompleted' as any, handleLessonCompleted as EventListener);
    };
  }, [id, profile?.id, isTestPlaylist]);

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
            <button
              onClick={() => {
                const basePath = profile?.role === 'student' ? '/student' : '/teacher';
                navigate(`${basePath}/dashboard`);
              }}
              className="flex items-center justify-center text-black hover:text-gray-600 transition mr-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-black">Playlist</h1>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <p className="text-red-600">{error || 'Playlist not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => {
                const basePath = profile?.role === 'student' ? '/student' : '/teacher';
                navigate(`${basePath}/dashboard`);
              }}
              className="flex items-center justify-center text-black hover:text-gray-600 transition mr-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-black">{playlist.title}</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isTestPlaylist ? (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Tests</h2>
              {tests.length === 0 ? (
                <p className="text-gray-600">No tests in this playlist</p>
              ) : (
                <div className="space-y-3">
                  {tests.map((test) => (
                    <div
                      key={test.id}
                      className={`p-4 border rounded-lg transition ${
                        test.is_available
                          ? 'border-gray-200 hover:border-black cursor-pointer'
                          : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      }`}
                      onClick={() => test.is_available && handleTestClick(test)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-black">
                              {test.order_index + 1}. {test.title}
                            </span>
                            {test.is_completed && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            {!test.is_available && (
                              <Lock className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          {test.description && (
                            <p className="text-sm text-gray-600 mt-1">{test.description}</p>
                          )}
                        </div>
                        {test.is_available && !test.is_completed && (
                          <Unlock className="w-5 h-5 text-black" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Lessons</h2>
              {courses.length === 0 ? (
                <p className="text-gray-600">No lessons in this playlist</p>
              ) : (
                <div className="space-y-3">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className={`p-4 border rounded-lg transition ${
                        course.is_available
                          ? 'border-gray-200 hover:border-black cursor-pointer'
                          : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      }`}
                      onClick={() => course.is_available && handleCourseClick(course)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-black">
                              {course.order_index + 1}. {course.title}
                            </span>
                            {course.is_completed && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            {!course.is_available && (
                              <Lock className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          {course.description && (
                            <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                          )}
                        </div>
                        {course.is_available && !course.is_completed && (
                          <Unlock className="w-5 h-5 text-black" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
