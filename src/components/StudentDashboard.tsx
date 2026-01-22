import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Course } from '../lib/supabase';
import { BookOpen, FileText, LogOut, Clock, HelpCircle, Star, Users, ListMusic } from 'lucide-react';

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
  const [allPlaylists, setAllPlaylists] = useState<any[]>([]);
  const [lessonPlaylists, setLessonPlaylists] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'tests'>('lessons');

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Only load if we haven't loaded yet or if profile changed
    if (profile?.id && !hasLoadedRef.current) {
      loadData();
      hasLoadedRef.current = true;
    }
  }, [profile?.id]);

  const loadData = async () => {
    // Don't reload if data already exists
    if (courses.length > 0 && tests.length > 0 && hasLoadedRef.current) {
      return;
    }
    
    await Promise.all([loadCourses(), loadTests(), loadAllPlaylists(), loadLessonPlaylists()]);
  };

  const loadCourses = async () => {
    try {
      // Fetch courses and course_playlists in parallel
      const [coursesResult, coursePlaylistsResult] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('course_playlists').select('course_id'),
      ]);

      if (coursesResult.error) {
        console.error('Error loading courses:', coursesResult.error);
        setCourses([]);
        return;
      }

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
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]);
    }
  };

  const loadTests = async () => {
    try {
      // Get all tests that are in playlists first (single query)
      const { data: playlistTests } = await supabase
        .from('playlist_tests')
        .select('test_id');

      let testIdsInPlaylists = new Set<string>();
      if (playlistTests) {
        testIdsInPlaylists = new Set(playlistTests.map(pt => pt.test_id));
    }

      // Students can access all tests
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading tests:', error);
        return;
      }

      if (!data || data.length === 0) {
        setTests([]);
        return;
      }

      // Filter out tests that are in playlists
      const testsNotInPlaylists = data.filter(test => !testIdsInPlaylists.has(test.id));

      if (testsNotInPlaylists.length === 0) {
        setTests([]);
        return;
      }

      const testIds = testsNotInPlaylists.map(t => t.id);

      // Batch fetch all question counts at once
      const { data: questionCountsData } = await supabase
        .from('test_questions')
        .select('test_id')
        .in('test_id', testIds);

      // Batch fetch all ratings at once
      const { data: allRatingsData } = await supabase
        .from('test_ratings')
        .select('test_id, rating, user_id')
        .in('test_id', testIds);

      // Calculate question counts
      const questionCountsMap = new Map<string, number>();
      if (questionCountsData) {
        questionCountsData.forEach(q => {
          questionCountsMap.set(q.test_id, (questionCountsMap.get(q.test_id) || 0) + 1);
        });
      }

      // Calculate ratings and participants
      const ratingsMap = new Map<string, { sum: number; count: number; users: Set<string> }>();
      if (allRatingsData) {
        allRatingsData.forEach(r => {
          const existing = ratingsMap.get(r.test_id) || { sum: 0, count: 0, users: new Set<string>() };
          existing.sum += r.rating;
          existing.count += 1;
          existing.users.add(r.user_id);
          ratingsMap.set(r.test_id, existing);
        });
      }

      // Map results
      const testsWithDetails = testsNotInPlaylists.map(test => {
        const ratingData = ratingsMap.get(test.id);
        const questionCount = questionCountsMap.get(test.id) || 0;
        const averageRating = ratingData && ratingData.count > 0 ? ratingData.sum / ratingData.count : 0;
        const participantsCount = ratingData ? ratingData.users.size : 0;

        return {
          ...test,
          question_count: questionCount,
          average_rating: averageRating,
          participants_count: participantsCount,
        };
      });

      setTests(testsWithDetails);
    } catch (error) {
      console.error('Error loading tests:', error);
    }
  };

  const loadAllPlaylists = async () => {
    try {
      // Batch fetch all related data in parallel
      const [allPlaylistsResult, coursePlaylistsResult, playlistTestsResult] = await Promise.all([
        supabase.from('playlists').select('*').order('created_at', { ascending: false }),
        supabase.from('course_playlists').select('playlist_id'),
        supabase.from('playlist_tests').select('playlist_id'),
      ]);

      const allPlaylistsData = allPlaylistsResult.data;
      const coursePlaylistsData = coursePlaylistsResult.data;
      const playlistTestsData = playlistTestsResult.data;

      if (!allPlaylistsData) {
        setAllPlaylists([]);
        return;
      }

      if (!playlistTestsData || playlistTestsData.length === 0) {
        setAllPlaylists([]);
        return;
      }

      const testPlaylistIds = new Set(playlistTestsData.map(pt => pt.playlist_id));
      
      // Filter playlists that contain tests
      const testPlaylists = allPlaylistsData.filter(p => testPlaylistIds.has(p.id));
      
      // Show all test playlists (standalone or linked to courses)
      setAllPlaylists(testPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      setAllPlaylists([]);
    }
  };

  const loadLessonPlaylists = async () => {
    try {
      // Batch fetch in parallel
      const [coursePlaylistsResult, playlistTestsResult] = await Promise.all([
        supabase.from('course_playlists').select('playlist_id'),
        supabase.from('playlist_tests').select('playlist_id'),
      ]);

      const coursePlaylistsData = coursePlaylistsResult.data;
      const playlistTestsData = playlistTestsResult.data;

      if (!coursePlaylistsData || coursePlaylistsData.length === 0) {
        setLessonPlaylists([]);
        return;
      }

      const playlistIds = [...new Set(coursePlaylistsData.map(cp => cp.playlist_id))];
      
      // Filter out playlists that contain tests
      const testPlaylistIds = new Set(playlistTestsData?.map(pt => pt.playlist_id) || []);
      const lessonPlaylistIds = playlistIds.filter(id => !testPlaylistIds.has(id));
      
      if (lessonPlaylistIds.length === 0) {
        setLessonPlaylists([]);
        return;
      }

      const { data: playlistsData } = await supabase
        .from('playlists')
        .select('*')
        .in('id', lessonPlaylistIds)
        .order('created_at', { ascending: false });

      setLessonPlaylists(playlistsData || []);
    } catch (error) {
      console.error('Error loading lesson playlists:', error);
      setLessonPlaylists([]);
  }
  };

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
              Lessons
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`flex-1 px-3 sm:px-6 py-2 rounded-md font-medium transition text-sm sm:text-base ${
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
        {courses.length === 0 && lessonPlaylists.length === 0 ? (
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
                    {lessonPlaylists.map((playlist) => (
                      <div 
                        key={playlist.id}
                        className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition"
                        onClick={() => navigate(`/student/playlist/${playlist.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <ListMusic className="w-4 h-4 text-gray-500" />
                            <h3 className="font-semibold text-base sm:text-lg text-gray-900">{playlist.title}</h3>
                          </div>
                          <p className="text-gray-600 text-sm truncate">{playlist.description || 'No description'}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Mode: {playlist.access_mode === 'sequential' ? 'Sequential' : 'Any'}
                          </p>
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
              {tests.length === 0 && allPlaylists.length === 0 ? (
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
                    {allPlaylists.map((playlist) => (
                      <div 
                        key={playlist.id} 
                        className="p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition"
                        onClick={() => navigate(`/student/playlist/${playlist.id}`)}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <ListMusic className="w-5 h-5 text-gray-600" />
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900">{playlist.title}</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-2">{playlist.description || 'No description'}</p>
                        <p className="text-xs text-gray-500">
                          Mode: {playlist.access_mode === 'sequential' ? 'Sequential' : 'Any'}
                  </p>
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
