export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // HH:MM:SS format
  thinking?: string; // Claude's reasoning (assistant only)
}

export interface Session {
  id: string; // e.g. S001
  startTime: string; // ISO date string
  duration: string; // HH:MM:SS format 
  messages: Message[];
}

// In-memory array on the API route module
export const sessionStore: Session[] = [];
