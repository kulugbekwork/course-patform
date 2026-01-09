import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, FileText, ArrowRight } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center sm:justify-start items-center h-16">
            <h1 className="text-xl font-bold text-black">Course Platform</h1>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-6 px-4">
            Learn and Teach with Ease
          </h1>
          <p className="text-lg sm:text-xl text-black mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            A comprehensive platform for teachers to create courses and tests, and for students to learn at their own pace.
          </p>
          <div className="flex justify-center px-4">
            <button
              onClick={() => navigate('/login')}
              className="bg-black text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-gray-800 transition flex items-center space-x-2 w-full sm:w-auto justify-center"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-12 sm:mt-20 px-4 sm:px-0">
          <div className="bg-white border border-black rounded-xl p-6 sm:p-8">
            <div className="bg-black p-3 rounded-lg w-fit mb-4">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-black mb-2">Interactive Lessons</h3>
            <p className="text-black text-sm sm:text-base">
              Create and share engaging video lessons with your students. Upload videos and organize your content easily.
            </p>
          </div>

          <div className="bg-white border border-black rounded-xl p-6 sm:p-8">
            <div className="bg-black p-3 rounded-lg w-fit mb-4">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-black mb-2">Assessment Tests</h3>
            <p className="text-black text-sm sm:text-base">
              Build comprehensive tests with multiple-choice questions. Track student performance and ratings.
            </p>
          </div>

          <div className="bg-white border border-black rounded-xl p-6 sm:p-8">
            <div className="bg-black p-3 rounded-lg w-fit mb-4">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-black mb-2">Easy Access</h3>
            <p className="text-black text-sm sm:text-base">
              Students can easily access all courses and tests. Simple, intuitive interface for seamless learning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
