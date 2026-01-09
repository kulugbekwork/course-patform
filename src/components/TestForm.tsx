import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

interface Question {
  id?: string;
  question_text: string;
  variants: Variant[];
}

interface Variant {
  id?: string;
  variant_text: string;
  is_correct: boolean;
}

export default function TestForm() {
  const navigate = useNavigate();
  const form1Ref = useRef<HTMLFormElement>(null);
  const form2Ref = useRef<HTMLFormElement>(null);
  const { id } = useParams<{ id?: string }>();
  const { profile } = useAuth();
  const [stage, setStage] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeMinutes, setTimeMinutes] = useState<number>(30);
  const [questions, setQuestions] = useState<Question[]>([
    { question_text: '', variants: [{ variant_text: '', is_correct: false }, { variant_text: '', is_correct: false }] }
  ]);
  const [loading, setLoading] = useState(false);
  const [loadingTest, setLoadingTest] = useState(!!id);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadTest();
    }
  }, [id]);

  const loadTest = async () => {
    setLoadingTest(true);
    const { data: testData, error: fetchError } = await supabase
      .from('tests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      setError('Failed to load test. Please try again.');
      console.error(fetchError);
    } else if (testData) {
      setTitle(testData.title);
      setDescription(testData.description || '');
      setTimeMinutes(testData.time_minutes || 30);

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
    setLoadingTest(false);
  };

  const handleStage1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a test title');
      return;
    }
    if (timeMinutes < 1) {
      setError('Time must be at least 1 minute');
      return;
    }
    setError('');
    setStage(2);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question_text: '', variants: [{ variant_text: '', is_correct: false }, { variant_text: '', is_correct: false }] }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, questionText: string) => {
    const updated = [...questions];
    updated[index].question_text = questionText;
    setQuestions(updated);
  };

  const addVariant = (questionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].variants.push({ variant_text: '', is_correct: false });
    setQuestions(updated);
  };

  const removeVariant = (questionIndex: number, variantIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].variants = updated[questionIndex].variants.filter((_, i) => i !== variantIndex);
    setQuestions(updated);
  };

  const updateVariant = (questionIndex: number, variantIndex: number, variantText: string) => {
    const updated = [...questions];
    updated[questionIndex].variants[variantIndex].variant_text = variantText;
    setQuestions(updated);
  };

  const toggleCorrect = (questionIndex: number, variantIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].variants[variantIndex].is_correct = !updated[questionIndex].variants[variantIndex].is_correct;
    setQuestions(updated);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question ${i + 1} is missing text`);
        return;
      }
      if (q.variants.length < 2) {
        setError(`Question ${i + 1} must have at least 2 answer options`);
        return;
      }
      const hasCorrect = q.variants.some(v => v.is_correct);
      if (!hasCorrect) {
        setError(`Question ${i + 1} must have at least one correct answer`);
        return;
      }
      for (let j = 0; j < q.variants.length; j++) {
        if (!q.variants[j].variant_text.trim()) {
          setError(`Question ${i + 1}, option ${j + 1} is missing text`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      let testId = id;

      if (id) {
        // Update existing test
        const { error: updateError } = await supabase
          .from('tests')
          .update({
            title,
            description: description || null,
            time_minutes: timeMinutes,
          })
          .eq('id', id);

        if (updateError) throw updateError;
      } else {
        // Create new test
        const { data: insertData, error: insertError } = await supabase
          .from('tests')
          .insert({
            title,
            description: description || null,
            time_minutes: timeMinutes,
            teacher_id: profile?.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!insertData) throw new Error('Failed to create test');
        testId = insertData.id;
      }

      // Delete existing questions if updating
      if (id) {
        const { data: existingQuestions } = await supabase
          .from('test_questions')
          .select('id')
          .eq('test_id', testId);

        if (existingQuestions && existingQuestions.length > 0) {
          const questionIds = existingQuestions.map(q => q.id);
          await supabase.from('test_question_variants').delete().in('question_id', questionIds);
          await supabase.from('test_questions').delete().eq('test_id', testId);
        }
      }

      // Insert questions and variants
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const { data: questionData, error: questionError } = await supabase
          .from('test_questions')
          .insert({
            test_id: testId,
            question_text: question.question_text,
            order_index: i,
          })
          .select()
          .single();

        if (questionError) throw questionError;
        if (!questionData) throw new Error('Failed to create question');

        // Insert variants
        const variantsToInsert = question.variants.map((variant, j) => ({
          question_id: questionData.id,
          variant_text: variant.variant_text,
          is_correct: variant.is_correct,
          order_index: j,
        }));

        const { error: variantsError } = await supabase
          .from('test_question_variants')
          .insert(variantsToInsert);

        if (variantsError) throw variantsError;
      }

      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingTest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto w-full px-0 sm:px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200">
          <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-bold text-black">
                {id ? 'Edit Test' : 'Create New Test'}
              </h2>
              <div className="w-full relative">
                <div className="flex mb-1">
                  <span className="text-sm font-medium text-black">1</span>
                  <span className={`text-sm font-medium absolute left-1/2 transform -translate-x-1/2 ${stage === 2 ? 'text-black' : 'text-gray-400'}`}>2</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all"
                    style={{ width: `${(stage / 2) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {stage === 1 ? (
            <form ref={form1Ref} onSubmit={handleStage1Submit} className="p-4 sm:p-6 space-y-6 pb-24 sm:pb-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Test Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                  required
                  placeholder="e.g., Math Quiz Chapter 1"
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
                  placeholder="Describe what this test covers..."
                />
              </div>

              <div>
                <label htmlFor="timeMinutes" className="block text-sm font-medium text-gray-700 mb-2">
                  Time <span className="hidden sm:inline">(minutes)</span><span className="sm:hidden">(m)</span> *
                </label>
                <input
                  id="timeMinutes"
                  type="number"
                  min="1"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                  required
                />
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
                  className="w-1/2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                >
                  Next: Add Questions
                </button>
              </div>
            </form>
          ) : (
            <form ref={form2Ref} onSubmit={handleFinalSubmit} className="p-4 sm:p-6 space-y-6 pb-24 sm:pb-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                {questions.map((question, questionIndex) => (
                  <div key={questionIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Question {questionIndex + 1}</h3>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(questionIndex)}
                          className="text-red-600 hover:text-red-700 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Question Text *
                      </label>
                      <textarea
                        value={question.question_text}
                        onChange={(e) => updateQuestion(questionIndex, e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                        placeholder="Enter the question..."
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Answer Options *
                        </label>
                        <button
                          type="button"
                          onClick={() => addVariant(questionIndex)}
                          className="flex items-center space-x-1 text-sm text-black hover:text-gray-700 transition"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Option</span>
                        </button>
                      </div>

                      {question.variants.map((variant, variantIndex) => (
                        <div key={variantIndex} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.is_correct}
                            onChange={() => toggleCorrect(questionIndex, variantIndex)}
                            className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                          />
                          <input
                            type="text"
                            value={variant.variant_text}
                            onChange={(e) => updateVariant(questionIndex, variantIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                            placeholder={`Option ${variantIndex + 1}`}
                            required
                          />
                          {question.variants.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeVariant(questionIndex, variantIndex)}
                              className="text-red-600 hover:text-red-700 transition p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addQuestion}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Add Question</span>
              </button>

              {/* Desktop buttons - inside form */}
              <div className="hidden sm:flex items-center space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="w-1/2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || questions.length === 0}
                  className="w-1/2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : id ? 'Update Test' : 'Create Test'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Fixed bottom buttons on mobile */}
      {stage === 1 ? (
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
                if (form1Ref.current) {
                  form1Ref.current.requestSubmit();
                }
              }}
              className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:hidden z-50">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setStage(1)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (form2Ref.current) {
                  form2Ref.current.requestSubmit();
                }
              }}
              disabled={loading || questions.length === 0}
              className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : id ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
