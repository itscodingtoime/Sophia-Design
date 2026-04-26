/**
 * Copilot API Service
 * 
 * API functions for the Performance Co-Pilot chat feature.
 */
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
    withCredentials: true,
});

// ============================================================================
// Types
// ============================================================================

export interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    message_count: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

export interface ChatHistoryResponse {
    sessions: ChatSession[];
}

export interface SessionMessagesResponse {
    session_id: string;
    title: string;
    messages: ChatMessage[];
}

export interface SendMessageResponse {
    response: string;
    session_id: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Send a message to the Performance Co-Pilot.
 * Creates a new session if session_id is not provided.
 */
export const sendChatMessage = async (
    message: string,
    sessionId: string | null,
    token: string
): Promise<SendMessageResponse> => {
    const response = await api.post<SendMessageResponse>(
        '/v1/copilot/chat/message',
        {
            message,
            session_id: sessionId,
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
};

/**
 * Get the user's chat history (list of sessions).
 */
export const getChatHistory = async (token: string): Promise<ChatHistoryResponse> => {
    const response = await api.get<ChatHistoryResponse>('/v1/copilot/chat/history', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};

/**
 * Get all messages from a specific chat session.
 */
export const getSessionMessages = async (
    sessionId: string,
    token: string
): Promise<SessionMessagesResponse> => {
    const response = await api.get<SessionMessagesResponse>(
        `/v1/copilot/chat/${sessionId}/messages`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
    return response.data;
};
