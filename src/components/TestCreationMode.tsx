import { useNavigate } from 'react-router-dom';
import { FileText, Upload, ArrowLeft } from 'lucide-react';

export default function TestCreationMode() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="flex items-center space-x-2 text-black hover:text-gray-600 transition-colors font-medium mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Create New Test</h1>
          <p className="text-gray-600 mt-2">Choose how you want to create your test</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create in Web App Option */}
          <button
            onClick={() => navigate('/teacher/test/new')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:border-black hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-black rounded-lg mb-4 group-hover:bg-gray-800 transition">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-black mb-2">Create in Web App</h2>
            <p className="text-gray-600">
              Manually create your test by adding questions and answer options directly in the platform.
            </p>
          </button>

          {/* Upload File Option */}
          <button
            onClick={() => navigate('/teacher/test/new/upload')}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:border-black hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-black rounded-lg mb-4 group-hover:bg-gray-800 transition">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-black mb-2">Upload File</h2>
            <p className="text-gray-600">
              Upload a file containing your questions and fill in the correct answer variants.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
