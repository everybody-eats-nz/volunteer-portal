import type { APIRoute } from 'astro';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getRelevantDocs } from '../../../lib/docs-index';

export const prerender = false;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// In-memory conversation tracking (in production, use a database)
const conversations = new Map<string, ChatMessage[]>();

function shouldSearchForNewDocs(messages: ChatMessage[]): boolean {
  // Always search for the first message
  if (messages.length === 1) return true;
  
  // Search every 3-4 messages to keep context fresh
  if (messages.length % 4 === 1) return true;
  
  return false;
}

function sanitizeResponse(content: string): string {
  // Remove markdown code blocks and excessive formatting
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-auth-key',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }


    // Set the API key in the process environment for the SDK to find
    const anthropicKey = import.meta.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      process.env.ANTHROPIC_API_KEY = anthropicKey;
    }

    // Optional authentication (skip if not set)
    const authKey = request.headers.get('x-auth-key');
    const expectedAuthKey = process.env.STAR_SUPPORT_AUTH_KEY || import.meta.env.STAR_SUPPORT_AUTH_KEY;
    
    if (expectedAuthKey && expectedAuthKey !== 'your_auth_key_here' && authKey !== expectedAuthKey) {
      console.log('Debug - Auth key mismatch');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { messages }: ChatRequest = await request.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== 'user') {
      return new Response(JSON.stringify({ error: 'Last message must be from user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get conversation ID from headers or generate one
    const conversationId = request.headers.get('x-conversation-id') || Math.random().toString(36);
    
    // Track conversation history (limit to last 10 messages to prevent token overflow)
    const conversationHistory = conversations.get(conversationId) || [];
    conversationHistory.push(userMessage);
    conversations.set(conversationId, conversationHistory.slice(-10));

    let sources: any[] = [];
    let systemPrompt = `You are a helpful assistant for the Everybody Eats Volunteer Portal documentation. 
You help administrators and volunteers understand how to use the volunteer management system.

Keep your responses concise and helpful. If you don't know something, say so and suggest where users might find more information.`;

    // Search for relevant documentation if needed
    if (shouldSearchForNewDocs(conversationHistory)) {
      try {
        const relevantDocs = await getRelevantDocs(userMessage.content);
        sources = relevantDocs;
        
        if (relevantDocs.length > 0) {
          const docsContent = relevantDocs
            .map(doc => `## ${doc.title}\n${doc.content}`)
            .join('\n\n');
          
          systemPrompt = `You are a helpful assistant for the Everybody Eats Volunteer Portal documentation.
You help administrators and volunteers understand how to use the volunteer management system.

Here is relevant documentation to help answer the user's question:

${docsContent}

Use this documentation to provide accurate, helpful answers. If the documentation doesn't contain the answer, say so and suggest where users might find more information.
Keep your responses concise and reference specific sections when helpful.`;
        }
      } catch (error) {
        console.error('Error getting relevant docs:', error);
        // Continue without docs if there's an error
      }
    }

    // Get AI model configuration
    const modelName = import.meta.env.STAR_SUPPORT_MODEL || 'claude-3-haiku-20240307';
    
    // Create messages for AI
    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.slice(-5) // Keep last 5 messages for context
    ];

    // Generate response using Vercel AI SDK with Claude
    const result = await streamText({
      model: anthropic(modelName),
      messages: aiMessages,
      temperature: 0.7,
      maxTokens: 500,
    });

    // Get the response text
    let responseContent = '';
    for await (const chunk of result.textStream) {
      responseContent += chunk;
    }

    // Sanitize the response
    responseContent = sanitizeResponse(responseContent);

    // Add assistant response to conversation history
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseContent
    };
    
    conversationHistory.push(assistantMessage);
    conversations.set(conversationId, conversationHistory.slice(-10));

    // Return response
    return new Response(JSON.stringify({
      message: responseContent,
      sources: sources.length > 0 ? sources.map(s => ({
        title: s.title,
        slug: s.slug,
        url: s.url
      })) : undefined,
      conversationId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: 'Sorry, I encountered an error. Please try again.'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// Handle OPTIONS requests for CORS
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-auth-key, x-conversation-id',
    },
  });
};