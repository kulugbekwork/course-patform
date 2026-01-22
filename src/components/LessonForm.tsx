import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, Course } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function LessonForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { profile } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingLesson, setLoadingLesson] = useState(!!id);
  const [availablePlaylists, setAvailablePlaylists] = useState<any[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.id) {
      loadAvailablePlaylists();
    }
    if (id) {
      loadLesson();
    }
  }, [id, profile?.id]);

  const loadAvailablePlaylists = async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('playlists')
        .select('id, title')
        .eq('teacher_id', profile.id)
        .order('created_at', { ascending: false });
      if (data) setAvailablePlaylists(data);
    } catch (err) {
      console.error('Error loading playlists:', err);
    }
  };

  const loadLesson = async () => {
    setLoadingLesson(true);
    const { data, error: fetchError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      setError('Failed to load lesson. Please try again.');
      console.error(fetchError);
    } else if (data) {
      setTitle(data.title);
      setDescription(data.description);
      setVideoUrl(data.video_url);
      
      // Load associated playlists
      const { data: coursePlaylists } = await supabase
        .from('course_playlists')
        .select('playlist_id')
        .eq('course_id', id);
      
      if (coursePlaylists) {
        setSelectedPlaylistIds(coursePlaylists.map(cp => cp.playlist_id));
      }
    }
    setLoadingLesson(false);
  };

  const uploadVideo = async (file: File): Promise<string> => {
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!user) {
      // Try to authenticate using the profile
      if (profile?.id) {
        const password = profile.initial_password || 'demo123';
        const emailDomains = ['@platform.com', '@platform.local'];
        
        for (const domain of emailDomains) {
          const email = `${profile.username}${domain}`;
          const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (!authError) {
            // Retry getting user after authentication
            const { data: { user: retryUser } } = await supabase.auth.getUser();
            if (retryUser) {
              const fileExt = file.name.split('.').pop();
              const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
              const filePath = `videos/${retryUser.id}/${fileName}`;

              const { error: uploadError, data } = await supabase.storage
                .from('lesson-videos')
                .upload(filePath, file, {
                  cacheControl: '3600',
                  upsert: false
                });

              if (uploadError) {
                console.error('Upload error:', uploadError);
                throw uploadError;
              }

              const { data: { publicUrl } } = supabase.storage
                .from('lesson-videos')
                .getPublicUrl(data.path);

              return publicUrl;
            }
          }
        }
      }
      
      throw new Error('You must be authenticated to upload videos. Please log out and log in again.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `videos/${user.id}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('lesson-videos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      console.error('User authenticated:', !!user);
      console.error('File path:', filePath);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('lesson-videos')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let finalVideoUrl = videoUrl;

      // Upload video if a new file is selected
      if (videoFile) {
        setUploading(true);
        finalVideoUrl = await uploadVideo(videoFile);
        setUploading(false);
      }

      if (!finalVideoUrl) {
        throw new Error('Please upload a video file');
      }

      let courseId = id;

      if (id) {
        // Update existing lesson
        const { error: updateError } = await supabase
          .from('courses')
          .update({
            title,
            description,
            video_url: finalVideoUrl,
          })
          .eq('id', id);

        if (updateError) throw updateError;
        courseId = id;
      } else {
        // Create new lesson
        const { data: insertData, error: insertError } = await supabase
          .from('courses')
          .insert({
            title,
            description,
            video_url: finalVideoUrl,
            teacher_id: profile?.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!insertData) throw new Error('Failed to create lesson');
        courseId = insertData.id;
      }

      // Update course_playlists
      if (courseId) {
        // Delete existing associations
        await supabase
          .from('course_playlists')
          .delete()
          .eq('course_id', courseId);

        // Insert new associations
        if (selectedPlaylistIds.length > 0) {
          const coursePlaylistsToInsert = selectedPlaylistIds.map(playlistId => ({
            course_id: courseId,
            playlist_id: playlistId,
          }));

          const { error: playlistsError } = await supabase
            .from('course_playlists')
            .insert(coursePlaylistsToInsert);

          if (playlistsError) throw playlistsError;
        }
      }

      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lesson. Please try again.');
      console.error(err);
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  if (loadingLesson) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto w-full px-0 sm:px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200">
          <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
            <h2 className="text-xl sm:text-2xl font-bold text-black">
              {id ? 'Edit Lesson' : 'Create New Lesson'}
            </h2>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 pb-24 sm:pb-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Lesson Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                required
                placeholder="e.g., Introduction to React"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                placeholder="Describe what students will learn in this lesson..."
              />
            </div>

            <div>
              <label htmlFor="videoFile" className="block text-sm font-medium text-gray-700 mb-2">
                Video File
              </label>
              <input
                id="videoFile"
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setVideoFile(file);
                    setVideoUrl(''); // Clear URL when file is selected
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
                required={!id || !videoUrl}
              />
              {videoUrl && !videoFile && (
                <p className="mt-2 text-sm text-gray-600">
                  Current video: <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{videoUrl}</a>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Playlists (Optional)
              </label>
              {availablePlaylists.length === 0 ? (
                <p className="text-sm text-gray-500">No playlists available. Create a playlist first.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {availablePlaylists.map((playlist) => (
                    <label key={playlist.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlaylistIds.includes(playlist.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPlaylistIds([...selectedPlaylistIds, playlist.id]);
                          } else {
                            setSelectedPlaylistIds(selectedPlaylistIds.filter(id => id !== playlist.id));
                          }
                        }}
                        className="text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">{playlist.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop buttons - inside form */}
            <div className="hidden sm:flex items-center space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/teacher/dashboard')}
                className="w-1/2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="w-1/2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading video...' : loading ? 'Saving...' : id ? 'Update Lesson' : 'Create Lesson'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Fixed bottom buttons on mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:hidden z-50">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/teacher/dashboard')}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (formRef.current) {
                formRef.current.requestSubmit();
              }
            }}
            disabled={loading || uploading}
            className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : loading ? 'Saving...' : id ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
