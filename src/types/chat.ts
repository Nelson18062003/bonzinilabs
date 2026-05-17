// Types métier du module Chat Support

export type ChatSenderType = 'client' | 'admin';
export type ChatMediaType = 'image' | 'voice' | 'video' | 'file';
export type ChatReactionEmoji = '👍' | '❤️' | '✅' | '😂' | '😮' | '🙏';

export const ALLOWED_REACTIONS: ChatReactionEmoji[] = ['👍', '❤️', '✅', '😂', '😮', '🙏'];

export interface ChatConversation {
  id: string;
  client_id: string;
  subject: string | null;
  assigned_admin_id: string | null;
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
  assigned_admin_first_name?: string | null;
  assigned_admin_last_name?: string | null;
}

export interface ChatCannedResponse {
  id: string;
  label: string;
  content: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatClientQuickReply {
  id: string;
  label: string;
  content: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  sender_type: ChatSenderType;
  emoji: ChatReactionEmoji;
  created_at: string;
}

export interface ChatAdminStats {
  period_days: number;
  open_conversations: number;
  closed_conversations: number;
  unassigned_open: number;
  total_messages: number;
  client_messages: number;
  admin_messages: number;
  avg_response_seconds_global: number;
  per_admin: Array<{
    admin_user_id: string;
    first_name: string | null;
    last_name: string | null;
    replies_count: number;
    avg_response_seconds: number;
  }>;
}

export interface ChatSearchResult {
  conversation_id: string;
  client_id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  match_count: number;
  last_match_at: string;
  snippet: string;
}
