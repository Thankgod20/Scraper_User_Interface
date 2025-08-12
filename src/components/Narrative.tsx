import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target, MessageCircle, Activity, ThumbsUp, ThumbsDown, BarChart3, Zap } from 'lucide-react';

// TypeScript interface
interface AINarrativeResponse {
  mainNarrative: string;
  keyThemes: {
    positive: string[];
    negative: string[];
  };
  narrativeScore: number;
  scoreReasoning: string;
  summary: string;
}

interface AIAnalysisCardProps {
  analysisResult?: AINarrativeResponse | null;
}

const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({ analysisResult }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Default data for demo - matches the AINarrativeResponse interface
 

  // Use provided data or fall back to default
  const result = analysisResult ;

  // Validate that the result has the expected structure
  const isValidResult = (data: any): data is AINarrativeResponse => {
    return data && 
           typeof data.mainNarrative === 'string' &&
           typeof data.narrativeScore === 'number' &&
           typeof data.scoreReasoning === 'string' &&
           typeof data.summary === 'string' &&
           data.keyThemes &&
           Array.isArray(data.keyThemes.positive) &&
           Array.isArray(data.keyThemes.negative);
  };

  if (!isValidResult(result)) {
    return (
      <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold">Invalid Data Structure</h3>
        </div>
        <p className="text-red-700 mt-2">
          The analysisResult prop must match the AINarrativeResponse interface structure.
        </p>
      </div>
    );
  }

  const getScoreColor = (score:number) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    if (score >= 4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score:number) => {
    if (score >= 8) return 'Strong';
    if (score >= 6) return 'Moderate';
    if (score >= 4) return 'Weak';
    return 'Very Weak';
  };

  const getScoreIcon = (score:number) => {
    if (score >= 6) return <TrendingUp className="w-4 h-4" />;
    if (score >= 4) return <Activity className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const ThemesList: React.FC<{ themes: string[], type: 'positive' | 'negative' }> = ({ themes, type }) => (
    <div className="space-y-2">
      {themes.map((theme, index) => (
        <div 
          key={index}
          className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
            type === 'positive' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {type === 'positive' ? (
            <ThumbsUp className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ThumbsDown className="w-3 h-3 flex-shrink-0" />
          )}
          <span className="flex-1">{theme}</span>
        </div>
      ))}
    </div>
  );

  const ScoreVisualization: React.FC<{ score: number }> = ({ score }) => {
    const percentage = (score / 10) * 100;
    
    return (
      <div className="relative w-24 h-24 mx-auto">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke={score >= 6 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444'}
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${percentage * 2.51} 251`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{score}</div>
            <div className="text-xs text-gray-500">/ 10</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">AI Narrative Analysis</h2>
            <p className="text-blue-100 text-sm">Comprehensive sentiment and narrative strength evaluation</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-full font-semibold text-sm ${getScoreColor(result.narrativeScore)}`}>
              {getScoreIcon(result.narrativeScore)}
              <span className="ml-1">{getScoreLabel(result.narrativeScore)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'themes', label: 'Key Themes', icon: MessageCircle },
            { id: 'details', label: 'Details', icon: Target }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6 bg-gray-900">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  Main Narrative
                </h3>
                <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
                  <p className="text-gray-300 leading-relaxed">{result.mainNarrative}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Narrative Score</h3>
                <ScoreVisualization score={result.narrativeScore} />
                <div className="text-center mt-4">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${getScoreColor(result.narrativeScore)}`}>
                    {getScoreIcon(result.narrativeScore)}
                    {getScoreLabel(result.narrativeScore)} Narrative
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-400" />
                Executive Summary
              </h3>
              <p className="text-gray-300 leading-relaxed">{result.summary}</p>
            </div>
          </div>
        )}

        {activeTab === 'themes' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-green-400" />
                  Positive Themes
                  <span className="text-sm font-normal text-gray-400">({result.keyThemes.positive.length})</span>
                </h3>
                <ThemesList themes={result.keyThemes.positive} type="positive" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <ThumbsDown className="w-5 h-5 text-red-400" />
                  Negative Themes
                  <span className="text-sm font-normal text-gray-400">({result.keyThemes.negative.length})</span>
                </h3>
                <ThemesList themes={result.keyThemes.negative} type="negative" />
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h4 className="font-semibold text-gray-100 mb-2">Theme Balance Analysis</h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">Positive: {result.keyThemes.positive.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-300">Negative: {result.keyThemes.negative.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-300">
                    Ratio: {result.keyThemes.negative.length > 0 ? (result.keyThemes.positive.length / result.keyThemes.negative.length).toFixed(1) : '∞'}:1
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-yellow-400" />
                Score Reasoning
              </h3>
              <p className="text-gray-300 leading-relaxed">{result.scoreReasoning}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-3">Analysis Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Narrative Score:</span>
                    <span className="font-medium text-gray-200">{result.narrativeScore}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Positive Themes:</span>
                    <span className="font-medium text-green-400">{result.keyThemes.positive.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Negative Themes:</span>
                    <span className="font-medium text-red-400">{result.keyThemes.negative.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Overall Sentiment:</span>
                    <span className={`font-medium ${result.narrativeScore >= 5 ? 'text-green-400' : 'text-red-400'}`}>
                      {result.narrativeScore >= 5 ? 'Mixed-Positive' : 'Mixed-Negative'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-3">Risk Assessment</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Investment Risk:</span>
                    <span className={`font-medium ${result.narrativeScore >= 6 ? 'text-green-400' : result.narrativeScore >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {result.narrativeScore >= 6 ? 'Moderate' : result.narrativeScore >= 4 ? 'High' : 'Very High'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Narrative Strength:</span>
                    <span className="font-medium text-gray-200">{getScoreLabel(result.narrativeScore)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volatility:</span>
                    <span className="font-medium text-orange-400">High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



export default AIAnalysisCard;