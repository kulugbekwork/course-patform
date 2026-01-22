import { useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface CreateTypePopupProps {
  onClose: () => void;
  onSelectTest?: (mode: 'create' | 'upload') => void;
  onSelectPlaylist?: () => void;
  onSelectLesson?: () => void;
  mode?: 'test' | 'lesson';
}

export default function CreateTypePopup({ onClose, onSelectTest, onSelectPlaylist, onSelectLesson, mode = 'test' }: CreateTypePopupProps) {
  const [showTestOptions, setShowTestOptions] = useState(false);

  if (showTestOptions) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setShowTestOptions(false)}
              className="text-gray-400 hover:text-gray-600 transition mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-black flex-1">Create Test</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                onSelectTest('create');
                onClose();
              }}
              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition text-left"
            >
              <div className="font-semibold text-black mb-1">Create manually</div>
              <div className="text-sm text-gray-600">Manually create test questions and answers</div>
            </button>

            <button
              onClick={() => {
                onSelectTest('upload');
                onClose();
              }}
              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition text-left"
            >
              <div className="font-semibold text-black mb-1">Upload File</div>
              <div className="text-sm text-gray-600">Upload a file with questions and answers</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-black">Create New</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'test' && onSelectTest && (
            <button
              onClick={() => setShowTestOptions(true)}
              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition text-left"
            >
              <div className="font-semibold text-black mb-1">Test</div>
              <div className="text-sm text-gray-600">Create a single test with questions</div>
            </button>
          )}

          {mode === 'test' && onSelectPlaylist && (
            <button
              onClick={() => {
                onSelectPlaylist();
                onClose();
              }}
              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition text-left"
            >
              <div className="font-semibold text-black mb-1">Playlist</div>
              <div className="text-sm text-gray-600">Create a collection of tests for students</div>
            </button>
          )}

          {mode === 'lesson' && (
            <>
              {onSelectLesson && (
                <button
                  onClick={() => {
                    onSelectLesson();
                    onClose();
                  }}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition text-left"
                >
                  <div className="font-semibold text-black mb-1">Lesson</div>
                  <div className="text-sm text-gray-600">Create a lesson with video content</div>
                </button>
              )}

              {onSelectPlaylist && (
                <button
                  onClick={() => {
                    onSelectPlaylist();
                    onClose();
                  }}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition text-left"
                >
                  <div className="font-semibold text-black mb-1">Playlist</div>
                  <div className="text-sm text-gray-600">
                    {mode === 'lesson' 
                      ? 'Create a collection of tests for this lesson'
                      : 'Create a collection of tests for students'}
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
