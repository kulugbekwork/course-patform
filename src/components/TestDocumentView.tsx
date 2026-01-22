import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
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

export default function TestDocumentView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadTest();
    }
  }, [id]);

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

  const handleContinue = () => {
    // Navigate back to test taking page with answers
    const basePath = profile?.role === 'student' ? '/student' : '/teacher';
    navigate(`${basePath}/test/${id}/take`, { state: { answers, fromDocument: true } });
  };

  if (!test) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Test not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
            <h1 className="text-lg font-semibold text-gray-900">{test.title}</h1>
            <div className="w-24"></div> {/* Spacer for centering */}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* View Document Button - Opens in native browser viewer */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 text-center">
          {test.file_url ? (
            <div>
              <p className="text-gray-700 mb-4">Click the button below to view the document in your browser</p>
              <button
                onClick={() => {
                  if (test.file_url) {
                    // Open file URL directly in new tab - browser will handle it natively
                    window.open(test.file_url, '_blank');
                  }
                }}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                View Document
              </button>
            </div>
          ) : test.file_content ? (
            <div>
              <p className="text-gray-700 mb-4">Click the button below to view the test file in your browser</p>
              <button
                onClick={() => {
                  if (test.file_content) {
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
                View File
              </button>
            </div>
          ) : (
            <div className="text-gray-500 py-8">
              <p>No document available</p>
            </div>
          )}
        </div>

        {/* Questions Section at Bottom */}
        {questions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Answer Questions</h2>
            <div className="space-y-6">
              {questions.map((question, questionIndex) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
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

            <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleContinue}
                className="flex items-center space-x-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
