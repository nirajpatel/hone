import * as kv from './kv_store.ts';

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
  brewId: string;
  userId: string;
  startTime: string; // When the brew was created
  messagesSent: number; // Number of messages sent (0 = none, 1 = initial, 2 = reminder)
}

// Format timestamp as "10:15 AM"
// Converts UTC timestamp to local time (browser's timezone when the brew was created)
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  // toLocaleTimeString automatically converts UTC to the local timezone
  // This matches the frontend's formatDate function in App.ts
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

// Get all brews for a specific user on a specific date with same coffee and method
export async function getBrewsForCoffeeAndMethodOnDate(
  userId: string,
  coffeeId: string,
  method: string,
  createdAt: string
): Promise<any[]> {
  const allBrews = await kv.getByPrefix('brew:');
  const targetDate = new Date(createdAt).toDateString();
  
  return allBrews
    .filter((brew: any) => 
      brew.userId === userId &&
      brew.coffeeId === coffeeId &&
      brew.method === method &&
      new Date(brew.createdAt).toDateString() === targetDate
    )
    .sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

// Build SMS message for brew
export async function buildBrewMessage(
  brew: any,
  isReminder: boolean = false
): Promise<string> {
  // Extract just the time from localTimestamp or format from createdAt
  const timeStr = brew.localTimestamp 
    ? (() => {
        // localTimestamp format: "Jan 26 at 10:10 AM"
        // Extract everything after "at "
        const match = brew.localTimestamp.match(/at (.+)$/);
        return match ? match[1] : brew.localTimestamp;
      })()
    : (() => {
        const date = new Date(brew.createdAt);
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
      })();
  
  const coffeeName = `${brew.roaster} - ${brew.coffeeName}`;
  const method = brew.method ? brew.method.toLowerCase() : 'coffee';
  
  // Check if there are multiple brews of same coffee AND method for this barista
  const sameBrews = await getBrewsForCoffeeAndMethodOnDate(
    brew.userId,
    brew.coffeeId,
    brew.method,
    brew.createdAt
  );
  
  let rankText = '';
  if (sameBrews.length > 1) {
    const rank = sameBrews.findIndex(b => b.id === brew.id) + 1;
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

// Add brew to notification queue with race condition protection
export async function addToNotificationQueue(userId: string, brewId: string): Promise<void> {
  // Simple retry mechanism to handle concurrent modifications
  let retries = 3;
  while (retries > 0) {
    try {
      const queue = await getNotificationQueue(userId);
      if (!queue.includes(brewId)) {
        queue.push(brewId);
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

// Remove brew from notification queue
export async function removeFromNotificationQueue(userId: string, brewId: string): Promise<void> {
  const queue = await getNotificationQueue(userId);
  const newQueue = queue.filter(id => id !== brewId);
  await kv.set(`notification_queue:${userId}`, newQueue);
}

// Get active notification for user
export async function getActiveNotification(userId: string): Promise<NotificationState | null> {
  const activeKeys = await kv.getByPrefix(`notification_active:${userId}:`);
  return activeKeys.length > 0 ? activeKeys[0] : null;
}

// Set active notification
export async function setActiveNotification(state: NotificationState): Promise<void> {
  await kv.set(`notification_active:${state.userId}:${state.brewId}`, state);
}

// Clear active notification
export async function clearActiveNotification(userId: string, brewId: string): Promise<void> {
  await kv.del(`notification_active:${userId}:${brewId}`);
}

// Map phone number to brew for response tracking
export async function setPendingResponse(phoneNumber: string, brewId: string): Promise<void> {
  await kv.set(`notification_pending:${phoneNumber}`, brewId);
}

// Get brew ID from phone number
export async function getPendingResponse(phoneNumber: string): Promise<string | null> {
  return await kv.get(`notification_pending:${phoneNumber}`);
}

// Clear pending response
export async function clearPendingResponse(phoneNumber: string): Promise<void> {
  await kv.del(`notification_pending:${phoneNumber}`);
}

// Set pending notes request
export async function setPendingNotes(phoneNumber: string, brewId: string): Promise<void> {
  await kv.set(`notification_pending_notes:${phoneNumber}`, brewId);
}

// Get brew ID for pending notes
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
    const brewId = await getPendingNotes(phoneNumber);
    
    if (!brewId) {
      return false;
    }

    const brew = await kv.get(`brew:${brewId}`);
    
    if (!brew) {
      await clearPendingNotes(phoneNumber);
      return false;
    }

    // Verify phone number belongs to brew owner
    const user = await kv.get(`user:${brew.userId}`);
    if (!user || user.phoneNumber !== phoneNumber) {
      console.log(`[SECURITY] Phone number ${phoneNumber} does not match brew owner ${brew.userId}`);
      await clearPendingNotes(phoneNumber);
      return false;
    }

    // Check if user wants to skip
    const skipKeywords = ['skip', 'no', 'none'];
    if (skipKeywords.includes(notes.trim().toLowerCase())) {
      await clearPendingNotes(phoneNumber);
      return true;
    }

    // Update brew with notes (append to existing notes if any)
    const existingNotes = brew.tastingNotes ? brew.tastingNotes.trim() : '';
    const newNotes = notes.trim();
    
    if (existingNotes) {
      brew.tastingNotes = `${existingNotes}, ${newNotes}`;
    } else {
      brew.tastingNotes = newNotes;
    }
    
    await kv.set(`brew:${brewId}`, brew);
    
    await clearPendingNotes(phoneNumber);

    return true;
  } catch (error) {
    console.error(`Error handling notes response:`, error);
    return false;
  }
}

// Start notification for a brew (add to queue/state, will be sent after 5 min delay)
export async function startNotification(brewId: string): Promise<void> {
  try {
    const brew = await kv.get(`brew:${brewId}`);
    if (!brew) {
      return;
    }

    // Check if already has a rating
    if (brew.quality) {
      return;
    }

    const user = await kv.get(`user:${brew.userId}`);
    if (!user) {
      return;
    }
    if (!user.phoneNumber) {
      return;
    }

    // Check if there's already an active notification for this user
    const activeNotification = await getActiveNotification(brew.userId);
    if (activeNotification) {
      // Add to queue instead
      await addToNotificationQueue(brew.userId, brewId);
      return;
    }

    // Set as active notification with messagesSent = 0 (no messages sent yet)
    // The cron job will send the first message after 5 minutes
    await setActiveNotification({
      brewId,
      userId: brew.userId,
      startTime: brew.createdAt, // Use brew creation time
      messagesSent: 0, // No messages sent yet
    });
  } catch (error) {
    console.error(`Error starting notification for brew ${brewId}:`, error);
  }
}

// Process reminder for active notification
export async function processReminder(userId: string, state: NotificationState): Promise<void> {
  try {
    const brew = await kv.get(`brew:${state.brewId}`);
    if (!brew) {
      await clearActiveNotification(userId, state.brewId);
      await processNextInQueue(userId);
      return;
    }

    // Check if rating was added
    if (brew.quality) {
      await clearActiveNotification(userId, state.brewId);
      
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
      await clearActiveNotification(userId, state.brewId);
      
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
      await clearActiveNotification(userId, state.brewId);
      await processNextInQueue(userId);
      return;
    }

    const isReminder = state.messagesSent > 0;
    const message = await buildBrewMessage(brew, isReminder);
    const sent = await sendSMS(user.phoneNumber, message);

    if (sent) {
      // Update message count
      state.messagesSent++;
      await setActiveNotification(state);
      
      // Set pending response if this is the first message
      if (state.messagesSent === 1) {
        await setPendingResponse(user.phoneNumber, state.brewId);
      }
    }
  } catch (error) {
    console.error(`Error processing reminder for brew ${state.brewId}:`, error);
  }
}

// Process next brew in queue
export async function processNextInQueue(userId: string): Promise<void> {
  try {
    const queue = await getNotificationQueue(userId);
    if (queue.length === 0) {
      return;
    }

    // Get first brew in queue
    const brewId = queue[0];
    await removeFromNotificationQueue(userId, brewId);

    const brew = await kv.get(`brew:${brewId}`);
    if (!brew) {
      // Skip this one, process next
      await processNextInQueue(userId);
      return;
    }

    // Check if already has a rating
    if (brew.quality) {
      // Skip this one, process next
      await processNextInQueue(userId);
      return;
    }

    const user = await kv.get(`user:${brew.userId}`);
    if (!user || !user.phoneNumber) {
      // Skip this one, process next
      await processNextInQueue(userId);
      return;
    }

    // Set as active notification with messagesSent = 0
    // The cron job will send the first message after 5 minutes from brew creation
    await setActiveNotification({
      brewId,
      userId: brew.userId,
      startTime: brew.createdAt, // Use brew creation time
      messagesSent: 0, // No messages sent yet
    });
  } catch (error) {
    console.error(`Error processing next in queue for user ${userId}:`, error);
  }
}

// Handle SMS response with rating
export async function handleRatingResponse(phoneNumber: string, rating: number): Promise<boolean> {
  try {
    const brewId = await getPendingResponse(phoneNumber);
    if (!brewId) {
      return false;
    }

    const brew = await kv.get(`brew:${brewId}`);
    if (!brew) {
      await clearPendingResponse(phoneNumber);
      return false;
    }

    // Verify phone number belongs to brew owner
    const user = await kv.get(`user:${brew.userId}`);
    if (!user || user.phoneNumber !== phoneNumber) {
      console.log(`[SECURITY] Phone number ${phoneNumber} does not match brew owner ${brew.userId}`);
      await clearPendingResponse(phoneNumber);
      return false;
    }

    // Update brew with rating
    brew.quality = rating;
    await kv.set(`brew:${brewId}`, brew);

    // Clear active notification (but keep pending response for notes)
    await clearActiveNotification(brew.userId, brewId);

    // Process next brew in queue
    await processNextInQueue(brew.userId);

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
      // Get the brew to access its timezone offset
      const brew = await kv.get(`brew:${state.brewId}`);
      
      if (!brew) {
        // If brew doesn't exist, clear the notification
        await clearActiveNotification(state.userId, state.brewId);
        const user = await kv.get(`user:${state.userId}`);
        if (user?.phoneNumber) {
          await clearPendingResponse(user.phoneNumber);
          await clearPendingNotes(user.phoneNumber);
        }
        continue;
      }
      
      // Use brew's timezone offset
      const timezoneOffset = brew.timezoneOffset;
      
      // Calculate "today" in the brew's timezone
      const nowInBrewTZ = new Date(Date.now() - (timezoneOffset * 60 * 1000));
      const todayInBrewTZ = nowInBrewTZ.toDateString();
      
      // Calculate the brew's creation date in its timezone
      const brewDate = new Date(new Date(state.startTime).getTime() - (timezoneOffset * 60 * 1000));
      const brewDay = brewDate.toDateString();
      
      // If notification is from a different day in that timezone, clear it
      if (brewDay !== todayInBrewTZ) {
        // Clear the active notification
        await clearActiveNotification(state.userId, state.brewId);
        
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
      
      // Filter out brews from previous days
      const todayQueue = [];
      for (const brewId of queue) {
        const brew = await kv.get(`brew:${brewId}`);
        if (brew) {
          // Use brew's timezone offset
          const timezoneOffset = brew.timezoneOffset;
          
          // Calculate "today" in the brew's timezone
          const nowInBrewTZ = new Date(Date.now() - (timezoneOffset * 60 * 1000));
          const todayInBrewTZ = nowInBrewTZ.toDateString();
          
          // Calculate the brew's creation date in its timezone
          const brewDate = new Date(new Date(brew.createdAt).getTime() - (timezoneOffset * 60 * 1000));
          const brewDay = brewDate.toDateString();
          
          if (brewDay === todayInBrewTZ) {
            todayQueue.push(brewId);
          }
        }
      }
      
      // Update queue with only today's brews
      if (todayQueue.length !== queue.length) {
        await kv.set(`notification_queue:${user.id}`, todayQueue);
      }
    }
  } catch (error) {
    console.error('Error clearing previous day notifications:', error);
  }
}