// Types métier du module Chat Support

export type ChatSenderType = 'client' | 'admin';
export type ChatMediaType = 'image' | 'voice' | 'video' | 'file';

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
  media_duration_seconds: number | null;
  media_size_bytes: number | null;
  media_filename: string | null;
  media_waveform_peaks: number[] | null;
  reply_to_message_id: string | null;
  read_at: string | null;
  created_at: string;
}

/** Preview synthétique du message cité (utilisé dans la bulle pour afficher la citation) */
export interface QuotedMessagePreview {
  id: string;
  sender_type: ChatSenderType;
  content: string | null;
  media_type: ChatMediaType | null;
  media_filename: string | null;
}

// Conversation enrichie avec le nom du client (côté liste admin)
export interface ChatConversationWithClient extends ChatConversation {
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  last_message_preview: string | null;
}
