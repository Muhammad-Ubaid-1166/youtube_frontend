import React, { useState, useEffect } from 'react';

// FIXED: Using localhost instead of 127.0.0.1 to match the CORS configuration
const API_URL = "http://localhost:8000";

const languages = [
  "Mandarin Chinese", "Spanish", "English", "Hindi", "Bengali", // Original
  // Added Asian Languages
  "Japanese", "Korean", "Vietnamese", "Thai", "Malay", "Indonesian", // Southeast Asia
  "Tagalog (Filipino)", "Burmese", "Khmer (Cambodian)", "Lao", // SE Asia
  "Tamil", "Telugu", "Punjabi", "Marathi", "Gujarati", "Kannada", "Malayalam", // South Asia (India)
  "Urdu", "Nepali", "Sinhala", "Assamese", // South Asia
  "Farsi (Persian)", "Arabic", "Turkish", "Hebrew", // West Asia
  "Cantonese", "Hakka", // Chinese dialects/languages
  "Kazakh", "Mongolian" // Central/North Asia
];


// --- Keys for localStorage ---
const METADATA_INSTRUCTION_KEY = 'metadataAgentInstruction';
const TRANSCRIPT_INSTRUCTION_KEY = 'transcriptAgentInstruction';

function App() {
  // --- State for the main process ---
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('English');
  
  // --- State for user-defined instructions ---
  const [metadataInstruction, setMetadataInstruction] = useState(
    "Rewrite and improve the title, description, and hashtags. The description should be about 300 words. Provide exactly 4 relevant hashtags."
  );
  const [transcriptInstruction, setTranscriptInstruction] = useState(
    "Rewrite the transcript into clear, formal, and professional language. Preserve the original meaning and flow."
  );

  // --- State for edit modes ---
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- State for clipboard feedback ---
  const [copiedSection, setCopiedSection] = useState(null);

  // --- Effect to load instructions from localStorage on mount ---
  useEffect(() => {
    const savedMetadataInstruction = localStorage.getItem(METADATA_INSTRUCTION_KEY);
    const savedTranscriptInstruction = localStorage.getItem(TRANSCRIPT_INSTRUCTION_KEY);

    if (savedMetadataInstruction) {
      setMetadataInstruction(savedMetadataInstruction);
    }
    if (savedTranscriptInstruction) {
      setTranscriptInstruction(savedTranscriptInstruction);
    }
  }, []);

  // --- UPDATED: Handler to save a specific instruction and clear data ---
  const handleSaveInstruction = (field) => {
    // Save the specific instruction to localStorage
    if (field === 'metadata') {
      localStorage.setItem(METADATA_INSTRUCTION_KEY, metadataInstruction);
      setIsEditingMetadata(false);
    } else if (field === 'transcript') {
      localStorage.setItem(TRANSCRIPT_INSTRUCTION_KEY, transcriptInstruction);
      setIsEditingTranscript(false);
    }

    // Clear all result-related state to ensure a clean slate
    setUrl('');
    setResult(null);
    setError(null);
    
    alert(`Instruction saved! Please enter a new URL to process.`);
  };

  const handleProcess = async (event) => {
    event.preventDefault();
    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }
    if (isEditingMetadata || isEditingTranscript) {
      setError("Please save your changes before processing.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // FIXED: Added better error handling for network issues
      const response = await fetch(`${API_URL}/process-video-completely`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: url, 
          language: language,
          metadata_instruction: metadataInstruction,
          transcript_instruction: transcriptInstruction,
        }),
      });

      // FIXED: Added more detailed error handling
      if (!response.ok) {
        if (response.status === 0) {
          throw new Error("Network error: Unable to connect to the server. Please make sure the server is running.");
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error (${response.status})`);
      }
      
      const data = await response.json();
      setResult(data);

    } catch (err) {
      // FIXED: More specific error messages
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError("Network error: Unable to connect to the server. Please make sure the server is running on " + API_URL);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditMetadataToggle = () => setIsEditingMetadata(!isEditingMetadata);
  const handleEditTranscriptToggle = () => setIsEditingTranscript(!isEditingTranscript);

  // --- UPDATED: Enhanced clipboard functions with better feedback ---
  const showCopyFeedback = (section) => {
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyTextToClipboard = async (text, section) => {
    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback(section);
    } catch (err) {
      setError('Failed to copy text to clipboard.');
    }
  };

  const copyImageToClipboard = async (imageUrl) => {
    try {
      // Fetch the image data
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create a ClipboardItem with the image blob
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      
      showCopyFeedback('image');
    } catch (err) {
      // Fallback: Copy the image URL if clipboard API fails
      copyTextToClipboard(imageUrl, 'imageUrl');
    }
  };

  const handleCopyAll = async () => {
    if (!result) return;
    const { metadata, transcript, image_description, generated_image_url, image_descriptions } = result;
    const imageText = image_description ? `\n\nImage Description:\n${image_description}` : '';
    const generatedImageText = generated_image_url ? `\n\nGenerated Image URL:\n${generated_image_url}` : '';
    
    // Add image descriptions to the copied text
    let imageDescriptionsText = '';
    if (image_descriptions && image_descriptions.images) {
      imageDescriptionsText = '\n\nImage Descriptions:\n';
      image_descriptions.images.forEach((img, index) => {
        imageDescriptionsText += `\nImage ${index + 1}:\nTitle: ${img.title}\nDescription: ${img.description}\n`;
      });
    }
    
    const textToCopy = `Title: ${metadata.title}\n\nDescription: ${metadata.description}\n\nHashtags: ${metadata.hashtags.join(', ')}\n\nTranscript:\n${transcript.transcription}${imageText}${generatedImageText}${imageDescriptionsText}`;
    
    copyTextToClipboard(textToCopy, 'all');
  };

  const handleCopyTitle = () => {
    if (result?.metadata?.title) {
      copyTextToClipboard(result.metadata.title, 'title');
    }
  };

  const handleCopyDescription = () => {
    if (result?.metadata?.description) {
      copyTextToClipboard(result.metadata.description, 'description');
    }
  };

  const handleCopyHashtags = () => {
    if (result?.metadata?.hashtags) {
      const hashtagsText = result.metadata.hashtags.map(tag => `#${tag}`).join(' ');
      copyTextToClipboard(hashtagsText, 'hashtags');
    }
  };

  const handleCopyTranscript = () => {
    if (result?.transcript?.transcription) {
      copyTextToClipboard(result.transcript.transcription, 'transcript');
    }
  };

  const handleCopyImageTitle = (index) => {
    if (result?.image_descriptions?.images && result.image_descriptions.images[index]) {
      copyTextToClipboard(result.image_descriptions.images[index].title, `imageTitle${index}`);
    }
  };

  const handleCopyImageDescription = (index) => {
    if (result?.image_descriptions?.images && result.image_descriptions.images[index]) {
      copyTextToClipboard(result.image_descriptions.images[index].description, `imageDescription${index}`);
    }
  };
  
  const handleCopyThumbnailDescription = () => {
    if (result?.image_description) {
      copyTextToClipboard(result.image_description, 'thumbnailDescription');
    }
  };
  
  const handleCopyImageDescriptions = () => {
    if (result?.image_descriptions?.images) {
      let text = '';
      result.image_descriptions.images.forEach((img, index) => {
        text += `Image ${index + 1}:\nTitle: ${img.title}\nDescription: ${img.description}\n\n`;
      });
      copyTextToClipboard(text, 'imageDescriptions');
    }
  };

  // --- UPDATED: Re-enable processing when URL changes ---
  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    if (e.target.value.trim()) {
      setError(null); // Clear any previous error
    }
  };

  // --- Helper function to render copy button with feedback ---
  const CopyButton = ({ onClick, section, label, className = "" }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
        copiedSection === section
          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
      } ${className}`}
    >
      {copiedSection === section ? (
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label || 'Copy'}
        </span>
      )}
    </button>
  );

  // --- Skeleton loading component ---
  const SkeletonLoader = () => (
    <div className="space-y-8">
      {/* Metadata Skeleton */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-16 w-full animate-pulse"></div>
        <div className="p-6 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="bg-gray-200 h-6 w-24 rounded-lg animate-pulse"></div>
              <div className="bg-gray-200 h-8 w-16 rounded-lg animate-pulse"></div>
            </div>
            <div className="bg-gray-200 h-6 w-full rounded-lg animate-pulse"></div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="bg-gray-200 h-6 w-28 rounded-lg animate-pulse"></div>
              <div className="bg-gray-200 h-8 w-16 rounded-lg animate-pulse"></div>
            </div>
            <div className="bg-gray-200 h-32 w-full rounded-lg animate-pulse"></div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="bg-gray-200 h-6 w-20 rounded-lg animate-pulse"></div>
              <div className="bg-gray-200 h-8 w-16 rounded-lg animate-pulse"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="bg-gray-200 h-6 w-20 rounded-full animate-pulse"></div>
              <div className="bg-gray-200 h-6 w-24 rounded-full animate-pulse"></div>
              <div className="bg-gray-200 h-6 w-16 rounded-full animate-pulse"></div>
              <div className="bg-gray-200 h-6 w-28 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Skeleton */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
        <div className="bg-gradient-to-r from-green-600 to-teal-600 h-16 w-full animate-pulse"></div>
        <div className="p-6">
          <div className="flex justify-end mb-3">
            <div className="bg-gray-200 h-8 w-16 rounded-lg animate-pulse"></div>
          </div>
          <div className="bg-gray-200 h-96 w-full rounded-lg animate-pulse"></div>
        </div>
      </div>

      {/* Image Descriptions Skeleton */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 h-16 w-full animate-pulse"></div>
        <div className="p-6 space-y-4">
          <div className="border-l-4 border-indigo-300 pl-4">
            <div className="bg-gray-200 h-6 w-24 rounded-lg animate-pulse mb-2"></div>
            <div className="bg-gray-200 h-4 w-full rounded-lg animate-pulse mb-1"></div>
            <div className="bg-gray-200 h-4 w-5/6 rounded-lg animate-pulse"></div>
          </div>
          <div className="border-l-4 border-indigo-300 pl-4">
            <div className="bg-gray-200 h-6 w-24 rounded-lg animate-pulse mb-2"></div>
            <div className="bg-gray-200 h-4 w-full rounded-lg animate-pulse mb-1"></div>
            <div className="bg-gray-200 h-4 w-5/6 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Generated Image Skeleton */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-16 w-full animate-pulse"></div>
        <div className="p-6">
          <div className="flex flex-col items-center">
            <div className="bg-gray-200 h-64 w-64 rounded-xl animate-pulse mb-4"></div>
            <div className="bg-gray-200 h-10 w-32 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section with Backdrop Blur */}
        <header className="text-center mb-12 relative">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-sm rounded-3xl -z-10"></div>
          <div className="relative z-10 py-8">
            <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 mb-6 leading-tight">
              YouTube Content Processor
            </h1>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Transform YouTube videos with AI-powered content enhancement. Customize instructions for metadata and transcript processing.
            </p>
          </div>
        </header>

        <main>
          {/* Form Section with Enhanced Styling */}
          <form onSubmit={handleProcess} className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 md:p-8 mb-10 border border-white/50">
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="flex-1">
                <label htmlFor="url-input" className="block text-sm font-semibold text-gray-700 mb-2">
                  YouTube URL
                </label>
                <input
                  id="url-input"
                  type="text"
                  value={url}
                  onChange={handleUrlChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
                  disabled={isLoading}
                />
              </div>
              <div className="w-full md:w-48">
                <label htmlFor="lang-select" className="block text-sm font-semibold text-gray-700 mb-2">
                  Output Language
                </label>
                <select
                  id="lang-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full h-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
                  disabled={isLoading}
                >
                  {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  type="submit" 
                  disabled={isLoading || !url.trim() || isEditingMetadata || isEditingTranscript} 
                  className={`px-6 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 ${
                    isLoading || !url.trim() || isEditingMetadata || isEditingTranscript
                      ? 'bg-gray-400 cursor-not-allowed shadow-md' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : 'Process Video'}
                </button>
              </div>
            </div>

            {/* Instruction Input Fields with Enhanced UI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="metadata-instruction" className="text-sm font-semibold text-gray-700">
                    Metadata Agent Instruction
                  </label>
                  {isEditingMetadata ? (
                    <button 
                      onClick={() => handleSaveInstruction('metadata')} 
                      className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md"
                    >
                      💾 Save
                    </button>
                  ) : (
                    <button 
                      onClick={handleEditMetadataToggle} 
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-md"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
                <textarea
                  id="metadata-instruction"
                  value={metadataInstruction}
                  onChange={(e) => setMetadataInstruction(e.target.value)}
                  placeholder="Enter instructions for processing the title, description, and hashtags..."
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-xl resize-none transition-all duration-200 ${
                    isEditingMetadata 
                      ? 'border-blue-500 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  disabled={!isEditingMetadata}
                />
              </div>
              
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="transcript-instruction" className="text-sm font-semibold text-gray-700">
                    Transcript Agent Instruction
                  </label>
                  {isEditingTranscript ? (
                    <button 
                      onClick={() => handleSaveInstruction('transcript')} 
                      className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md"
                    >
                      💾 Save
                    </button>
                  ) : (
                    <button 
                      onClick={handleEditTranscriptToggle} 
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-md"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
                <textarea
                  id="transcript-instruction"
                  value={transcriptInstruction}
                  onChange={(e) => setTranscriptInstruction(e.target.value)}
                  placeholder="Enter instructions for rewriting the transcript..."
                  rows={6}
                  className={`w-full px-4 py-3 border rounded-xl resize-none transition-all duration-200 ${
                    isEditingTranscript 
                      ? 'border-blue-500 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  disabled={!isEditingTranscript}
                />
              </div>
            </div>
          </form>

          {/* Enhanced Status Messages */}
          <div className="mb-10">
            {isLoading && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-xl shadow-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-700">
                      Processing video... This may take a few minutes depending on the video length.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl shadow-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-700">
                      <strong>Error:</strong> {error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Section with Enhanced Cards */}
          {isLoading ? (
            <SkeletonLoader />
          ) : result ? (
            <div className="space-y-8">
              <div className="flex justify-end">
                <CopyButton 
                  onClick={handleCopyAll} 
                  section="all" 
                  label="Copy All Content"
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                />
              </div>

              {/* Metadata Section with Enhanced Card */}
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">Processed Metadata</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-gray-800">Title</h3>
                      <CopyButton onClick={handleCopyTitle} section="title" />
                    </div>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">{result.metadata.title}</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-gray-800">Description</h3>
                      <CopyButton onClick={handleCopyDescription} section="description" />
                    </div>
                    <div className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {result.metadata.description}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-gray-800">Hashtags</h3>
                      <CopyButton onClick={handleCopyHashtags} section="hashtags" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.metadata.hashtags.map(tag => (
                        <span key={tag} className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-sm font-medium border border-blue-200">
                        {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcript Section with Enhanced Card */}
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">Rewritten Transcript</h2>
                </div>
                <div className="p-6">
                  <div className="flex justify-end mb-3">
                    <CopyButton onClick={handleCopyTranscript} section="transcript" />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 h-96 overflow-y-auto text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {result.transcript.transcription}
                  </div>
                </div>
              </div>

              {/* Image Descriptions Section with Enhanced Card */}
              {result.image_descriptions && result.image_descriptions.images && result.image_descriptions.images.length > 0 && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-bold text-white">Image Descriptions</h2>
                      <CopyButton onClick={handleCopyImageDescriptions} section="imageDescriptions" />
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-6">
                      {result.image_descriptions.images.map((image, index) => (
                        <div key={index} className="border-l-4 border-indigo-500 pl-4 bg-gray-50 p-4 rounded-r-xl">
                          <h3 className="text-lg font-semibold text-gray-800 mb-3">Image {index + 1}</h3>
                          <div className="mb-3">
                            <div className="flex justify-between items-start">
                              <span className="text-sm font-semibold text-gray-600 block mb-1">Title:</span>
                              <CopyButton 
                                onClick={() => handleCopyImageTitle(index)} 
                                section={`imageTitle${index}`} 
                                label="Copy"
                                className="ml-2"
                              />
                            </div>
                            <p className="text-gray-800 bg-white p-3 rounded-lg border border-gray-200">{image.title}</p>
                          </div>
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-sm font-semibold text-gray-600 block mb-1">Description:</span>
                              <CopyButton 
                                onClick={() => handleCopyImageDescription(index)} 
                                section={`imageDescription${index}`} 
                                label="Copy"
                                className="ml-2"
                              />
                            </div>
                            <p className="text-gray-800 bg-white p-3 rounded-lg border border-gray-200">{image.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Thumbnail Image Description Section with Enhanced Card */}
              {result.image_description && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">Thumbnail Image Description</h2>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-end mb-3">
                      <CopyButton onClick={handleCopyThumbnailDescription} section="thumbnailDescription" />
                    </div>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap">
                      {result.image_description}
                    </p>
                  </div>
                </div>
              )}

              {/* Generated Image Section with Enhanced Card */}
              {result.generated_image_url && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">AI-Generated Image</h2>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-col items-center">
                      <div className="relative mb-6">
                        <img 
                          src={result.generated_image_url} 
                          alt="AI-generated based on video description" 
                          className="max-w-full h-auto rounded-xl shadow-lg"
                          style={{ maxHeight: '400px' }}
                        />
                      </div>
                      <button 
                        onClick={() => copyImageToClipboard(result.generated_image_url)} 
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                      >
                        {copiedSection === 'image' || copiedSection === 'imageUrl' ? (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Image
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </main>

        {/* Enhanced Footer */}
        <footer className="mt-20 text-center text-gray-600 text-sm">
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <b><p>✨ Use it as you wish 😉</p></b>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
