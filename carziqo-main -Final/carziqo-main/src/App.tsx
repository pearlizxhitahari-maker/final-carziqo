import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthPage from '@/pages/AuthPage';
import AboutPage from '@/pages/AboutPage';
import UserApp from '@/pages/user/UserApp';
import AdminApp from '@/pages/admin/AdminApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useState } from 'react';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [showAbout, setShowAbout] = useState(false);

  if (showAbout) {
    return <AboutPage onBack={() => setShowAbout(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage onShowAbout={() => setShowAbout(true)} />;
  }

  if (profile.role === 'admin') {
    return <AdminApp onShowAbout={() => setShowAbout(true)} />;
  }

  return <UserApp onShowAbout={() => setShowAbout(true)} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
