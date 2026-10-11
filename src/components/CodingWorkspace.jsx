import { useState, useRef, useMemo } from 'react'
import {
  Code2,
  Play,
  Copy,
  Check,
  Download,
  Trash2,
  RefreshCw,
  Sparkles,
  Send,
  Loader2,
  MessageSquare,
  PanelLeft,
  AlertCircle,
  FileCode,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { apiUrl } from '../lib/api'
import { BujjuIcon } from './BujjuLogo'

// Supported programming languages & metadata
const SUPPORTED_LANGUAGES = [
  { id: 'html', name: 'HTML / Web', ext: 'html', canPreview: true },
  { id: 'javascript', name: 'JavaScript', ext: 'js', canPreview: true },
  { id: 'css', name: 'CSS', ext: 'css', canPreview: true },
  { id: 'python', name: 'Python', ext: 'py', canPreview: false },
  { id: 'java', name: 'Java', ext: 'java', canPreview: false },
  { id: 'cpp', name: 'C++', ext: 'cpp', canPreview: false },
  { id: 'c', name: 'C', ext: 'c', canPreview: false },
  { id: 'sql', name: 'SQL', ext: 'sql', canPreview: false },
  { id: 'json', name: 'JSON', ext: 'json', canPreview: false },
]

// Default starter templates
const STARTER_TEMPLATES = {
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bujju AI Interactive Preview</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 100%);
      font-family: system-ui, -apple-system, sans-serif;
      color: #f8fafc;
      text-align: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      padding: 2.5rem 3rem;
      border-radius: 1.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-width: 420px;
    }
    h1 {
      margin: 0 0 0.5rem;
      background: linear-gradient(135deg, #60a5fa, #a855f7, #f43f5e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 2rem;
    }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
    button {
      margin-top: 1.5rem;
      padding: 0.75rem 1.75rem;
      border-radius: 9999px;
      border: none;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.5);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Bujju AI Sandbox</h1>
    <p>Live interactive web environment. Edit this HTML, CSS, and JS code or ask Bujju AI to build components!</p>
    <button id="counterBtn">Clicks: 0</button>
  </div>

  <script>
    let count = 0;
    const btn = document.getElementById('counterBtn');
    btn.addEventListener('click', () => {
      count++;
      btn.textContent = 'Clicks: ' + count + ' 🚀';
    });
  </script>
</body>
</html>`,
  javascript: `// Bujju AI JavaScript Playground
function analyzeData(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return null;
  
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  const average = sum / numbers.length;
  const max = Math.max(...numbers);
  const min = Math.min(...numbers);
  
  return {
    totalItems: numbers.length,
    sum,
    average: Number(average.toFixed(2)),
    min,
    max,
  };
}

const sampleDataset = [42, 17, 89, 34, 99, 12, 65];
console.log('Analysis Results:', analyzeData(sampleDataset));
`,
  python: `# Bujju AI Python Assistant
from typing import List, Dict, Any

def quick_sort(arr: List[int]) -> List[int]:
    """Sort an array of integers using the Divide and Conquer algorithm."""
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

if __name__ == "__main__":
    test_data = [64, 34, 25, 12, 22, 11, 90]
    sorted_data = quick_sort(test_data)
    print(f"Original: {test_data}")
    print(f"Sorted:   {sorted_data}")
`,
  css: `/* Bujju AI Modern Component Styling */
:root {
  --primary-glow: radial-gradient(rgba(66, 133, 244, 0.25), rgba(155, 114, 207, 0.15));
  --surface-bg: #1e1f20;
  --border-subtle: rgba(255, 255, 255, 0.08);
}

.ai-card {
  position: relative;
  border-radius: 1rem;
  background-color: var(--surface-bg);
  border: 1px solid var(--border-subtle);
  padding: 1.5rem;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.ai-card:hover {
  transform: translateY(-4px);
  border-color: rgba(66, 133, 244, 0.4);
  box-shadow: 0 12px 30px -10px rgba(66, 133, 244, 0.2);
}
`,
  java: `// Bujju AI Java Starter
public class Solution {
    public static void main(String[] args) {
        System.out.println("Hello from Bujju AI Coding Workspace!");
        
        int[] scores = {95, 88, 72, 99, 91};
        double avg = calculateAverage(scores);
        System.out.printf("Average Score: %.2f%n", avg);
    }
    
    public static double calculateAverage(int[] arr) {
        if (arr == null || arr.length == 0) return 0.0;
        int total = 0;
        for (int val : arr) {
            total += val;
        }
        return (double) total / arr.length;
    }
}
`,
  cpp: `// Bujju AI C++ Starter
#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>

int main() {
    std::cout << "Bujju AI C++ Assistant Ready" << std::endl;
    
    std::vector<int> numbers = {10, 25, 30, 45, 50};
    int sum = std::accumulate(numbers.begin(), numbers.end(), 0);
    
    std::cout << "Sum of elements: " << sum << std::endl;
    std::cout << "Total items: " << numbers.size() << std::endl;
    
    return 0;
}
`,
  c: `// Bujju AI C Starter
#include <stdio.h>

int main() {
    printf("Bujju AI C Programming Environment\\n");
    
    int a = 15;
    int b = 27;
    int sum = a + b;
    
    printf("%d + %d = %d\\n", a, b, sum);
    return 0;
}
`,
  sql: `-- Bujju AI SQL Schema & Queries
CREATE TABLE IF NOT EXISTS developer_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(120) NOT NULL,
    tech_stack VARCHAR(80) NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample records
INSERT INTO developer_projects (project_name, tech_stack, status) VALUES
('Bujju AI Workspace', 'React + Express + Gemini', 'active'),
('Mobile Companion', 'React Native', 'planned');

-- Query projects
SELECT * FROM developer_projects WHERE status = 'active';
`,
  json: `{
  "workspace": "Bujju AI Coding Assistant",
  "version": "1.0.0",
  "features": [
    "Syntax Highlighted Editor",
    "Sandboxed Live HTML Preview",
    "Gemini Coding Copilot",
    "Safe Code Download"
  ],
  "supportedLanguages": [
    "Python",
    "JavaScript",
    "HTML",
    "CSS",
    "Java",
    "C++",
    "C",
    "SQL",
    "JSON"
  ],
  "sandboxed": true
}
`,
}

export default function CodingWorkspace({
  onToggleSidebar,
  onBackToChat,
  _user,
  getAuthHeaders,
}) {
  const [selectedLanguage, setSelectedLanguage] = useState('html')
  const [code, setCode] = useState(() => STARTER_TEMPLATES.html)
  const [activeTab, setActiveTab] = useState('assistant') // 'assistant' | 'preview'
  const [mobilePanel, setMobilePanel] = useState('editor') // 'editor' | 'assistant' | 'preview'
  const [copied, setCopied] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  // AI Assistant states
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiResponse, setAiResponse] = useState(null)
  const [aiError, setAiError] = useState(null)

  // Line numbers calculation
  const textareaRef = useRef(null)
  const lineNumbersRef = useRef(null)

  const lineCount = useMemo(() => {
    return (code.match(/\n/g) || []).length + 1
  }, [code])

  const charCount = code.length

  const currentLangMeta = useMemo(() => {
    return (
      SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage) ||
      SUPPORTED_LANGUAGES[0]
    )
  }, [selectedLanguage])

  // Synchronize scroll between gutter and textarea
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop
    }
  }

  // Handle Tab key insertion (2 spaces) and Enter auto-indentation
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(newCode)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd =
            start + 2
        }
      }, 0)
    }
  }

  // Handle language change
  const handleLanguageChange = (newLang) => {
    setSelectedLanguage(newLang)
    if (STARTER_TEMPLATES[newLang]) {
      setCode(STARTER_TEMPLATES[newLang])
    }
    // Switch to preview if HTML is selected, otherwise default to assistant
    if (newLang === 'html' || newLang === 'javascript') {
      // keep user on their current tab or switch nicely
    } else {
      setActiveTab('assistant')
    }
    setAiResponse(null)
    setAiError(null)
  }

  // Copy code to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // Download code file
  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bujju_script.${currentLangMeta.ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Clear code with confirmation
  const handleClear = () => {
    if (window.confirm('Clear all code in the editor? This cannot be undone.')) {
      setCode('')
    }
  }

  // Request AI assistance (generate, explain, debug, optimize)
  const handleAiAction = async (customPrompt = null) => {
    const userQuery = customPrompt || prompt
    if (!userQuery.trim() || isGenerating) return

    setIsGenerating(true)
    setAiError(null)
    setAiResponse(null)
    setActiveTab('assistant')

    try {
      const headers = { 'Content-Type': 'application/json' }
      if (getAuthHeaders) {
        const authH = await getAuthHeaders()
        Object.assign(headers, authH)
      }

      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userQuery,
          mode: 'code',
          language: currentLangMeta.name,
          codeContext: code,
          wantsStream: false,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI coding assistance.')
      }

      setAiResponse(data.reply || '')
      if (!customPrompt) setPrompt('')
    } catch (err) {
      console.error('[CodingWorkspace] AI Error:', err)
      setAiError(err.message || 'An error occurred while contacting Bujju AI.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Extract clean code block from AI response to insert into editor
  const handleInsertCodeFromAi = () => {
    if (!aiResponse) return
    const codeBlockMatch = aiResponse.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
    if (codeBlockMatch && codeBlockMatch[1]) {
      setCode(codeBlockMatch[1].trim())
    } else {
      setCode(aiResponse)
    }
  }

  // HTML Sandboxed Preview Document
  // Injects dark mode styles and intercepts uncaught errors for friendly display
  const previewDoc = useMemo(() => {
    if (!currentLangMeta.canPreview) return ''

    let contentToRender = code
    // If user is writing plain JavaScript, wrap in a canvas / HTML boilerplate
    if (selectedLanguage === 'javascript') {
      contentToRender = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: monospace; background: #0f172a; color: #f8fafc; padding: 20px; }
    .log-line { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 6px 0; }
  </style>
</head>
<body>
  <h3>JavaScript Console Output</h3>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const log = (...args) => {
      const line = document.createElement('div');
      line.className = 'log-line';
      line.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      output.appendChild(line);
    };
    console.log = log;
    try {
      ${code}
    } catch (err) {
      const errLine = document.createElement('div');
      errLine.style.color = '#f87171';
      errLine.textContent = 'Runtime Error: ' + err.message;
      output.appendChild(errLine);
    }
  </script>
</body>
</html>`
    } else if (selectedLanguage === 'css') {
      contentToRender = `<!DOCTYPE html>
<html>
<head>
  <style>${code}</style>
</head>
<body style="font-family: system-ui; padding: 2rem; background: #121212; color: #fff;">
  <div class="ai-card">
    <h2>CSS Preview Component</h2>
    <p>Sample card demonstrating your custom CSS rules.</p>
    <button style="padding: 8px 16px; border-radius: 8px; cursor: pointer;">Sample Action</button>
  </div>
</body>
</html>`
    }

    return contentToRender
  }, [code, selectedLanguage, currentLangMeta.canPreview])

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131314] text-neutral-100 overflow-hidden select-none">
      {/* Top Navigation & Workspace Header */}
      <header className="h-14 shrink-0 flex items-center justify-between px-3 sm:px-6 border-b border-white/5 bg-[#1e1f20]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-[#282a2c] transition-colors md:hidden cursor-pointer"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          {/* Bujju AI Workspace Badge */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-[#4285f4]/20 to-[#9b72cf]/20 border border-[#4285f4]/30">
              <Code2 className="h-4 w-4 text-[#8ab4f8]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm tracking-tight">
                  Bujju AI
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#9b72cf]/20 text-[#cbb2fe] font-semibold border border-[#9b72cf]/30">
                  Coding Workspace
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right: Language Selector & Switch to Chat */}
        <div className="flex items-center gap-2.5">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-[#131314] px-2.5 py-1 rounded-full border border-white/5">
            <span className="text-[11px] text-neutral-400 font-medium">Lang:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-[#1e1f20] text-white">
                  {lang.name} (.{lang.ext})
                </option>
              ))}
            </select>
          </div>

          {/* Back to Chat Button */}
          <button
            type="button"
            onClick={onBackToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#e3e3e3] bg-[#282a2c] hover:bg-[#333537] hover:text-white border border-white/5 transition-all cursor-pointer shadow-xs"
            title="Return to Chat Mode"
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#8ab4f8]" />
            <span className="hidden sm:inline">Back to Chat</span>
          </button>
        </div>
      </header>

      {/* Mobile Panel Tab Switcher (< lg only) */}
      <div className="flex lg:hidden shrink-0 border-b border-white/5 bg-[#1e1f20]/80">
        {[
          { id: 'editor', label: 'Editor', icon: <FileCode className="h-3.5 w-3.5" /> },
          { id: 'assistant', label: 'AI Copilot', icon: <Sparkles className="h-3.5 w-3.5" /> },
          ...(currentLangMeta.canPreview ? [{ id: 'preview', label: 'Preview', icon: <Play className="h-3.5 w-3.5" /> }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePanel(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all cursor-pointer ${
              mobilePanel === tab.id
                ? 'text-white border-b-2 border-[#8ab4f8] bg-[#131314]/40'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Workspace Body: Split Screen on lg+, single-panel on mobile */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Primary: Code Editor Canvas - visible on lg+ always; on mobile only when mobilePanel==='editor' */}
        <div className={`flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 bg-[#131314] min-w-0 ${
          mobilePanel === 'editor' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Editor Action Bar */}
          <div className="h-10 shrink-0 flex items-center justify-between px-3 bg-[#1e1f20]/60 border-b border-white/5 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[#8ab4f8]">
                bujju_script.{currentLangMeta.ext}
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-[11px] text-neutral-400 font-mono">
                {lineCount} {lineCount === 1 ? 'line' : 'lines'}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                title="Copy code to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {/* Download File */}
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                title={`Download file (.${currentLangMeta.ext})`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>

              {/* Clear Editor */}
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                title="Clear editor code"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Editor Canvas with Line Numbers */}
          <div className="flex-1 flex overflow-hidden relative font-mono text-[13px] bg-[#131314]">
            {/* Line Numbers Gutter */}
            <div
              ref={lineNumbersRef}
              className="w-12 shrink-0 py-3 pr-2.5 text-right font-mono text-[12px] text-neutral-600 bg-[#161618] border-r border-white/5 select-none overflow-hidden leading-6"
              aria-hidden="true"
            >
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Textarea Code Input */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck="false"
              autoCapitalize="none"
              autoComplete="off"
              className="flex-1 p-3 bg-transparent text-[#e3e3e3] resize-none focus:outline-none overflow-auto font-mono text-[13px] leading-6 selection:bg-[#4285f4]/30"
              placeholder={`Write or paste your ${currentLangMeta.name} code here...`}
            />
          </div>

          {/* Editor Footer Status Bar */}
          <div className="h-6 shrink-0 flex items-center justify-between px-3 bg-[#161618] border-t border-white/5 text-[11px] text-neutral-500 font-mono">
            <div className="flex items-center gap-3">
              <span>{currentLangMeta.name}</span>
              <span>UTF-8</span>
              <span>{charCount} chars</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span>Safe Sandbox Environment</span>
            </div>
          </div>
        </div>

        {/* Right / Secondary: AI Copilot & Live Preview Panels */}
        <div className={`w-full lg:w-[480px] xl:w-[540px] flex flex-col bg-[#1e1f20] shrink-0 min-w-0 ${mobilePanel === 'editor' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Panel Tab Switcher (desktop only — mobile uses top tab switcher) */}
          <div className="hidden lg:flex h-10 shrink-0 items-center justify-between px-3 bg-[#161618] border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('assistant')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'assistant'
                    ? 'bg-[#282a2c] text-white border border-white/10'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#9b72cf]" />
                <span>AI Coding Copilot</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-[#282a2c] text-white border border-white/10'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Play className="h-3.5 w-3.5 text-emerald-400" />
                <span>Live Preview</span>
                {currentLangMeta.canPreview && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>

            {activeTab === 'preview' && currentLangMeta.canPreview && (
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Refresh preview"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tab 1: AI Coding Assistant — visible when activeTab==='assistant' on desktop, or mobilePanel==='assistant' on mobile */}
          {(activeTab === 'assistant' || mobilePanel === 'assistant') && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 bg-[#1e1f20]">
              {/* Quick Prompt Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  onClick={() => handleAiAction(`Explain how this ${currentLangMeta.name} code works step by step.`)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-[#131314] hover:bg-[#282a2c] border border-white/5 text-[11px] text-neutral-300 transition-colors cursor-pointer"
                >
                  🔍 Explain Code
                </button>
                <button
                  type="button"
                  onClick={() => handleAiAction(`Find any bugs, performance issues, or edge cases in this ${currentLangMeta.name} code and provide the fixed code.`)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-[#131314] hover:bg-[#282a2c] border border-white/5 text-[11px] text-neutral-300 transition-colors cursor-pointer"
                >
                  🐞 Debug & Fix
                </button>
                <button
                  type="button"
                  onClick={() => handleAiAction(`Optimize and refactor this ${currentLangMeta.name} code for maximum performance and readability.`)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-[#131314] hover:bg-[#282a2c] border border-white/5 text-[11px] text-neutral-300 transition-colors cursor-pointer"
                >
                  ⚡ Optimize
                </button>
                <button
                  type="button"
                  onClick={() => handleAiAction(`Write complete unit tests for this ${currentLangMeta.name} code.`)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-[#131314] hover:bg-[#282a2c] border border-white/5 text-[11px] text-neutral-300 transition-colors cursor-pointer"
                >
                  🧪 Write Tests
                </button>
              </div>

              {/* AI Response Display Area */}
              <div className="flex-1 overflow-y-auto p-3 rounded-xl bg-[#131314] border border-white/5 text-xs text-neutral-200 space-y-3">
                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-400">
                    <BujjuIcon size={36} animated={true} glow={true} />
                    <span className="text-xs font-medium text-neutral-300">
                      Bujju AI is analyzing and generating code...
                    </span>
                    <span className="text-[11px] text-[#8ab4f8]">
                      Consulting Gemini principal engineering intelligence
                    </span>
                  </div>
                )}

                {aiError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                )}

                {!isGenerating && !aiError && !aiResponse && (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-neutral-500 space-y-2">
                    <Sparkles className="h-8 w-8 text-[#9b72cf]/40" />
                    <p className="font-medium text-neutral-400 text-xs">
                      Bujju AI Coding Copilot is ready
                    </p>
                    <p className="text-[11px] text-neutral-500 max-w-xs leading-relaxed">
                      Ask me to write functions, build web components, fix errors, or refactor your {currentLangMeta.name} code.
                    </p>
                  </div>
                )}

                {!isGenerating && aiResponse && (
                  <div className="space-y-3">
                    {/* Header with Apply Button */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-[11px] font-semibold text-[#8ab4f8]">
                        Bujju AI Response
                      </span>
                      <button
                        type="button"
                        onClick={handleInsertCodeFromAi}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#4285f4]/15 hover:bg-[#4285f4]/25 text-[#8ab4f8] border border-[#4285f4]/30 text-[11px] font-medium transition-colors cursor-pointer"
                        title="Insert code into editor"
                      >
                        <ArrowRight className="h-3 w-3" />
                        <span>Insert into Editor</span>
                      </button>
                    </div>

                    {/* Pre-formatted AI Text */}
                    <div className="whitespace-pre-wrap leading-relaxed text-[12px] font-sans selection:bg-[#4285f4]/30">
                      {aiResponse}
                    </div>
                  </div>
                )}
              </div>

              {/* Prompt Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAiAction()
                }}
                className="mt-2.5 flex items-center gap-2 bg-[#131314] p-1.5 rounded-xl border border-white/5 focus-within:border-[#4285f4]/50 transition-colors"
              >
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Ask Bujju AI about your ${currentLangMeta.name} code...`}
                  disabled={isGenerating}
                  className="flex-1 bg-transparent px-2.5 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!prompt.trim() || isGenerating}
                  className="p-1.5 rounded-lg bg-[#4285f4] hover:bg-[#3367d6] text-white disabled:opacity-40 disabled:hover:bg-[#4285f4] transition-colors cursor-pointer shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Sandboxed Live Preview — visible when activeTab==='preview' on desktop, or mobilePanel==='preview' on mobile */}
          {(activeTab === 'preview' || mobilePanel === 'preview') && (
            <div className="flex-1 flex flex-col overflow-hidden p-2 bg-[#1e1f20]">
              {currentLangMeta.canPreview ? (
                <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-white/5 bg-white">
                  {/* Security Sandbox Badge */}
                  <div className="bg-[#161618] px-3 py-1.5 flex items-center justify-between text-[11px] text-neutral-400 border-b border-white/5">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Sandboxed iframe Preview (allow-scripts)</span>
                    </div>
                    <span className="text-[10px] text-neutral-500">
                      Isolated from parent session & tokens
                    </span>
                  </div>

                  {/* Sandboxed iframe */}
                  <iframe
                    key={previewKey}
                    title="Bujju AI Live Sandbox Preview"
                    sandbox="allow-scripts"
                    srcDoc={previewDoc}
                    className="flex-1 w-full h-full border-none bg-white"
                  />
                </div>
              ) : (
                /* Non-previewable languages (Python, Java, C++, SQL) notice */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-neutral-400 space-y-3 bg-[#131314] rounded-xl border border-white/5">
                  <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <FileCode className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">
                    {currentLangMeta.name} Sandbox Info
                  </h4>
                  <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                    In-browser interactive live preview is available for <strong>HTML</strong>, <strong>CSS</strong>, and <strong>JavaScript</strong>.
                  </p>
                  <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                    For backend languages like {currentLangMeta.name}, click the <strong>Download</strong> button in the toolbar to run the source code securely in your local environment or favorite IDE (VS Code, Python, GCC). Server-side command execution is intentionally restricted for your safety.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#4285f4] hover:bg-[#3367d6] text-white text-xs font-medium transition-colors cursor-pointer shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download {currentLangMeta.name} File</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
