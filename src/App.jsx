import { useState, useEffect } from 'react';
import VideoEffectPreview from './components/VideoEffectPreview';
import './index.css';

function App() {
  const [instructions, setInstructions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load instructions file
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

export default App;