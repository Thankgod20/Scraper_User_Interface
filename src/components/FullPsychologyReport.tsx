import React,{JSX} from 'react';
import { TrendingUp, AlertTriangle, Eye, Users, Flame, BarChart3, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { BehavioralAnalysisResult, AnalysisSection } from '../app/lib/analysisTypes'//'../lib/analysisTypes';

interface ReportProps {
  analysis: BehavioralAnalysisResult | null;
}

const FullPsychologyReport: React.FC<ReportProps> = ({ analysis }) => {
  if (!analysis) return null;

  const getRecommendationStyles = (recommendation: BehavioralAnalysisResult['recommendation']) => {
    switch (recommendation) {
      case 'BUY':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-green-400 bg-green-500/10 border-green-500/30',
        };
      case 'AVOID':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          color: 'text-red-400 bg-red-500/10 border-red-500/30',
        };
      case 'CAUTION / WAIT':
        return {
          icon: <Clock className="w-5 h-5" />,
          color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
        };
    }
  };
  
  const getDiagnosisStyles = (diagnosis: string) => {
     if (diagnosis.startsWith('🟢')) return 'text-green-400';
     if (diagnosis.startsWith('🟡')) return 'text-yellow-400';
     if (diagnosis.startsWith('🔴')) return 'text-red-400';
     if (diagnosis.startsWith('⚫️')) return 'text-gray-400';
     return 'text-gray-200';
  }

  const { icon: RecIcon, color: recColor } = getRecommendationStyles(analysis.recommendation);

  const SectionCard: React.FC<{ section: AnalysisSection }> = ({ section }) => {
    type AnalysisTitle =
  | 'Tweet Frequency Trend – Mass Attention Spike'
  | 'Weigh-Based Impressions – Engagement Intensity Score'
  | 'Tiered Impression Velocity – Segmented Crowd Energy'
  | 'Tweet Velocity Impressions – New Blood Detection'
  | 'Tweet FOMO Index – Emotional Temperature Check'
  | 'Final Diagnosis – Market Mood & Recommendation';
  const iconMap: Record<AnalysisTitle, JSX.Element> = {
    'Tweet Frequency Trend – Mass Attention Spike': <BarChart3 className="w-6 h-6 text-blue-400" />,
    'Weigh-Based Impressions – Engagement Intensity Score': <TrendingUp className="w-6 h-6 text-purple-400" />,
    'Tiered Impression Velocity – Segmented Crowd Energy': <Users className="w-6 h-6 text-teal-400" />,
    'Tweet Velocity Impressions – New Blood Detection': <Eye className="w-6 h-6 text-cyan-400" />,
    'Tweet FOMO Index – Emotional Temperature Check': <Flame className="w-6 h-6 text-orange-400" />,
    'Final Diagnosis – Market Mood & Recommendation': <Flame className="w-6 h-6 text-red-400" />, // You need to choose an appropriate icon here
  };

    return (
      <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-gray-700/50 p-2 rounded-full">
            {iconMap[section.title]}
          </div>
          <h3 className="text-md font-semibold text-gray-200">{section.title}</h3>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed">{section.diagnosis}</p>
      </div>
    );
  };


  return (
    <div className="max-w-4xl mx-auto bg-gray-900/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 overflow-hidden mt-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 border-b border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Behavioral Analysis Report</h2>
            <p className={`text-xl font-bold mt-1 ${getDiagnosisStyles(analysis.marketMoodDiagnosis)}`}>
              {analysis.marketMoodDiagnosis}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${recColor}`}>
            {RecIcon}
            <span>{analysis.recommendation}</span>
          </div>
        </div>
      </div>
      
      {/* Justification Section */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Justification</h3>
        <p className="text-gray-400 leading-relaxed text-sm">{analysis.justification}</p>
      </div>

      <hr className="border-gray-700 mx-6" />

      {/* Analysis Breakdown */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-100 mb-4">Framework Breakdown</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard section={analysis.analysisBreakdown.tweetFrequency} />
          <SectionCard section={analysis.analysisBreakdown.weighBasedImpressions} />
          <SectionCard section={analysis.analysisBreakdown.tieredImpressionVelocity} />
          <SectionCard section={analysis.analysisBreakdown.tweetVelocityImpressions} />
          <div className="lg:col-span-2">
            <SectionCard section={analysis.analysisBreakdown.tweetFomoIndex} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullPsychologyReport;