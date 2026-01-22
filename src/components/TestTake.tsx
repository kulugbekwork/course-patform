import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
  time_minutes: number | null;
  file_content: string | null;
  file_url: string | null;
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
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // Store variant index for each question index
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [initialTime, setInitialTime] = useState<number>(0);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [testResults, setTestResults] = useState<{
    total: number;
    correct: number;
    wrong: number;
    timeTaken: number;
  } | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);

  // Use refs to access latest state values in callbacks
  const questionsRef = useRef(questions);
  const answersRef = useRef(answers);
  const initialTimeRef = useRef(initialTime);
  const timeRemainingRef = useRef(timeRemaining);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    initialTimeRef.current = initialTime;
  }, [initialTime]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  useEffect(() => {
    if (id) {
      loadTest();
    }
    
    // Load answers from document view if coming from there
    if (location.state?.answers) {
      setAnswers(location.state.answers);
    }
    
    // Store playlist ID if coming from playlist
    if (location.state?.playlistId) {
      setPlaylistId(location.state.playlistId);
    }
  }, [id, location.state]);

  const handleFinish = useCallback(async () => {
    const shouldFinish = !finished;
    if (!shouldFinish) return;
    
    setFinished(true);
    
    // Emit event for playlist completion tracking
    if (id) {
      const event = new CustomEvent('testCompleted', { detail: { testId: id } });
      window.dispatchEvent(event);
    }
    
    // Calculate results using refs to get latest values
    const currentQuestions = questionsRef.current;
    const currentAnswers = answersRef.current;
    const currentInitialTime = initialTimeRef.current;
    const currentTimeRemaining = timeRemainingRef.current;
    
    let correctCount = 0;
    currentQuestions.forEach((question, questionIndex) => {
      const userAnswerIndex = currentAnswers[questionIndex];
      const correctVariantIndex = question.variants.findIndex((v) => v.is_correct);
      
      if (userAnswerIndex !== undefined && userAnswerIndex === correctVariantIndex) {
        correctCount++;
      }
    });

    const wrongCount = currentQuestions.length - correctCount;
    const timeTaken = currentInitialTime - currentTimeRemaining;

    setTestResults({
      total: currentQuestions.length,
      correct: correctCount,
      wrong: wrongCount,
      timeTaken,
    });
    
    // If test is part of a playlist, mark as completed and find next test
    if (playlistId && profile?.role === 'student' && id) {
      try {
        // Ensure test is marked as completed
        const { data: existingProgress } = await supabase
          .from('playlist_student_progress')
          .select('*')
          .eq('playlist_id', playlistId)
          .eq('student_id', profile.id)
          .maybeSingle();

        const completedTestIds = existingProgress?.completed_test_ids || [];
        const updatedCompleted = completedTestIds.includes(id) 
          ? completedTestIds 
          : [...completedTestIds, id];

        if (!completedTestIds.includes(id)) {
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
                playlist_id: playlistId,
                student_id: profile.id,
                completed_test_ids: updatedCompleted,
              });
          }
        }
        // Test is marked as completed, no automatic navigation
      } catch (err) {
        console.error('Error finding next test:', err);
      }
    }
  }, [id, playlistId, profile, finished, navigate]);

  useEffect(() => {
    // Start timer when test has started
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
  }, [timeRemaining, finished, handleFinish]);

  const loadTest = async () => {
    const { data: testData, error: fetchError } = await supabase
      .from('tests')
      .select('id, title, description, time_minutes, file_content, file_url, teacher_id, created_at, updated_at')
      .eq('id', id)
      .single();

    if (fetchError) {
      setError('Failed to load test. Please try again.');
      console.error(fetchError);
      return;
    }

    if (testData) {
      setTest(testData);
      const timeMinutes = testData.time_minutes || 60;
      const totalSeconds = timeMinutes * 60;
      setTimeRemaining(totalSeconds);
      setInitialTime(totalSeconds);
      
      // Don't auto-show file content - user will click button to view document

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

  const handleAnswerChange = (questionIndex: number, variantIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: variantIndex,
    }));
  };

  const getVariantLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D, etc. (uppercase)
  };


  const handleBack = () => {
    // Go back to document view if file exists, otherwise to test view
    if (test?.file_url || test?.file_content) {
      const basePath = profile?.role === 'student' ? '/student' : '/teacher';
      navigate(`${basePath}/test/${id}/document`, { state: { answers } });
    } else {
      const basePath = profile?.role === 'student' ? '/student' : '/teacher';
      navigate(`${basePath}/test/${id}/view`);
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
                onClick={() => {
                  if (profile?.role === 'student') {
                    navigate('/student/dashboard');
                  } else {
                    navigate(`/teacher/test/${id}/view`);
                  }
                }}
                className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
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
        </div>
      </div>
    );
  }

  // If file exists, show button to view document instead of showing it directly
  if (test?.file_url || test?.file_content) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => {
                  if (profile?.role === 'student') {
                    navigate('/student/dashboard');
                  } else {
                    navigate(`/teacher/test/${id}/view`);
                  }
                }}
                className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="text-lg font-semibold text-gray-900">
                Time: {formatTime(timeRemaining)}
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{test.title}</h2>
            {test.description && (
              <p className="text-gray-600 mb-6">{test.description}</p>
            )}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
              <p className="text-gray-700 mb-4">View the test document and answer questions</p>
              <button
                onClick={() => {
                  if (test.file_url) {
                    // Open file URL directly in new tab - browser will handle it natively
                    window.open(test.file_url, '_blank');
                  } else if (test.file_content) {
                    // Fallback to old file_content method for backward compatibility
                    if (test.file_content.startsWith('%PDF')) {
                      // For PDF, create blob URL and open in new tab
                      try {
                        const binaryString = test.file_content;
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                          bytes[i] = binaryString.charCodeAt(i);
                        }
                        const blob = new Blob([bytes], { type: 'application/pdf' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        // Clean up URL after a delay
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                      } catch (err) {
                        console.error('Error opening PDF:', err);
                        alert('Failed to open PDF file');
                      }
                    } else {
                      // For text files, create a text blob and open in new tab
                      const blob = new Blob([test.file_content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 100);
                    }
                  }
                }}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                View Document
              </button>
            </div>
          </div>

          {/* Questions Section at Bottom */}
          {questions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Answer Questions</h2>
              <div className="space-y-6">
                {questions.map((question, questionIndex) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <span className="font-semibold text-gray-900">{questionIndex + 1})</span>
                      {question.variants.map((variant, variantIndex) => (
                        <label key={variant.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${questionIndex}`}
                            checked={answers[questionIndex] === variantIndex}
                            onChange={() => handleAnswerChange(questionIndex, variantIndex)}
                            className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                          />
                          <span className="text-sm text-gray-700">{getVariantLabel(variantIndex)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleFinish}
                  className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                >
                  Finish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Stage 2: Show questions with radio buttons
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => {
                if (profile?.role === 'student') {
                  navigate('/student/dashboard');
                } else {
                  navigate(`/teacher/test/${id}/view`);
                }
              }}
              className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="text-lg font-semibold text-gray-900">
              Time: {formatTime(timeRemaining)}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* View Document Card - shown if test has a file */}
        {(test?.file_url || test?.file_content) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{test.title}</h2>
            {test.description && (
              <p className="text-gray-600 mb-4">{test.description}</p>
            )}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
              <p className="text-gray-700 mb-4">View the test document to answer questions</p>
              <button
                onClick={() => {
                  if (test.file_url) {
                    window.open(test.file_url, '_blank');
                  } else if (test.file_content) {
                    if (test.file_content.startsWith('%PDF')) {
                      try {
                        const binaryString = test.file_content;
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                          bytes[i] = binaryString.charCodeAt(i);
                        }
                        const blob = new Blob([bytes], { type: 'application/pdf' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                      } catch (err) {
                        console.error('Error opening PDF:', err);
                        alert('Failed to open PDF file');
                      }
                    } else {
                      const blob = new Blob([test.file_content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 100);
                    }
                  }
                }}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                View Document
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {questions.map((question, questionIndex) => (
            <div key={question.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">{questionIndex + 1})</span>
                <div className="flex items-center space-x-4">
                  {question.variants.map((variant, variantIndex) => (
                    <label key={variant.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${questionIndex}`}
                        checked={answers[questionIndex] === variantIndex}
                        onChange={() => handleAnswerChange(questionIndex, variantIndex)}
                        className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">{getVariantLabel(variantIndex)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            onClick={handleFinish}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
}
