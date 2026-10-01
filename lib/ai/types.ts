export interface SearchResult {
  userId: string;
  handle: string;
  photo?: string;
  intent?: string;
  distance?: number;
  relevance: number; // 0-1
  reason: string; // why matched
}

export interface ModerationFlag {
  category: 'hate_speech' | 'adult' | 'violence' | 'spam' | 'other';
  confidence: number; // 0-1
  reason: string;
}

export interface ModerationResult {
  safe: boolean;
  flags: ModerationFlag[];
}

export interface DeepseekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
