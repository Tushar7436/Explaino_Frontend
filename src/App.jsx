import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Link } from 'react-router-dom';
import VideoEffectPreview from './components/VideoEffectPreview';
import ProcessingPage from './components/ProcessingPage';
import RecordingSessionPage from './components/RecordingSessionPage';
import './index.css';

// Wrapper for recording page to extract sessionId from URL
function RecordingPageWrapper() {
  const { sessionId } = useParams();
  return <RecordingSessionPage sessionId={sessionId} />;
}

// Navigation header component
function Navigation({ currentPath }) {
  const navigate = useNavigate();

  return (
    <div style={{
      padding: '1rem 2rem',
      backgroundColor: '#1f2937',
      color: 'white',
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
      marginBottom: '2rem'
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginRight: 'auto', cursor: 'pointer' }} onClick={() => navigate('/')}>
        Explaino Platform
      </h1>
      <button
        onClick={() => navigate('/processing')}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: currentPath === '/processing' ? '#3b82f6' : 'transparent',
          color: 'white',
          border: '1px solid white',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: currentPath === '/processing' ? '600' : '400'
        }}
      >
        Processing Pipeline
      </button>
      <button
        onClick={() => navigate('/preview')}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: currentPath === '/preview' ? '#3b82f6' : 'transparent',
          color: 'white',
          border: '1px solid white',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: currentPath === '/preview' ? '600' : '400'
        }}
      >
        Effect Preview
      </button>
    </div>
  );
}

// Home page
function HomePage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Welcome to Explaino Platform
      </h1>
      <p style={{ fontSize: '1.125rem', color: '#666', marginBottom: '2rem' }}>
        AI-powered video processing with Deepgram, Gemini, and ElevenLabs
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link
          to="/processing"
          style={{
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '600'
          }}
        >
          Start Processing
        </Link>
        <a
          href="chrome://extensions/"
          style={{
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            backgroundColor: '#10b981',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '600'
          }}
        >
          Load Extension
        </a>
      </div>
      <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'left', maxWidth: '600px', margin: '3rem auto 0' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          📋 Quick Start
        </h2>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
          <li>Load the extension from <code>E:\Vocallabs\Go_Backend\explaino_extension\dist</code></li>
          <li>Start a screen recording</li>
          <li>Extension will redirect here to <code>/recording/[sessionId]</code></li>
          <li>Click "Process with AI Pipeline" to generate narrations</li>
          <li>View results with audio playback</li>
        </ol>
      </div>
    </div>
  );
}

// Preview page with instructions
function PreviewPage() {
  const [instructions, setInstructions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/instructions.json')
      .then(res => res.json())
      .then(data => {
        setInstructions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load instructions:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="app-header">
        <h1>Loading...</h1>
      </div>
    );
  }

  if (!instructions) {
    return (
      <div className="app-header">
        <h1>Error loading instructions</h1>
        <p>Please check the console for details</p>
      </div>
    );
  }

  return (
    <div>
      <div className="app-header">
        <h1>CSS-Based Video Effect Preview</h1>
        <p>Timeline-synchronized zoom effects with audio</p>
      </div>

      <VideoEffectPreview
        videoSrc="/video.webm"
        audioSrc="/audio.webm"
        instructions={instructions}
        frameWidth={1280}
        frameHeight={720}
      />
    </div>
  );
}

// Main App Router
function AppRouter() {
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, [window.location.pathname]);

  return (
    <div>
      <Navigation currentPath={currentPath} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/processing" element={<ProcessingPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/recording/:sessionId" element={<RecordingPageWrapper />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;