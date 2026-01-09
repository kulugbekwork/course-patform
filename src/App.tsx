import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Landing from './components/Landing';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import LessonForm from './components/LessonForm';
import LessonView from './components/LessonView';
import TestForm from './components/TestForm';
import TestView from './components/TestView';
import TestTake from './components/TestTake';

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
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (profile.role === 'teacher') {
    return (
      <Routes>
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/lesson/new" element={<LessonForm />} />
        <Route path="/teacher/lesson/:id" element={<LessonForm />} />
        <Route path="/teacher/lesson/:id/view" element={<LessonView />} />
        <Route path="/teacher/test/new" element={<TestForm />} />
        <Route path="/teacher/test/:id" element={<TestForm />} />
        <Route path="/teacher/test/:id/view" element={<TestView />} />
        <Route path="/teacher/test/:id/take" element={<TestTake />} />
        <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/student/dashboard" element={<StudentDashboard />} />
      <Route path="/student/lesson/:id/view" element={<LessonView />} />
      <Route path="/student/test/:id/view" element={<TestView />} />
      <Route path="/student/test/:id/take" element={<TestTake />} />
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
