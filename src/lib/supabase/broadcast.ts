/**
 * Shared utility for sending Supabase Broadcast messages
 *
 * This provides a reliable broadcast mechanism that waits for subscription
 * confirmation before sending, ensuring messages are delivered.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Options for sending a broadcast message
 */
interface BroadcastOptions {
  /** Channel name (e.g., 'session:abc123') */
  channel: string;
  /** Event name (e.g., 'student_code_updated') */
  event: string;
  /** Payload to send */
  payload: Record<string, unknown>;
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Send a broadcast message to a Supabase Realtime channel.
 *
 * Waits for the subscription to be confirmed before sending, ensuring
 * the message is delivered. Throws on timeout or channel errors.
 *
 * @param options - Broadcast options
 * @throws Error if environment variables are missing, subscription times out, or send fails
 */
export async function sendBroadcast(options: BroadcastOptions): Promise<void> {
  const { channel: channelName, event, payload, timeout = 5000 } = options;
  const startTime = Date.now();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for broadcast');
  }
  if (!supabaseKey) {
    throw new Error('SUPABASE_SECRET_KEY is required for broadcast');
  }

  console.log(`[sendBroadcast] Starting: channel=${channelName}, event=${event}`);

  const supabase = createClient(supabaseUrl, supabaseKey);
  const channel = supabase.channel(channelName);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log(`[sendBroadcast] TIMEOUT after ${timeout}ms: channel=${channelName}, event=${event}`);
      supabase.removeChannel(channel);
      reject(new Error('Broadcast subscription timed out'));
    }, timeout);

    channel.subscribe(async (status) => {
      console.log(`[sendBroadcast] Channel status: ${status}, channel=${channelName}, event=${event}, elapsed=${Date.now() - startTime}ms`);
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeoutId);
        try {
          await channel.send({
            type: 'broadcast',
            event,
            payload,
          });
          console.log(`[sendBroadcast] Message sent successfully: channel=${channelName}, event=${event}, total=${Date.now() - startTime}ms`);
          supabase.removeChannel(channel);
          resolve();
        } catch (error) {
          console.log(`[sendBroadcast] Send failed: channel=${channelName}, event=${event}, error=${error}`);
          supabase.removeChannel(channel);
          reject(error);
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.log(`[sendBroadcast] Channel error: ${status}, channel=${channelName}, event=${event}`);
        clearTimeout(timeoutId);
        supabase.removeChannel(channel);
        reject(new Error(`Broadcast channel error: ${status}`));
      }
    });
  });
}
