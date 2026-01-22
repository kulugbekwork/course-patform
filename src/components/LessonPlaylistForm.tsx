import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Course } from '../lib/supabase';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';

export default function LessonPlaylistForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId'); // Optional: link to specific lesson
  const { profile } = useAuth();
  const [stage, setStage] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessMode, setAccessMode] = useState<'any' | 'sequential'>('sequential');
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [courseOrders, setCourseOrders] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadAvailableCourses();
      if (id) {
        loadPlaylist();
      }
    }
  }, [profile?.id, id]);

  const loadAvailableCourses = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('courses')
        .select('id, title, description')
        .eq('teacher_id', profile?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (data) setAvailableCourses(data);
    } catch (err: any) {
      console.error('Error loading courses:', err);
    }
  };

  const loadPlaylist = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id)
        .eq('teacher_id', profile?.id)
        .single();

      if (playlistError) throw playlistError;
      if (playlistData) {
        setTitle(playlistData.title);
        setDescription(playlistData.description || '');
        setAccessMode(playlistData.access_mode || 'sequential');

        // Load courses linked to this playlist
        const { data: coursePlaylists, error: coursesError } = await supabase
          .from('course_playlists')
          .select('course_id')
          .eq('playlist_id', id);

        if (!coursesError && coursePlaylists) {
          const courseIds = coursePlaylists.map(cp => cp.course_id);
          setSelectedCourseIds(courseIds);
          const orders: { [key: string]: number } = {};
          coursePlaylists.forEach((cp, index) => {
            orders[cp.course_id] = index;
          });
          setCourseOrders(orders);
        }
      }
    } catch (err: any) {
      console.error('Error loading playlist:', err);
      setError(err.message || 'Failed to load lesson playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleStage1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a lesson playlist title');
      return;
    }
    setError('');
    setStage(2);
  };

  const toggleCourseSelection = (courseId: string) => {
    if (selectedCourseIds.includes(courseId)) {
      setSelectedCourseIds(selectedCourseIds.filter(id => id !== courseId));
      const newOrders = { ...courseOrders };
      delete newOrders[courseId];
      setCourseOrders(newOrders);
    } else {
      const newOrder = selectedCourseIds.length;
      setSelectedCourseIds([...selectedCourseIds, courseId]);
      setCourseOrders({ ...courseOrders, [courseId]: newOrder });
    }
  };

  const removeCourse = (courseId: string) => {
    setSelectedCourseIds(selectedCourseIds.filter(id => id !== courseId));
    const newOrders = { ...courseOrders };
    delete newOrders[courseId];
    setCourseOrders(newOrders);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCourseIds.length === 0) {
      setError('Please add at least one lesson to this playlist');
      return;
    }
    setError('');
    setLoading(true);

    try {
      let playlistId = id;

      if (id) {
        // Update existing playlist
        const { error: updateError } = await supabase
          .from('playlists')
          .update({
            title,
            description: description || null,
            access_mode: accessMode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('teacher_id', profile?.id);

        if (updateError) throw updateError;

        // Delete existing course_playlists
        await supabase
          .from('course_playlists')
          .delete()
          .eq('playlist_id', id);

        // Insert new course_playlists
        const coursePlaylistsToInsert = selectedCourseIds.map(courseId => ({
          playlist_id: id,
          course_id: courseId,
        }));

        const { error: coursesError } = await supabase
          .from('course_playlists')
          .insert(coursePlaylistsToInsert);

        if (coursesError) throw coursesError;
      } else {
        // Create new playlist
        const { data: playlistData, error: insertError } = await supabase
          .from('playlists')
          .insert({
            title,
            description: description || null,
            teacher_id: profile?.id,
            access_mode: accessMode,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!playlistData) throw new Error('Failed to create lesson playlist');
        playlistId = playlistData.id;

        // Insert course_playlists
        const coursePlaylistsToInsert = selectedCourseIds.map(courseId => ({
          playlist_id: playlistData.id,
          course_id: courseId,
        }));

        const { error: coursesError } = await supabase
          .from('course_playlists')
          .insert(coursePlaylistsToInsert);

        if (coursesError) throw coursesError;
      }

      navigate('/teacher/dashboard');
    } catch (err: any) {
      console.error('Error saving lesson playlist:', err);
      setError(err.message || 'Failed to save lesson playlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedCourses = () => {
    return availableCourses
      .filter(course => selectedCourseIds.includes(course.id))
      .sort((a, b) => {
        const orderA = courseOrders[a.id] ?? 0;
        const orderB = courseOrders[b.id] ?? 0;
        return orderA - orderB;
      });
  };

  if (loading && id) {
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
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold text-black">
                {id ? 'Edit Lesson Playlist' : 'Create Lesson Playlist'}
              </h2>
              <div className="w-full relative">
                <div className="flex mb-1">
                  <span className={`text-sm font-medium ${stage >= 1 ? 'text-black' : 'text-gray-400'}`}>1</span>
                  <span className={`text-sm font-medium absolute left-1/2 transform -translate-x-1/2 ${stage === 2 ? 'text-black' : 'text-gray-400'}`}>2</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all"
                    style={{ width: `${(stage / 2) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className={`text-xs ${stage >= 1 ? 'text-black' : 'text-gray-400'}`}></span>
                  <span className={`text-xs ${stage === 2 ? 'text-black' : 'text-gray-400'}`}></span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">

          {stage === 1 ? (
            <form onSubmit={handleStage1Submit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Lesson Playlist Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                  placeholder="Enter lesson playlist title"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                  placeholder="Enter lesson playlist description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Mode *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="accessMode"
                      value="sequential"
                      checked={accessMode === 'sequential'}
                      onChange={(e) => setAccessMode(e.target.value as 'sequential')}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-sm">Sequential - Students access lessons one by one in order</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="accessMode"
                      value="any"
                      checked={accessMode === 'any'}
                      onChange={(e) => setAccessMode(e.target.value as 'any')}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-sm">Any - Students can access any lesson they want</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
                >
                  Next
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div>
                <label htmlFor="courseSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Add Lesson
                </label>
                {availableCourses.length === 0 ? (
                  <p className="text-gray-600">No lessons available. Create a lesson first to add to this playlist.</p>
                ) : (
                  <select
                    id="courseSelect"
                    value=""
                    onChange={(e) => {
                      const courseId = e.target.value;
                      if (courseId && !selectedCourseIds.includes(courseId)) {
                        toggleCourseSelection(courseId);
                        e.target.value = ''; // Reset dropdown
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                  >
                    <option value="">Select a lesson to add...</option>
                    {availableCourses
                      .filter(course => !selectedCourseIds.includes(course.id))
                      .map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {selectedCourseIds.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-black mb-4">
                    Lessons Added to Playlist
                  </h3>
                  <div className="space-y-2">
                    {getSelectedCourses().map((course, index) => (
                      <div
                        key={course.id}
                        className="p-3 border border-black rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-black">
                              {index + 1}. {course.title}
                            </div>
                            {course.description && (
                              <div className="text-sm text-gray-600 mt-1">{course.description}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCourse(course.id)}
                            className="ml-4 text-red-600 hover:text-red-800 transition"
                            title="Remove lesson from playlist"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedCourseIds.length === 0}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : id ? 'Update Lesson Playlist' : 'Create Lesson Playlist'}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
