import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, Course, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

interface CourseComment {
  id: string;
  course_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profile?: Profile;
}

export default function LessonView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [comments, setComments] = useState<CourseComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadLesson();
      loadComments();
    }
  }, [id]);

  const loadLesson = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      setError('Failed to load lesson. Please try again.');
      console.error(fetchError);
    } else if (data) {
      setCourse(data);
    }
    setLoading(false);
  };

  const loadComments = async () => {
    if (!id) return;

    const { data: commentsData, error } = await supabase
      .from('course_comments')
      .select('*')
      .eq('course_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    if (commentsData) {
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profile: profilesMap.get(comment.user_id),
      }));

      setComments(commentsWithProfiles as CourseComment[]);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile?.id || !id) return;

    setSubmittingComment(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('course_comments')
        .insert({
          course_id: id,
          user_id: profile.id,
          comment: newComment.trim(),
        });

      if (insertError) {
        throw insertError;
      }

      setNewComment('');
      loadComments();
    } catch (err: any) {
      setError(err.message || 'Failed to submit comment. Please try again.');
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const getVideoEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be')
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }

    return url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Lesson not found</div>
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
                const dashboardPath = profile?.role === 'student' ? '/student/dashboard' : '/teacher/dashboard';
                navigate(dashboardPath);
              }}
              className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="aspect-video bg-black">
            {course.video_url.includes('youtube') || course.video_url.includes('vimeo') ? (
              <iframe
                src={getVideoEmbedUrl(course.video_url)}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : (
              <video
                src={course.video_url}
                controls
                className="w-full h-full"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {course.title}
            </h1>
            <p className="text-gray-600">
              {course.description || 'No description available.'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Comments</h2>

          {profile && (
            <form onSubmit={handleSubmitComment} className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition mb-3"
                required
              />
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-3">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="w-full px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  <div className="font-semibold text-gray-900 mb-1">
                    {comment.profile?.full_name || comment.profile?.username || 'Anonymous'}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
