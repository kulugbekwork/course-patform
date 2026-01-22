import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, FileText, Plus, Minus } from 'lucide-react';

interface QuestionFromFile {
  questionNumber: number;
  questionText: string;
  variants: string[];
  correctVariantIndex: number | null;
}

export default function TestUploadForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = !!id;
  
  const [stage, setStage] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeMinutes, setTimeMinutes] = useState<number>(30);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [currentFileUrl, setCurrentFileUrl] = useState<string>(''); // For edit mode - existing file URL
  const [fileContent, setFileContent] = useState<string>('');
  const [questions, setQuestions] = useState<QuestionFromFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTest, setLoadingTest] = useState(isEditMode);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Load test data when in edit mode
  useEffect(() => {
    if (id) {
      loadTest();
    } else {
      // If not edit mode, ensure loadingTest is false
      setLoadingTest(false);
    }
  }, [id]);

  const loadTest = async () => {
    if (!id) {
      setLoadingTest(false);
      return;
    }
    
    setLoadingTest(true);
    setError('');
    
    try {
      const { data: testData, error: fetchError } = await supabase
        .from('tests')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        setError('Failed to load test. Please try again.');
        console.error(fetchError);
        setLoadingTest(false);
        return;
      }

      if (testData) {
        setTitle(testData.title || '');
        setDescription(testData.description || '');
        setTimeMinutes(testData.time_minutes || 30);
        setCurrentFileUrl(testData.file_url || '');
        setFileUrl(testData.file_url || '');

        // Load questions to get the count
        const { data: questionsData, error: questionsError } = await supabase
          .from('test_questions')
          .select('*, test_question_variants(*)')
          .eq('test_id', id)
          .order('order_index', { ascending: true });

        if (questionsError) {
          console.error('Error loading questions:', questionsError);
        }

        if (questionsData && questionsData.length > 0) {
          setQuestionCount(questionsData.length);
          
          // Load questions with variants for stage 2
          const loadedQuestions: QuestionFromFile[] = questionsData.map((q, idx) => {
            const variants = (q.test_question_variants || [])
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((v: any) => v.variant_text);
            
            const correctIndex = (q.test_question_variants || []).findIndex((v: any) => v.is_correct);
            
            return {
              questionNumber: idx + 1,
              questionText: q.question_text || `Question ${idx + 1}`,
              variants: variants.length > 0 ? variants : ['', '', ''],
              correctVariantIndex: correctIndex >= 0 ? correctIndex : null,
            };
          });
          
          setQuestions(loadedQuestions);
        } else {
          // No questions yet, set default
          setQuestionCount(0);
          setQuestions([]);
        }
      } else {
        setError('Test not found.');
      }
    } catch (err: any) {
      console.error('Error loading test:', err);
      setError('Failed to load test. Please try again.');
    } finally {
      setLoadingTest(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploadedFile(file);
    setUploading(true);

    try {
      // Check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to upload files');
      }

      // Generate unique file name
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('test-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        // If bucket doesn't exist, try to create it or use a different approach
        if (uploadError.message?.includes('Bucket not found')) {
          throw new Error('Storage bucket not configured. Please contact administrator.');
        }
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('test-documents')
        .getPublicUrl(uploadData.path);

      setFileUrl(publicUrl);
      
      // Reset file input to allow uploading the same or different file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file. Please try again.');
      console.error('File upload error:', err);
      setUploadedFile(null);
      setFileUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploading(false);
    }
  };


  const handleStage1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a test title');
      return;
    }

    // In edit mode, allow proceeding with existing file if no new file uploaded
    if (!isEditMode && (!uploadedFile || !fileUrl)) {
      setError('Please upload a file');
      return;
    }

    // In edit mode, if no new file uploaded, use existing file URL
    if (isEditMode && !uploadedFile && !fileUrl && !currentFileUrl) {
      setError('Please upload a file or keep the existing file');
      return;
    }

    if (isEditMode && !uploadedFile && currentFileUrl) {
      setFileUrl(currentFileUrl);
    }

    if (questionCount <= 0) {
      setError('Please enter the number of questions.');
      return;
    }

    // If question count changed, reset questions
    if (questions.length !== questionCount) {
      // Create questions array from 1 to n based on questionCount
      // Each question will have variants a, b, c that user can select
      const newQuestions: QuestionFromFile[] = [];
      for (let i = 0; i < questionCount; i++) {
        // If editing and we have existing questions, try to preserve them
        if (isEditMode && questions[i]) {
          newQuestions.push(questions[i]);
        } else {
          newQuestions.push({
            questionNumber: i + 1,
            questionText: `Question ${i + 1}`,
            variants: ['', '', ''],
            correctVariantIndex: null,
          });
        }
      }
      setQuestions(newQuestions);
    }
    
    setStage(2);
  };

  const handleCorrectVariantChange = (questionIndex: number, variantIndex: number) => {
    const updated = [...questions];
    if (updated[questionIndex].correctVariantIndex === variantIndex) {
      updated[questionIndex].correctVariantIndex = null;
    } else {
      updated[questionIndex].correctVariantIndex = variantIndex;
    }
    setQuestions(updated);
  };

  const getVariantLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D, etc. (uppercase)
  };

  const addVariant = (questionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].variants.push('');
    setQuestions(updated);
  };

  const removeVariant = (questionIndex: number, variantIndex: number) => {
    const updated = [...questions];
    if (updated[questionIndex].variants.length > 2) {
      updated[questionIndex].variants.splice(variantIndex, 1);
      // Adjust correct variant index if needed
      if (updated[questionIndex].correctVariantIndex === variantIndex) {
        updated[questionIndex].correctVariantIndex = null;
      } else if (updated[questionIndex].correctVariantIndex !== null && updated[questionIndex].correctVariantIndex > variantIndex) {
        updated[questionIndex].correctVariantIndex = updated[questionIndex].correctVariantIndex - 1;
      }
      setQuestions(updated);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate that all questions have correct variants
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].correctVariantIndex === null) {
        setError(`Question ${i + 1} must have a correct answer selected`);
        return;
      }
      if (questions[i].variants.length < 2) {
        setError(`Question ${i + 1} must have at least 2 answer options`);
        return;
      }
    }

    setLoading(true);

    try {
      // Determine the file URL to use
      const finalFileUrl = fileUrl || (isEditMode ? currentFileUrl : '');
      
      if (!finalFileUrl) {
        throw new Error('File URL is missing. Please upload a file.');
      }

      if (!profile?.id) {
        throw new Error('You must be logged in to create a test.');
      }

      let testId: string;

      if (isEditMode && id) {
        // Update existing test
        const { data: updateData, error: updateError } = await supabase
          .from('tests')
          .update({
            title: title.trim(),
            description: description?.trim() || null,
            time_minutes: timeMinutes,
            file_url: finalFileUrl,
            file_content: fileContent || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          console.error('Test update error:', updateError);
          throw new Error(updateError.message || 'Failed to update test');
        }
        if (!updateData) {
          throw new Error('Failed to update test: No data returned');
        }
        testId = id;

        // Delete existing questions and variants
        const { data: existingQuestions } = await supabase
          .from('test_questions')
          .select('id')
          .eq('test_id', id);

        if (existingQuestions && existingQuestions.length > 0) {
          const questionIds = existingQuestions.map(q => q.id);
          await supabase
            .from('test_question_variants')
            .delete()
            .in('question_id', questionIds);
          
          await supabase
            .from('test_questions')
            .delete()
            .eq('test_id', id);
        }
      } else {
        // Create new test
        const { data: insertData, error: insertError } = await supabase
          .from('tests')
          .insert({
            title: title.trim(),
            description: description?.trim() || null,
            time_minutes: timeMinutes,
            teacher_id: profile.id,
            file_url: finalFileUrl,
            file_content: fileContent || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Test insert error:', insertError);
          throw new Error(insertError.message || 'Failed to create test');
        }
        if (!insertData) {
          throw new Error('Failed to create test: No data returned');
        }
        testId = insertData.id;
      }

      // Helper function to clean text (remove null bytes and control characters)
      const cleanText = (text: string): string => {
        if (!text) return '';
        return text
          .replace(/\0/g, '') // Remove null bytes
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
          .trim();
      };

      // Insert questions and variants
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const cleanedQuestionText = cleanText(question.questionText) || `Question ${i + 1}`;
        
        // Question text can be empty since students will see the file content

        const { data: questionData, error: questionError } = await supabase
          .from('test_questions')
          .insert({
            test_id: testId,
            question_text: cleanedQuestionText,
            order_index: i,
          })
          .select()
          .single();

        if (questionError) throw questionError;
        if (!questionData) throw new Error('Failed to create question');

        // Insert variants (filter out empty ones and clean text)
        const validVariants = question.variants
          .map(v => cleanText(v))
          .filter(v => v.length > 0);
        
        // If no valid variants, create default ones using letters (A, B, C, etc.)
        const variantsToUse = validVariants.length >= 2 
          ? validVariants 
          : Array.from({ length: Math.max(2, question.variants.length) }, (_, idx) => 
              String.fromCharCode(65 + idx) // A, B, C, D, etc.
            );
        
        if (variantsToUse.length < 2) {
          throw new Error(`Question ${i + 1} must have at least 2 answer options.`);
        }

        // Find the correct variant index
        let correctIndexInValid = -1;
        if (question.correctVariantIndex !== null) {
          // If we used default variants, use the selected index directly
          if (validVariants.length < 2) {
            correctIndexInValid = Math.min(question.correctVariantIndex, variantsToUse.length - 1);
          } else {
            // Find the correct index in the cleaned array
            const originalVariants = question.variants;
            let validCount = 0;
            for (let j = 0; j <= question.correctVariantIndex; j++) {
              if (cleanText(originalVariants[j]).length > 0) {
                if (j === question.correctVariantIndex) {
                  correctIndexInValid = validCount;
                }
                validCount++;
              }
            }
          }
        }

        // Ensure at least one variant is marked as correct
        if (correctIndexInValid === -1) {
          // If no correct index found, default to the first variant
          correctIndexInValid = 0;
        }

        // Ensure correctIndexInValid is within bounds
        if (correctIndexInValid < 0 || correctIndexInValid >= variantsToUse.length) {
          correctIndexInValid = 0;
        }

        const variantsToInsert = variantsToUse.map((variant, j) => ({
          question_id: questionData.id,
          variant_text: variant,
          is_correct: j === correctIndexInValid,
          order_index: j,
        }));

        const { error: variantsError } = await supabase
          .from('test_question_variants')
          .insert(variantsToInsert);

        if (variantsError) {
          console.error(`Error inserting variants for question ${i + 1}:`, variantsError);
          throw new Error(`Failed to save question ${i + 1} variants: ${variantsError.message}`);
        }
      }

      // Success - navigate outside try-catch to avoid showing error if navigation fails
      setLoading(false);
      navigate('/teacher/dashboard');
    } catch (err: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} test:`, err);
      const errorMessage = err?.message || err?.error?.message || `Failed to ${isEditMode ? 'update' : 'save'} test. Please try again.`;
      setError(errorMessage);
      setLoading(false);
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-black">
            {isEditMode ? 'Edit Test from File' : 'Upload Test from File'}
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold text-black">Stage {stage} of 2</h2>
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
              </div>
            </div>
          </div>

          {stage === 1 ? (
            <form onSubmit={handleStage1Submit} className="p-6 space-y-6">
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
                  Time (minutes) *
                </label>
                <input
                  id="timeMinutes"
                  type="number"
                  min="1"
                  value={timeMinutes || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setTimeMinutes(0);
                    } else {
                      const num = parseInt(value);
                      if (!isNaN(num) && num > 0) {
                        setTimeMinutes(num);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (!timeMinutes || timeMinutes < 1) {
                      setTimeMinutes(1);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="questionCount" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Questions *
                </label>
                <input
                  id="questionCount"
                  type="number"
                  min="1"
                  value={questionCount || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setQuestionCount(0);
                    } else {
                      const num = parseInt(value);
                      if (!isNaN(num) && num >= 0) {
                        setQuestionCount(num);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (!questionCount || questionCount < 1) {
                      setQuestionCount(0);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isEditMode ? 'Change File (Optional)' : 'Upload File *'}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-black transition">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {loadingTest ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 border-4 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm font-medium text-black">Loading...</p>
                    </div>
                  ) : uploading ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 border-4 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm font-medium text-black">Uploading file...</p>
                    </div>
                  ) : uploadedFile ? (
                    <div className="space-y-2">
                      <FileText className="w-12 h-12 text-black mx-auto" />
                      <p className="text-sm font-medium text-black">{uploadedFile.name}</p>
                      <div className="flex items-center justify-center space-x-4">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm text-black hover:text-gray-700 font-medium"
                        >
                          Upload different file
                        </button>
                        <span className="text-gray-400">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFile(null);
                            setFileUrl(isEditMode ? currentFileUrl : '');
                            setFileContent('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove file
                        </button>
                      </div>
                    </div>
                  ) : (currentFileUrl || fileUrl) && isEditMode ? (
                    <div className="space-y-2">
                      <FileText className="w-12 h-12 text-black mx-auto" />
                      <p className="text-sm font-medium text-black">Current file</p>
                      <p className="text-xs text-gray-500">File is already uploaded</p>
                      <div className="flex items-center justify-center space-x-4">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm text-black hover:text-gray-700 font-medium"
                        >
                          Change file
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm font-medium text-black hover:text-gray-700"
                        >
                          Click to upload
                        </button>
                        <p className="text-xs text-gray-600 mt-1">or drag and drop</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => navigate('/teacher/dashboard')}
                        className="w-1/2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                <button
                  type="submit"
                  disabled={(!uploadedFile && !currentFileUrl && !isEditMode) || (!fileUrl && !currentFileUrl) || uploading || loadingTest}
                  className="w-1/2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFinalSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                {questions.map((question, questionIndex) => (
                  <div key={questionIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="font-semibold text-gray-900">{questionIndex + 1})</span>
                        <div className="flex items-center space-x-4">
                          {question.variants.map((variant, variantIndex) => (
                            <label key={variantIndex} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`question-${questionIndex}`}
                                checked={question.correctVariantIndex === variantIndex}
                                onChange={() => handleCorrectVariantChange(questionIndex, variantIndex)}
                                className="w-5 h-5 text-black border-gray-300 focus:ring-black"
                              />
                              <span className="text-sm text-gray-700">{getVariantLabel(variantIndex)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => addVariant(questionIndex)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition text-gray-600 hover:text-black"
                          title="Add variant"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                        {question.variants.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeVariant(questionIndex, question.variants.length - 1)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition text-gray-600 hover:text-red-600"
                            title="Remove last variant"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="w-1/2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Test' : 'Create Test')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
