import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import LessonForm from './components/LessonForm';
import LessonView from './components/LessonView';
import TestForm from './components/TestForm';
import TestView from './components/TestView';
import TestTake from './components/TestTake';
import TestDocumentView from './components/TestDocumentView';
import TeacherProfile from './components/TeacherProfile';
import AddStudent from './components/AddStudent';
import EditStudent from './components/EditStudent';
import TestCreationMode from './components/TestCreationMode';
import TestUploadForm from './components/TestUploadForm';
import PlaylistForm from './components/PlaylistForm';
import LessonPlaylistForm from './components/LessonPlaylistForm';
import PlaylistView from './components/PlaylistView';

function AppRoutes() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (profile.role === 'teacher') {
    return (
      <Routes>
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        {/* Profile routes - more specific first */}
        <Route path="/teacher/profile/add-student" element={<AddStudent />} />
        <Route path="/teacher/profile/edit-student/:id" element={<EditStudent />} />
        <Route path="/teacher/profile" element={<TeacherProfile />} />
        {/* Lesson routes - more specific first */}
        <Route path="/teacher/lesson/new" element={<LessonForm />} />
        <Route path="/teacher/lesson/:id/view" element={<LessonView />} />
        <Route path="/teacher/lesson/:id" element={<LessonForm />} />
        {/* Test routes - more specific first */}
        <Route path="/teacher/test/new/mode" element={<TestCreationMode />} />
        <Route path="/teacher/test/new/upload" element={<TestUploadForm />} />
        <Route path="/teacher/test/new" element={<TestForm />} />
        <Route path="/teacher/test/:id/upload/edit" element={<TestUploadForm />} />
        <Route path="/teacher/test/:id/document" element={<TestDocumentView />} />
        <Route path="/teacher/test/:id/take" element={<TestTake />} />
        <Route path="/teacher/test/:id/view" element={<TestView />} />
        <Route path="/teacher/test/:id" element={<TestForm />} />
        {/* Playlist routes - more specific first */}
        <Route path="/teacher/lesson-playlist/new" element={<LessonPlaylistForm />} />
        <Route path="/teacher/lesson-playlist/:id/view" element={<PlaylistView />} />
        <Route path="/teacher/lesson-playlist/:id" element={<LessonPlaylistForm />} />
        <Route path="/teacher/playlist/new" element={<PlaylistForm />} />
        <Route path="/teacher/playlist/:id/view" element={<PlaylistView />} />
        <Route path="/teacher/playlist/:id" element={<PlaylistForm />} />
        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/student/dashboard" element={<StudentDashboard />} />
      {/* Lesson routes */}
      <Route path="/student/lesson/:id/view" element={<LessonView />} />
      {/* Test routes - more specific first */}
      <Route path="/student/test/:id/document" element={<TestDocumentView />} />
      <Route path="/student/test/:id/take" element={<TestTake />} />
      <Route path="/student/test/:id/view" element={<TestView />} />
      {/* Playlist routes */}
      <Route path="/student/playlist/:id" element={<PlaylistView />} />
      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
