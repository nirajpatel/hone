import { Badge } from './ui/badge';

// Helper function to add period if not already present
const addPeriod = (text: string): string => {
  if (!text) return text;
  const trimmed = text.trim();
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
};

// Type for structured AI suggestions (for coffees with history)
export interface AISuggestionsData {
  summary: string;
  primaryIssue: string;
  suggestions: Array<{
    parameter: string;
    action: string;
    effect: string;
    reasoning: string;
    confidence: 'High' | 'Medium' | 'Low';
  }>;
  basis?: string[];
}

// Type for first-time coffee suggestions
export interface FirstTimeSuggestionsData {
  introduction: string;
  parameters: Array<{
    name: string;
    recommendation: string;
    explanation: string;
  }>;
  note: string;
  basis?: string[];
}

// What the guidance drew on, e.g. "tried 18.2g / 1:1.8 on Apr 16: Decent twice"
function BasisLine({ basis }: { basis?: string[] }) {
  if (!basis || basis.length === 0) return null;
  return (
    <p className="text-xs text-gray-500 pt-1">
      Based on: {basis.join(' · ')}
    </p>
  );
}

// Component to format and display AI suggestions with better readability
export function FormattedAISuggestions({ suggestions }: { suggestions: string | AISuggestionsData | FirstTimeSuggestionsData }) {
  // Handle exceptional baseline brew message
  if (typeof suggestions === 'string' && suggestions.includes('dialed in')) {
    return (
      <p className="text-sm text-gray-900">
        {suggestions}
      </p>
    );
  }

  // Check if this is first-time suggestions (has 'introduction' field)
  if (typeof suggestions !== 'string' && 'introduction' in suggestions) {
    const data = suggestions as FirstTimeSuggestionsData;
    
    return (
      <div className="space-y-3">
        {/* Introduction */}
        {data.introduction && (
          <p className="text-sm text-gray-900">
            {data.introduction}
          </p>
        )}
        
        {/* Parameters List */}
        {data.parameters && data.parameters.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-gray-900">Suggestions</p>
            
            {/* Instruction Line */}
            {data.note && (
              <p className="text-sm text-gray-900">
                {data.note}
              </p>
            )}
            
            {data.parameters.map((param, index) => (
              <div key={index} className="space-y-1">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{index + 1}. {param.name}</span>
                </p>
                <p className="text-sm text-gray-900 pl-4">
                  {addPeriod(param.recommendation)} {addPeriod(param.explanation)}
                </p>
              </div>
            ))}
          </div>
        )}

        <BasisLine basis={data.basis} />
      </div>
    );
  }
  
  // Handle improvement suggestions (coffees with history)
  let data: AISuggestionsData;
  
  if (typeof suggestions === 'string') {
    // Legacy text parsing for backward compatibility
    const lines = suggestions.split('\n').filter(line => line.trim());
    
    let summary = '';
    let primaryIssue = '';
    const suggestionsList: Array<{
      parameter: string;
      action: string;
      effect: string;
      reasoning: string;
      confidence: 'High' | 'Medium' | 'Low';
    }> = [];
    
    let currentSection: 'summary' | 'primary' | 'instruction' | 'suggestions' = 'summary';
    
    for (const line of lines) {
      if (line.startsWith('Primary issue:')) {
        currentSection = 'primary';
        primaryIssue = line.replace('Primary issue:', '').trim();
      } else if (currentSection === 'summary') {
        summary = line;
      }
    }
    
    data = {
      summary,
      primaryIssue,
      suggestions: suggestionsList
    };
  } else {
    // Structured JSON data
    data = suggestions;
  }
  
  // Capitalize first letter of primary issue if needed
  if (data.primaryIssue && data.primaryIssue.length > 0) {
    data.primaryIssue = data.primaryIssue.charAt(0).toUpperCase() + data.primaryIssue.slice(1);
  }
  
  // Helper to get confidence badge color
  const getConfidenceBadgeClass = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'low':
        return 'bg-gray-100 text-gray-600 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };
  
  return (
    <div className="space-y-3">
      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-gray-900">
          {data.summary}
        </p>
      )}
      
      {/* Primary Issue */}
      {data.primaryIssue && (
        <p className="text-sm text-gray-900 pt-1">
          <span className="font-medium">Primary issue:</span> {data.primaryIssue}
        </p>
      )}
      
      {/* Suggestions List */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-gray-900">Suggestions</p>
          
          {/* Instruction Line */}
          <p className="text-sm text-gray-900">
            Try these in order, changing only one variable at a time so you can learn what works.
          </p>
          
          {data.suggestions.map((suggestion, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-900 flex-1">
                  <span className="font-medium">{index + 1}. {suggestion.parameter}</span>
                </p>
                {suggestion.confidence && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-900">Confidence:</span>
                    <Badge 
                      variant="outline" 
                      className={`${getConfidenceBadgeClass(suggestion.confidence)} text-xs px-2 py-0.5`}
                    >
                      {suggestion.confidence}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="pl-4 space-y-1">
                <p className="text-sm text-gray-900">
                  {addPeriod(suggestion.action)} {addPeriod(suggestion.effect)} {addPeriod(suggestion.reasoning)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <BasisLine basis={data.basis} />
    </div>
  );
}

