import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Clock, FileText } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
  time_minutes: number | null;
  file_url: string | null;
  created_at: string;
}

interface Question {
  id: string;
  question_text: string;
  variants: Variant[];
}

interface Variant {
  id: string;
  variant_text: string;
  is_correct: boolean;
}

export default function TestView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadTest();
    }
  }, [id]);

  const loadTest = async () => {
    const { data: testData, error: fetchError } = await supabase
      .from('tests')
      .select('id, title, description, time_minutes, file_url, created_at')
      .eq('id', id)
      .single();

    if (fetchError) {
      setError('Failed to load test. Please try again.');
      console.error(fetchError);
      return;
    }

    if (testData) {
      setTest(testData);

      // Load questions
      const { data: questionsData } = await supabase
        .from('test_questions')
        .select('*')
        .eq('test_id', id)
        .order('order_index', { ascending: true });

      if (questionsData && questionsData.length > 0) {
        const questionIds = questionsData.map(q => q.id);
        const { data: variantsData } = await supabase
          .from('test_question_variants')
          .select('*')
          .in('question_id', questionIds)
          .order('order_index', { ascending: true });

        const questionsWithVariants = questionsData.map(question => ({
          id: question.id,
          question_text: question.question_text,
          variants: (variantsData || [])
            .filter(v => v.question_id === question.id)
            .map(v => ({
              id: v.id,
              variant_text: v.variant_text,
              is_correct: v.is_correct,
            })),
        }));

        setQuestions(questionsWithVariants);
      }
    }
  };

  const handleStartTest = () => {
    // Navigate to test taking page based on user role
    const basePath = profile?.role === 'student' ? '/student' : '/teacher';
    navigate(`${basePath}/test/${id}/take`);
  };

  if (!test) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Test not found</div>
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {test.title}
          </h1>
          {test.description && (
            <p className="text-gray-600 mb-6">{test.description}</p>
          )}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Time Panel */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 rounded-lg p-2 flex-shrink-0">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 mb-1">Time</p>
                  <p className="text-lg font-bold text-gray-900">
                    {test.time_minutes || 0} <span className="hidden sm:inline">minutes</span><span className="sm:hidden">m</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Questions Panel */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 rounded-lg p-2 flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 mb-1">Questions</p>
                  <p className="text-lg font-bold text-gray-900">
                    {questions.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* View Document Button for file-uploaded tests */}
          {test.file_url && (
            <div className="mb-4">
              <button
                onClick={() => {
                  const basePath = profile?.role === 'student' ? '/student' : '/teacher';
                  navigate(`${basePath}/test/${id}/document`);
                }}
                className="w-full px-8 py-3 bg-gray-100 text-black rounded-lg hover:bg-gray-200 transition font-medium text-lg border border-gray-300"
              >
                View Test Document
              </button>
            </div>
          )}

          <button
            onClick={handleStartTest}
            className="w-full px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium text-lg"
          >
            Start Test
          </button>
        </div>

      </div>
    </div>
  );
}
