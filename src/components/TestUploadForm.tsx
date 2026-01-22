import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, FileText, Plus, Minus } from 'lucide-react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

interface QuestionFromFile {
  questionNumber: number;
  questionText: string;
  variants: string[];
  correctVariantIndex: number | null;
}

export default function TestUploadForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [stage, setStage] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeMinutes, setTimeMinutes] = useState<number>(30);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [questions, setQuestions] = useState<QuestionFromFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploadedFile(file);
    setLoading(true);

    try {
      let content = '';

      // Check file extension
      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.split('.').pop();

      if (fileExtension === 'pdf') {
        // Use pdfjs-dist to extract text from PDF files
        try {
          // Set up pdfjs worker (using CDN worker for browser compatibility)
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          }
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          let fullText = '';
          
          // Extract text from all pages
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            fullText += pageText + '\n';
          }
          
          content = fullText.trim();
          
          if (!content || content.length === 0) {
            throw new Error('The PDF file appears to be empty or contains no extractable text. It may be an image-based PDF or scanned document.');
          }
        } catch (err: any) {
          if (err.message && err.message.includes('empty')) {
            throw err;
          }
          throw new Error(`Failed to extract text from PDF file: ${err.message || 'The file may be corrupted or password-protected.'}`);
        }
      } else if (fileExtension === 'docx') {
        // Use mammoth to extract text from .docx files
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
          
          if (result.messages.length > 0) {
            console.warn('Mammoth warnings:', result.messages);
          }
        } catch (err) {
          throw new Error('Failed to extract text from .docx file. Please ensure the file is not corrupted.');
        }
      } else {
        // For all other file types, try to read as text
        // This will work for .txt, .doc, .pdf, and any text-based files
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const result = event.target?.result;
              if (typeof result === 'string') {
                // Remove null bytes and other problematic characters
                const cleanedContent = result.replace(/\0/g, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
                resolve(cleanedContent);
              } else {
                reject(new Error('Failed to read file as text. The file may be in a binary format.'));
              }
            } catch (err: any) {
              reject(new Error(`Failed to read file content: ${err.message || 'Invalid file format'}`));
            }
          };
          reader.onerror = (error) => {
            reject(new Error('Failed to read file. The file may be corrupted or in a binary format that cannot be read as text.'));
          };
          reader.onabort = () => {
            reject(new Error('File reading was aborted.'));
          };
          try {
            // Try UTF-8 first, fallback to other encodings if needed
            reader.readAsText(file, 'UTF-8');
          } catch (err: any) {
            // If UTF-8 fails, try without specifying encoding
            try {
              reader.readAsText(file);
            } catch (err2: any) {
              reject(new Error(`Cannot read file: ${err2.message || 'Unsupported file format'}`));
            }
          }
        });
      }

      // Check if content is empty or too short
      if (!content || content.trim().length === 0) {
        throw new Error('The file appears to be empty or could not be read as text. Please ensure the file contains readable text content.');
      }

      setFileContent(content);
      
      // Parse questions from file
      parseQuestionsFromFile(content);
      
      // Reset file input to allow uploading the same or different file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to read file content. Please ensure the file contains readable text.');
      console.error('File read error:', err);
      setUploadedFile(null);
      setFileContent('');
      setQuestions([]);
      setQuestionCount(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setLoading(false);
    }
  };

  const parseQuestionsFromFile = (content: string) => {
    // Enhanced parsing: Look for numbered questions (1., 2., etc.) and variants (a., b., etc.)
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsedQuestions: QuestionFromFile[] = [];
    let currentQuestion: Partial<QuestionFromFile> | null = null;
    let currentVariants: string[] = [];
    let questionCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line starts with a number followed by period, parenthesis, or dash (question)
      const questionMatch = line.match(/^(\d+)[.)\-\s]+(.+)$/);
      if (questionMatch) {
        // Save previous question if exists
        if (currentQuestion && currentQuestion.questionText) {
          parsedQuestions.push({
            questionNumber: currentQuestion.questionNumber || questionCounter++,
            questionText: currentQuestion.questionText.trim(),
            variants: currentVariants.filter(v => v.trim().length > 0),
            correctVariantIndex: null,
          });
        }
        
        // Start new question
        currentQuestion = {
          questionNumber: parseInt(questionMatch[1]),
          questionText: questionMatch[2],
        };
        currentVariants = [];
      } else if (line.match(/^[a-eA-E][.)\-\s]+(.+)$/)) {
        // Answer variant (a., b., c., etc.)
        const variantMatch = line.match(/^[a-eA-E][.)\-\s]+(.+)$/);
        if (variantMatch && currentQuestion) {
          currentVariants.push(variantMatch[1]);
        }
      } else if (line.match(/^[F-Z][.)\-\s]+(.+)$/)) {
        // Variant with uppercase letter (F-Z, not A-E to avoid confusion)
        const variantMatch = line.match(/^[F-Z][.)\-\s]+(.+)$/);
        if (variantMatch && currentQuestion) {
          currentVariants.push(variantMatch[1]);
        }
      } else if (currentQuestion && line.length > 0) {
        // Continue question text or variant
        if (currentVariants.length === 0) {
          // Still in question text - append to question
          currentQuestion.questionText += ' ' + line;
        } else {
          // Might be a variant without letter prefix (if previous line was a variant)
          // Check if next line is a question or variant
          const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
          const isNextQuestion = nextLine.match(/^(\d+)[.)\-\s]+/);
          const isNextVariant = nextLine.match(/^[a-eA-E][.)\-\s]+/);
          
          if (!isNextQuestion && !isNextVariant) {
            // Continue current variant
            const lastIndex = currentVariants.length - 1;
            currentVariants[lastIndex] += ' ' + line;
          } else {
            // This might be a new variant without prefix
            currentVariants.push(line);
          }
        }
      }
    }

    // Add last question
    if (currentQuestion && currentQuestion.questionText) {
      parsedQuestions.push({
        questionNumber: currentQuestion.questionNumber || questionCounter++,
        questionText: currentQuestion.questionText.trim(),
        variants: currentVariants.filter(v => v.trim().length > 0),
        correctVariantIndex: null,
      });
    }

    // If no questions found with numbered format, try alternative parsing
    if (parsedQuestions.length === 0) {
      // Try to split by double newlines or question markers
      const sections = content.split(/\n\s*\n+/).filter(s => s.trim());
      sections.forEach((section, index) => {
        const sectionLines = section.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (sectionLines.length > 0) {
          const questionText = sectionLines[0];
          const variants = sectionLines.slice(1);
          
          if (variants.length >= 2) {
            parsedQuestions.push({
              questionNumber: index + 1,
              questionText: questionText,
              variants: variants,
              correctVariantIndex: null,
            });
          }
        }
      });
    }

    // Filter out questions with less than 2 variants
    const validQuestions = parsedQuestions.filter(q => q.variants.length >= 2);
    setQuestions(validQuestions);
    // Don't change question count - user must enter it manually
  };

  const handleStage1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a test title');
      return;
    }

    if (!uploadedFile) {
      setError('Please upload a file');
      return;
    }

    if (questionCount <= 0) {
      setError('Please enter the number of questions.');
      return;
    }

    // Create questions array from 1 to n based on questionCount
    // Each question will have variants a, b, c that user can select
    const newQuestions: QuestionFromFile[] = [];
    for (let i = 0; i < questionCount; i++) {
      // Use parsed question if available, otherwise create empty one
      const parsedQuestion = questions[i];
      newQuestions.push({
        questionNumber: i + 1,
        questionText: parsedQuestion?.questionText || '',
        variants: parsedQuestion?.variants || ['', '', ''],
        correctVariantIndex: null,
      });
    }
    setQuestions(newQuestions);
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
      // Clean file content (remove null bytes and control characters)
      const cleanFileContent = (content: string): string => {
        if (!content) return '';
        return content
          .replace(/\0/g, '') // Remove null bytes
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
          .trim();
      };

      // Create test
      const { data: insertData, error: insertError } = await supabase
        .from('tests')
        .insert({
          title,
          description: description || null,
          time_minutes: timeMinutes,
          teacher_id: profile?.id,
          file_content: cleanFileContent(fileContent),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!insertData) throw new Error('Failed to create test');
      const testId = insertData.id;

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

        const variantsToInsert = variantsToUse.map((variant, j) => ({
          question_id: questionData.id,
          variant_text: variant,
          is_correct: j === correctIndexInValid,
          order_index: j,
        }));

        const { error: variantsError } = await supabase
          .from('test_question_variants')
          .insert(variantsToInsert);

        if (variantsError) throw variantsError;
      }

      // Success - navigate outside try-catch to avoid showing error if navigation fails
      setLoading(false);
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test. Please try again.');
      console.error(err);
      setLoading(false);
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
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Upload Test from File</h1>
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
                  Upload File *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-black transition">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {loading ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 border-4 border-gray-300 border-t-black rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm font-medium text-black">Processing file...</p>
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
                            setFileContent('');
                            setQuestions([]);
                            setQuestionCount(0);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove file
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
                  disabled={!uploadedFile || questions.length === 0}
                  className="w-1/2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Set Correct Answers
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
                  {loading ? 'Creating...' : 'Create Test'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
