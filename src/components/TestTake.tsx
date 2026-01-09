import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
  time_minutes: number | null;
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

export default function TestTake() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [initialTime, setInitialTime] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [testResults, setTestResults] = useState<{
    total: number;
    correct: number;
    wrong: number;
    timeTaken: number;
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadTest();
    }
  }, [id]);

  useEffect(() => {
    if (timeRemaining > 0 && !finished) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, finished]);

  const loadTest = async () => {
    setLoading(true);
    const { data: testData, error: fetchError } = await supabase
      .from('tests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      setError('Failed to load test. Please try again.');
      console.error(fetchError);
      setLoading(false);
      return;
    }

    if (testData) {
      setTest(testData);
      const timeMinutes = testData.time_minutes || 60;
      const totalSeconds = timeMinutes * 60;
      setTimeRemaining(totalSeconds);
      setInitialTime(totalSeconds);

      // Load questions
      const { data: questionsData } = await supabase
        .from('test_questions')
        .select('*')
        .eq('test_id', id)
        .order('created_at', { ascending: true });

      if (questionsData && questionsData.length > 0) {
        const questionIds = questionsData.map(q => q.id);
        const { data: variantsData } = await supabase
          .from('test_question_variants')
          .select('*')
          .in('question_id', questionIds)
          .order('created_at', { ascending: true });

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
    setLoading(false);
  };

  const handleAnswerChange = (variantId: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion) {
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: variantId,
      }));
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    if (finished) return;
    
    // Calculate results
    let correctCount = 0;
    questions.forEach((question) => {
      const userAnswer = answers[question.id];
      const correctVariant = question.variants.find((v) => v.is_correct);
      
      if (userAnswer && correctVariant && userAnswer === correctVariant.id) {
        correctCount++;
      }
    });

    const wrongCount = questions.length - correctCount;
    const timeTaken = initialTime - timeRemaining;

    setTestResults({
      total: questions.length,
      correct: correctCount,
      wrong: wrongCount,
      timeTaken,
    });
    
    setFinished(true);
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !profile?.id || !id) return;

    setSubmittingRating(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('test_ratings')
        .insert({
          test_id: id,
          user_id: profile.id,
          rating,
          comment: comment.trim() || null,
        });

      if (insertError) {
        throw insertError;
      }

      const basePath = profile?.role === 'student' ? '/student' : '/teacher';
      navigate(`${basePath}/test/${id}/view`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit rating. Please try again.');
      console.error(err);
    } finally {
      setSubmittingRating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeTaken = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Test not found</div>
      </div>
    );
  }

  if (finished && testResults) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => navigate(`/teacher/test/${id}/view`)}
                className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Test</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Results Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Test Results</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Questions</p>
                <p className="text-2xl font-bold text-gray-900">{testResults.total}</p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Correct</p>
                <p className="text-2xl font-bold text-green-600">{testResults.correct}</p>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Wrong</p>
                <p className="text-2xl font-bold text-red-600">{testResults.wrong}</p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Time Taken</p>
                <p className="text-2xl font-bold text-blue-600">{formatTimeTaken(testResults.timeTaken)}</p>
              </div>
            </div>
          </div>

          {/* Rating Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Rate this test</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitRating} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Rating
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300 hover:text-yellow-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">({rating}/5)</span>
                </div>
              </div>

              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                  Comment (optional)
                </label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                  placeholder="Share your thoughts about this test..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!rating || submittingRating}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingRating ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => {
                const basePath = profile?.role === 'student' ? '/student' : '/teacher';
                navigate(`${basePath}/test/${id}/view`);
              }}
              className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Test</span>
            </button>
            <div className="text-lg font-semibold text-gray-900">
              Time: {formatTime(timeRemaining)}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentQuestion && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {currentQuestion.question_text}
              </h2>
            </div>

            <div className="space-y-3 mb-6">
              {currentQuestion.variants.map((variant) => (
                <label
                  key={variant.id}
                  className={`flex items-center space-x-3 cursor-pointer p-4 rounded-lg border-2 transition ${
                    selectedAnswer === variant.id
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={variant.id}
                    checked={selectedAnswer === variant.id}
                    onChange={() => handleAnswerChange(variant.id)}
                    className="h-5 w-5 text-black focus:ring-black border-gray-300"
                  />
                  <span className="text-gray-700 flex-1">{variant.variant_text}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                onClick={handleBack}
                disabled={currentQuestionIndex === 0}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                onClick={isLastQuestion ? handleFinish : handleNext}
                disabled={!selectedAnswer}
                className="flex items-center space-x-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isLastQuestion ? 'Finish Test' : 'Next'}</span>
                {!isLastQuestion && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
