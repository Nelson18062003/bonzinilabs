// Types métier du module Chat Support (Lot 1 : texte + photos uniquement)

export type ChatSenderType = 'client' | 'admin';
export type ChatMediaType = 'image';

export interface ChatConversation {
  id: string;
  client_id: string;
  status: 'open' | 'closed';
  last_message_at: string | null;
  last_client_message_at: string | null;
  last_admin_message_at: string | null;
  unread_count_client: number;
  unread_count_admin: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: ChatSenderType;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: ChatMediaType | null;
  read_at: string | null;
  created_at: string;
}

// Conversation enrichie avec le nom du client (côté liste admin)
export interface ChatConversationWithClient extends ChatConversation {
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  last_message_preview: string | null;
}
