import * as kv from './kv_store.tsx';

/**
 * Get tasting note suggestions based on quality rating
 * This mirrors /utils/tastingNotes.ts to keep suggestions consistent
 * @param qualityRating 1 = Bad, 2 = Decent, 3 = Exceptional
 * @returns Array of all suggested tasting notes
 */
function getTastingNoteSuggestions(qualityRating: number): string[] {
  if (qualityRating === 3) {
    // Exceptional (🔥)
    return ['Balanced', 'Sweet', 'Clear', 'Juicy', 'Silky', 'Rounded', 'Clean Finish', 'Layered', 'Complex'];
  } else if (qualityRating === 2) {
    // Decent (👍)
    return ['Thin', 'Flat', 'Muted', 'Dry', 'Heavy', 'One-Note', 'Short Finish', 'Lacks Sweetness'];
  } else if (qualityRating === 1) {
    // Bad (👎)
    return ['Sour', 'Bitter', 'Astringent', 'Watery', 'Harsh', 'Burnt', 'Hollow', 'Weak', 'Unbalanced', 'Drying'];
  }
  // Default suggestions if no rating selected
  return ['Under-Extracted', 'Over-Extracted', 'Bitter', 'Sour', 'Bland', 'Balanced', 'Sweet', 'Syrupy', 'Clarity', 'Rounded'];
}

export interface NotificationState {
  extractionId: string;
  userId: string;
  startTime: string; // When the extraction was created
  messagesSent: number; // Number of messages sent (0 = none, 1 = initial, 2 = reminder)
}

// Format timestamp as "10:15 AM"
// Converts UTC timestamp to local time (browser's timezone when the extraction was created)
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  // toLocaleTimeString automatically converts UTC to the local timezone
  // This matches the frontend's formatDate function in App.tsx
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
}

// Send SMS via Twilio
export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      return false;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Twilio API error (${response.status}): ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error sending SMS to ${to}:`, error);
    return false;
  }
}

// Get all extractions for a specific user on a specific date with same coffee and method
export async function getExtractionsForCoffeeAndMethodOnDate(
  userId: string,
  coffeeId: string,
  method: string,
  createdAt: string
): Promise<any[]> {
  const allExtractions = await kv.getByPrefix('extraction:');
  const targetDate = new Date(createdAt).toDateString();
  
  return allExtractions
    .filter((ext: any) => 
      ext.userId === userId &&
      ext.coffeeId === coffeeId &&
      ext.method === method &&
      new Date(ext.createdAt).toDateString() === targetDate
    )
    .sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

// Build SMS message for extraction
export async function buildExtractionMessage(
  extraction: any,
  isReminder: boolean = false
): Promise<string> {
  // Extract just the time from localTimestamp or format from createdAt
  const timeStr = extraction.localTimestamp 
    ? (() => {
        // localTimestamp format: "Jan 26 at 10:10 AM"
        // Extract everything after "at "
        const match = extraction.localTimestamp.match(/at (.+)$/);
        return match ? match[1] : extraction.localTimestamp;
      })()
    : (() => {
        const date = new Date(extraction.createdAt);
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
      })();
  
  const coffeeName = `${extraction.roaster} - ${extraction.coffeeName}`;
  const method = extraction.method ? extraction.method.toLowerCase() : 'coffee';
  
  // Check if there are multiple extractions of same coffee AND method for this barista
  const sameExtractions = await getExtractionsForCoffeeAndMethodOnDate(
    extraction.userId,
    extraction.coffeeId,
    extraction.method,
    extraction.createdAt
  );
  
  let rankText = '';
  if (sameExtractions.length > 1) {
    const rank = sameExtractions.findIndex(e => e.id === extraction.id) + 1;
    const rankWords = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    // Only show ordinal for second and beyond (never include "first")
    if (rank > 1) {
      rankText = rankWords[rank - 1] ? `${rankWords[rank - 1]} ` : `#${rank} `;
    }
  }
  
  if (isReminder) {
    return `Reminder: Still curious about your ${rankText}${coffeeName} ${method} at ${timeStr}! Reply 1, 2, or 3 to rate it, or SKIP to skip.`;
  } else {
    return `Hey! How was your ${rankText}${coffeeName} ${method} at ${timeStr}? Reply with 1 (Bad), 2 (Decent), or 3 (Exceptional), or SKIP to skip.`;
  }
}

// Get or create notification queue for user
export async function getNotificationQueue(userId: string): Promise<string[]> {
  const queue = await kv.get(`notification_queue:${userId}`);
  return queue || [];
}

// Add extraction to notification queue with race condition protection
export async function addToNotificationQueue(userId: string, extractionId: string): Promise<void> {
  // Simple retry mechanism to handle concurrent modifications
  let retries = 3;
  while (retries > 0) {
    try {
      const queue = await getNotificationQueue(userId);
      if (!queue.includes(extractionId)) {
        queue.push(extractionId);
        await kv.set(`notification_queue:${userId}`, queue);
      }
      return; // Success
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      // Wait a short random time before retry to reduce collision
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    }
  }
}

// Remove extraction from notification queue
export async function removeFromNotificationQueue(userId: string, extractionId: string): Promise<void> {
  const queue = await getNotificationQueue(userId);
  const newQueue = queue.filter(id => id !== extractionId);
  await kv.set(`notification_queue:${userId}`, newQueue);
}

// Get active notification for user
export async function getActiveNotification(userId: string): Promise<NotificationState | null> {
  const activeKeys = await kv.getByPrefix(`notification_active:${userId}:`);
  return activeKeys.length > 0 ? activeKeys[0] : null;
}

// Set active notification
export async function setActiveNotification(state: NotificationState): Promise<void> {
  await kv.set(`notification_active:${state.userId}:${state.extractionId}`, state);
}

// Clear active notification
export async function clearActiveNotification(userId: string, extractionId: string): Promise<void> {
  await kv.del(`notification_active:${userId}:${extractionId}`);
}

// Map phone number to extraction for response tracking
export async function setPendingResponse(phoneNumber: string, extractionId: string): Promise<void> {
  await kv.set(`notification_pending:${phoneNumber}`, extractionId);
}

// Get extraction ID from phone number
export async function getPendingResponse(phoneNumber: string): Promise<string | null> {
  return await kv.get(`notification_pending:${phoneNumber}`);
}

// Clear pending response
export async function clearPendingResponse(phoneNumber: string): Promise<void> {
  await kv.del(`notification_pending:${phoneNumber}`);
}

// Set pending notes request
export async function setPendingNotes(phoneNumber: string, extractionId: string): Promise<void> {
  await kv.set(`notification_pending_notes:${phoneNumber}`, extractionId);
}

// Get extraction ID for pending notes
export async function getPendingNotes(phoneNumber: string): Promise<string | null> {
  return await kv.get(`notification_pending_notes:${phoneNumber}`);
}

// Clear pending notes
export async function clearPendingNotes(phoneNumber: string): Promise<void> {
  await kv.del(`notification_pending_notes:${phoneNumber}`);
}

// Handle notes response
export async function handleNotesResponse(phoneNumber: string, notes: string): Promise<boolean> {
  try {
    const extractionId = await getPendingNotes(phoneNumber);
    
    if (!extractionId) {
      return false;
    }

    const extraction = await kv.get(`extraction:${extractionId}`);
    
    if (!extraction) {
      await clearPendingNotes(phoneNumber);
      return false;
    }

    // Check if user wants to skip
    const skipKeywords = ['skip', 'no', 'none'];
    if (skipKeywords.includes(notes.trim().toLowerCase())) {
      await clearPendingNotes(phoneNumber);
      return true;
    }

    // Update extraction with notes (append to existing notes if any)
    const existingNotes = extraction.tastingNotes ? extraction.tastingNotes.trim() : '';
    const newNotes = notes.trim();
    
    if (existingNotes) {
      extraction.tastingNotes = `${existingNotes}, ${newNotes}`;
    } else {
      extraction.tastingNotes = newNotes;
    }
    
    await kv.set(`extraction:${extractionId}`, extraction);
    
    await clearPendingNotes(phoneNumber);

    return true;
  } catch (error) {
    console.error(`Error handling notes response:`, error);
    return false;
  }
}

// Start notification for an extraction (add to queue/state, will be sent after 5 min delay)
export async function startNotification(extractionId: string): Promise<void> {
  try {
    const extraction = await kv.get(`extraction:${extractionId}`);
    if (!extraction) {
      return;
    }

    // Check if already has a rating
    if (extraction.quality) {
      return;
    }

    const user = await kv.get(`user:${extraction.userId}`);
    if (!user) {
      return;
    }
    if (!user.phoneNumber) {
      return;
    }

    // Check if there's already an active notification for this user
    const activeNotification = await getActiveNotification(extraction.userId);
    if (activeNotification) {
      // Add to queue instead
      await addToNotificationQueue(extraction.userId, extractionId);
      return;
    }

    // Set as active notification with messagesSent = 0 (no messages sent yet)
    // The cron job will send the first message after 5 minutes
    await setActiveNotification({
      extractionId,
      userId: extraction.userId,
      startTime: extraction.createdAt, // Use extraction creation time
      messagesSent: 0, // No messages sent yet
    });
  } catch (error) {
    console.error(`Error starting notification for extraction ${extractionId}:`, error);
  }
}

// Process reminder for active notification
export async function processReminder(userId: string, state: NotificationState): Promise<void> {
  try {
    const extraction = await kv.get(`extraction:${state.extractionId}`);
    if (!extraction) {
      await clearActiveNotification(userId, state.extractionId);
      await processNextInQueue(userId);
      return;
    }

    // Check if rating was added
    if (extraction.quality) {
      await clearActiveNotification(userId, state.extractionId);
      
      const user = await kv.get(`user:${userId}`);
      if (user?.phoneNumber) {
        await clearPendingResponse(user.phoneNumber);
      }
      
      // Start next in queue
      await processNextInQueue(userId);
      return;
    }

    // Check if max messages reached (2 messages total: initial + 1 reminder)
    if (state.messagesSent >= 2) {
      await clearActiveNotification(userId, state.extractionId);
      
      const user = await kv.get(`user:${userId}`);
      if (user?.phoneNumber) {
        await clearPendingResponse(user.phoneNumber);
      }
      
      // Start next in queue
      await processNextInQueue(userId);
      return;
    }

    // Send message
    const user = await kv.get(`user:${userId}`);
    if (!user || !user.phoneNumber) {
      await clearActiveNotification(userId, state.extractionId);
      await processNextInQueue(userId);
      return;
    }

    const isReminder = state.messagesSent > 0;
    const message = await buildExtractionMessage(extraction, isReminder);
    const sent = await sendSMS(user.phoneNumber, message);

    if (sent) {
      // Update message count
      state.messagesSent++;
      await setActiveNotification(state);
      
      // Set pending response if this is the first message
      if (state.messagesSent === 1) {
        await setPendingResponse(user.phoneNumber, state.extractionId);
      }
    }
  } catch (error) {
    console.error(`Error processing reminder for extraction ${state.extractionId}:`, error);
  }
}

// Process next extraction in queue
export async function processNextInQueue(userId: string): Promise<void> {
  try {
    const queue = await getNotificationQueue(userId);
    if (queue.length === 0) {
      return;
    }

    // Get first extraction in queue
    const extractionId = queue[0];
    await removeFromNotificationQueue(userId, extractionId);

    const extraction = await kv.get(`extraction:${extractionId}`);
    if (!extraction) {
      // Skip this one, process next
      await processNextInQueue(userId);
      return;
    }

    // Check if already has a rating
    if (extraction.quality) {
      // Skip this one, process next
      await processNextInQueue(userId);
      return;
    }

    const user = await kv.get(`user:${extraction.userId}`);
    if (!user || !user.phoneNumber) {
      // Skip this one, process next
      await processNextInQueue(userId);
      return;
    }

    // Set as active notification with messagesSent = 0
    // The cron job will send the first message after 5 minutes from extraction creation
    await setActiveNotification({
      extractionId,
      userId: extraction.userId,
      startTime: extraction.createdAt, // Use extraction creation time
      messagesSent: 0, // No messages sent yet
    });
  } catch (error) {
    console.error(`Error processing next in queue for user ${userId}:`, error);
  }
}

// Handle SMS response with rating
export async function handleRatingResponse(phoneNumber: string, rating: number): Promise<boolean> {
  try {
    const extractionId = await getPendingResponse(phoneNumber);
    if (!extractionId) {
      return false;
    }

    const extraction = await kv.get(`extraction:${extractionId}`);
    if (!extraction) {
      await clearPendingResponse(phoneNumber);
      return false;
    }

    // Update extraction with rating
    extraction.quality = rating;
    await kv.set(`extraction:${extractionId}`, extraction);

    // Clear active notification (but keep pending response for notes)
    await clearActiveNotification(extraction.userId, extractionId);

    // Process next extraction in queue
    await processNextInQueue(extraction.userId);

    return true;
  } catch (error) {
    console.error(`Error handling rating response:`, error);
    return false;
  }
}

// Build notes request message with suggestions based on rating
export function buildNotesRequestMessage(rating: number): string {
  const suggestions = getTastingNoteSuggestions(rating);
  const suggestionText = suggestions.length > 0 ? ` Some suggestions: ${suggestions.join(', ')}.` : '';
  return `Any notes? Reply with comma-separated notes or SKIP to skip.${suggestionText}`;
}

// Check all active notifications and send messages if needed
// Timeline: 5 min (initial), 15 min (reminder) - max 2 messages for rating. Notes request sent after rating, no reminders.
// Also clears all notification states from previous day(s) at day boundary.
export async function checkReminders(): Promise<void> {
  try {
    // First, clear all notifications from previous day(s)
    await clearPreviousDayNotifications();
    
    const activeNotifications = await kv.getByPrefix('notification_active:');
    
    for (const state of activeNotifications) {
      const elapsed = Date.now() - new Date(state.startTime).getTime();
      const fiveMinutes = 5 * 60 * 1000;
      const fifteenMinutes = 15 * 60 * 1000;
      
      // Determine which message should be sent based on elapsed time
      let expectedMessages = 0;
      if (elapsed >= fifteenMinutes) {
        expectedMessages = 2; // Initial + 1 reminder
      } else if (elapsed >= fiveMinutes) {
        expectedMessages = 1; // Initial message
      }
      
      // Send message if we haven't sent it yet
      if (expectedMessages > state.messagesSent && state.messagesSent < 2) {
        await processReminder(state.userId, state);
      }
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}

// Clear all notification states from previous day(s)
// This runs on every cron check to ensure clean slate each day
export async function clearPreviousDayNotifications(): Promise<void> {
  try {
    // Get all active notifications
    const activeNotifications = await kv.getByPrefix('notification_active:');
    
    for (const state of activeNotifications) {
      // Get the extraction to access its timezone offset
      const extraction = await kv.get(`extraction:${state.extractionId}`);
      
      if (!extraction) {
        // If extraction doesn't exist, clear the notification
        await clearActiveNotification(state.userId, state.extractionId);
        const user = await kv.get(`user:${state.userId}`);
        if (user?.phoneNumber) {
          await clearPendingResponse(user.phoneNumber);
          await clearPendingNotes(user.phoneNumber);
        }
        continue;
      }
      
      // Use extraction's timezone offset
      const timezoneOffset = extraction.timezoneOffset;
      
      // Calculate "today" in the extraction's timezone
      const nowInExtractionTZ = new Date(Date.now() - (timezoneOffset * 60 * 1000));
      const todayInExtractionTZ = nowInExtractionTZ.toDateString();
      
      // Calculate the extraction's creation date in its timezone
      const extractionDate = new Date(new Date(state.startTime).getTime() - (timezoneOffset * 60 * 1000));
      const extractionDay = extractionDate.toDateString();
      
      // If notification is from a different day in that timezone, clear it
      if (extractionDay !== todayInExtractionTZ) {
        // Clear the active notification
        await clearActiveNotification(state.userId, state.extractionId);
        
        // Get user to clear their pending states
        const user = await kv.get(`user:${state.userId}`);
        if (user?.phoneNumber) {
          await clearPendingResponse(user.phoneNumber);
          await clearPendingNotes(user.phoneNumber);
        }
      }
    }
    
    // Also clear notification queues from previous day(s)
    // We need to check all users who might have queues
    const allUsers = await kv.getByPrefix('user:');
    for (const user of allUsers) {
      if (!user?.id) continue;
      
      const queue = await getNotificationQueue(user.id);
      if (queue.length === 0) continue;
      
      // Filter out extractions from previous days
      const todayQueue = [];
      for (const extractionId of queue) {
        const extraction = await kv.get(`extraction:${extractionId}`);
        if (extraction) {
          // Use extraction's timezone offset
          const timezoneOffset = extraction.timezoneOffset;
          
          // Calculate "today" in the extraction's timezone
          const nowInExtractionTZ = new Date(Date.now() - (timezoneOffset * 60 * 1000));
          const todayInExtractionTZ = nowInExtractionTZ.toDateString();
          
          // Calculate the extraction's creation date in its timezone
          const extractionDate = new Date(new Date(extraction.createdAt).getTime() - (timezoneOffset * 60 * 1000));
          const extractionDay = extractionDate.toDateString();
          
          if (extractionDay === todayInExtractionTZ) {
            todayQueue.push(extractionId);
          }
        }
      }
      
      // Update queue with only today's extractions
      if (todayQueue.length !== queue.length) {
        await kv.set(`notification_queue:${user.id}`, todayQueue);
      }
    }
  } catch (error) {
    console.error('Error clearing previous day notifications:', error);
  }
}