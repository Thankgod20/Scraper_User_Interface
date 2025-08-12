// A generic structure for each section of the psychological analysis
export interface AnalysisSection {
    title: AnalysisTitle;
    diagnosis: string;
  }
  
  // The complete, structured analysis object returned by the function
  export interface BehavioralAnalysisResult {
    marketMoodDiagnosis: string;
    recommendation: 'BUY' | 'AVOID' | 'CAUTION / WAIT';
    justification: string;
    analysisBreakdown: {
      tweetFrequency: AnalysisSection;
      weighBasedImpressions: AnalysisSection;
      tieredImpressionVelocity: AnalysisSection;
      tweetVelocityImpressions: AnalysisSection;
      tweetFomoIndex: AnalysisSection;
      finalDiagnosis: AnalysisSection;
    };
  }
  // The title will now be one of these specific strings
type AnalysisTitle = 
| 'Tweet Frequency Trend – Mass Attention Spike'
| 'Weigh-Based Impressions – Engagement Intensity Score'
| 'Tiered Impression Velocity – Segmented Crowd Energy'
| 'Tweet Velocity Impressions – New Blood Detection'
| 'Tweet FOMO Index – Emotional Temperature Check'
| 'Final Diagnosis – Market Mood & Recommendation';

// A generic structure for each section of the psychological analysis

