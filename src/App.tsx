import React, { useRef, useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const App: React.FC = () => {
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lastPos, setLastPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Use environment variable in production for security
  const API_KEY = 'YOUR_KEY_HERE';

  const genAI = new GoogleGenerativeAI(API_KEY);
  const generationConfig = {
    temperature: 0.9,
    topK: 32,
    topP: 0.95,
    maxOutputTokens: 1024,
  };

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    setLastPos(pos);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const currentPos = getCanvasPos(e);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    setLastPos(currentPos);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setResult('');
  };

  const handleAnalyzeDrawing = async () => {
    if (!canvasRef.current || !API_KEY) {
      setResult('Canvas or API key missing.');
      return;
    }

    setIsAnalyzing(true);
    setResult('');

    try {
      const imageDataUrl = canvasRef.current.toDataURL('image/png');
      const base64Image = imageDataUrl.split(',')[1];

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      const parts = [
        {
          text: `Transcribe the handwritten text or interpret the drawing in this image. Respond conversationally to the content as if it were a user message in a chat. For example, if the text is "hi," respond with something like "hi..." or a friendly reply. If it's a question, answer it naturally. If it's a command or request, fulfill it appropriately.

Decide independently if the response requires providing a URL (e.g., for searches like "search: cats", playlists like "playlist: song name", videos like "video: topic", or any other content that logically needs a web link). If you decide a URL is needed, respond in JSON format: {"type": "redirect", "value": "the_url_here"}. Otherwise, return just the conversational text response, no JSON.

If the content is a drawing, respond creatively based on what it resembles. Write clearly for best results.`,
        },
        {
          inlineData: { mimeType: 'image/png', data: base64Image },
        },
      ];

      const generatedContent = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig,
        safetySettings,
      });

      const responseText = generatedContent.response.text().trim();

      // Try to parse as JSON for potential redirect
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.type === 'redirect' && jsonResponse.value) {
          window.open(jsonResponse.value, '_blank');
          setResult('Redirecting...');
          return; // Exit early after redirect
        }
      } catch {
        // Not JSON, continue to display as text
      }

      // Display as plain text if no redirect
      setResult(responseText);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      setResult(`Analysis failed: ${error.message || 'Check console for details.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ backgroundColor: '#000000' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <button
        onClick={handleAnalyzeDrawing}
        disabled={isAnalyzing}
        className="fixed bottom-6 right-6 w-16 h-16 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
      >
        <Send className="w-6 h-6 text-black" />
      </button>
      <button
        onClick={clearCanvas}
        className="fixed bottom-6 left-6 px-4 py-2 bg-white rounded shadow-lg hover:shadow-xl transition-all duration-200"
      >
        Clear
      </button>
      {result && (
        <div className="fixed top-6 left-6 p-4 bg-white rounded shadow-lg max-w-md whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
};

export default App;