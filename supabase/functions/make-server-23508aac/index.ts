import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.ts';
import * as notifications from './notifications.ts';
import * as lamarzocco from './lamarzocco.ts';
import { formatBrewForPrompt, supportsStages } from './brewMethods.ts';
import { migrateExtractionToBrew, cleanupOldExtractions } from './migrate-extraction-to-brew.ts';

// Coffee brew tracking server
const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error in request:', err);
  try {
    return c.json({ error: 'Internal server error', details: err.message }, 500);
  } catch (responseError) {
    console.error('Error sending error response:', responseError);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Catch-all middleware to ensure all requests get a response
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    // Only log non-connection errors
    const errorMsg = String(error);
    if (!errorMsg.includes('connection') && !errorMsg.includes('closed')) {
      console.error('Middleware caught error:', error);
    }
    if (!c.res) {
      return c.json({ error: 'Request processing failed', details: errorMsg }, 500);
    }
  }
});

// Get Supabase URL - use the appropriate URL based on environment
const supabaseUrl = Deno.env.get('SUPABASE_URL') || `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.supabase.co`;

const supabase = createClient(
  supabaseUrl,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'x-client-info': 'supabase-edge-function'
      }
    }
  }
);

// Initialize storage bucket for coffee images
const initializeStorage = async () => {
  try {
    const bucketName = 'make-23508aac-coffee-images';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });
      if (error) {
        // Only log if it's not a "resource already exists" error
        if (!error.message?.includes('already exists')) {
          console.error('Error creating bucket:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
};

// Initialize storage on startup
initializeStorage();

// Helper to generate random household invite code
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Helper to get user's household members (including self)
const getHouseholdMemberIds = async (userId: string): Promise<string[]> => {
  const user = await kv.get(`user:${userId}`);
  if (!user?.householdId) {
    return [userId]; // Solo user, only their data
  }
  
  // Get all users in the same household
  const allUsers = await kv.getByPrefix('user:');
  const householdMembers = allUsers.filter(u => u.householdId === user.householdId);
  return householdMembers.map(u => u.id);
};

// Helper function to save image to storage
const saveImageToStorage = async (imageData: string, coffeeId: string): Promise<string | null> => {
  try {
    const bucketName = 'make-23508aac-coffee-images';
    
    // Extract base64 data from data URL
    const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('Invalid image data format');
      return null;
    }

    const base64Data = matches[2];
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Create filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const filename = `${coffeeId}-${timestamp}.jpg`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }
    
    // Get signed URL that expires in 10 years
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filename, 315360000); // 10 years in seconds
    
    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      return null;
    }
    
    return signedUrlData.signedUrl;
  } catch (error) {
    console.error('Error saving image to storage:', error);
    return null;
  }
};

// Helper function to get user from access token with retry logic
const getUser = async (accessToken: string | undefined, retries = 2) => {
  if (!accessToken) return null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);
      
      if (error) {
        // Only log significant errors, not expected auth failures
        if (!error.message?.includes('Invalid') && !error.message?.includes('expired') && error.status !== 401) {
          // Don't log on retry attempts
          if (attempt === retries) {
            console.log('Auth error after retries:', error.message);
          }
        }
        return null;
      }
      
      return user;
    } catch (error: any) {
      // Connection errors are transient - retry if we have attempts left
      const isTransientError = error.message?.includes('connection reset') || 
                               error.message?.includes('timeout') ||
                               error.message?.includes('connection error');
      
      if (isTransientError && attempt < retries) {
        // Wait briefly before retrying (exponential backoff: 100ms, 200ms)
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      // Log only on final attempt
      if (attempt === retries) {
        console.log('Connection error fetching user after retries:', error.message);
      }
      return null;
    }
  }
  
  return null;
};

// Sign up endpoint
app.post('/make-server-23508aac/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    // Create user with admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.error('Error creating auth user:', error);
      return c.text(`Failed to create user: ${error.message}`, 400);
    }

    // Create user record in KV store
    const userData = {
      id: data.user.id,
      email: data.user.email!,
      name: name || data.user.email!.split('@')[0],
      createdAt: new Date().toISOString(),
    };
    await kv.set(`user:${data.user.id}`, userData);

    return c.json({ message: 'User created successfully', user: userData });
  } catch (error) {
    console.error('Error in signup:', error);
    return c.text(`Signup failed: ${error}`, 500);
  }
});

// Users endpoints
app.get('/make-server-23508aac/users', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await getUser(accessToken);
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Get household member IDs
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    
    // Get all users and filter to only household members
    const allUsers = await kv.getByPrefix('user:');
    const householdUsers = allUsers.filter(u => householdMemberIds.includes(u.id));
    
    return c.json(householdUsers);
  } catch (error) {
    console.log('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

app.get('/make-server-23508aac/users/me', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await getUser(accessToken);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(userData);
  } catch (error) {
    console.log('Error fetching current user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

app.post('/make-server-23508aac/users', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await getUser(accessToken);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user already exists
    const existingUser = await kv.get(`user:${user.id}`);
    
    // Create or update user record with latest info from Google
    const userData = {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email!.split('@')[0],
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      // Preserve phoneNumber, smsConsent, householdId, and createdAt if they exist in the existing user data
      phoneNumber: existingUser?.phoneNumber || undefined,
      smsConsent: existingUser?.smsConsent || undefined,
      householdId: existingUser?.householdId || undefined,
      createdAt: existingUser?.createdAt || new Date().toISOString(),
    };
    
    await kv.set(`user:${user.id}`, userData);
    return c.json(userData);
  } catch (error) {
    console.log('Error creating/updating user:', error);
    return c.json({ error: 'Failed to create/update user' }, 500);
  }
});

// Update user phone number
app.put('/make-server-23508aac/users/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await getUser(accessToken);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    if (user.id !== id) {
      return c.json({ error: 'Forbidden - can only update own profile' }, 403);
    }

    const body = await c.req.json();
    const existing = await kv.get(`user:${id}`);
    if (!existing) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updated = { ...existing, ...body };
    await kv.set(`user:${id}`, updated);
    return c.json(updated);
  } catch (error) {
    console.log('Error updating user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Profile endpoints
app.get('/make-server-23508aac/profile/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const profile = await kv.get(`user:${userId}:profile`);
    return c.json(profile || {});
  } catch (error) {
    console.log('Error fetching profile:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

app.put('/make-server-23508aac/profile/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    // Save profile data
    await kv.set(`user:${userId}:profile`, body);
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error saving profile:', error);
    return c.json({ error: 'Failed to save profile' }, 500);
  }
});

// Household endpoints
app.post('/make-server-23508aac/households', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is already in a household
    const userData = await kv.get(`user:${user.id}`);
    if (userData?.householdId) {
      return c.json({ error: 'Already in a household' }, 400);
    }

    // Create household with unique invite code
    const householdId = crypto.randomUUID();
    let inviteCode = generateInviteCode();
    
    // Ensure invite code is unique
    let existingHousehold = await kv.get(`household:code:${inviteCode}`);
    while (existingHousehold) {
      inviteCode = generateInviteCode();
      existingHousehold = await kv.get(`household:code:${inviteCode}`);
    }
    
    const household = {
      id: householdId,
      inviteCode,
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`household:${householdId}`, household);
    await kv.set(`household:code:${inviteCode}`, householdId);
    
    // Add user to household
    const updatedUser = { ...userData, householdId };
    await kv.set(`user:${user.id}`, updatedUser);
    
    return c.json(household);
  } catch (error) {
    console.error('Error creating household:', error);
    return c.json({ error: 'Failed to create household' }, 500);
  }
});

app.post('/make-server-23508aac/households/join', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { inviteCode } = await c.req.json();
    
    if (!inviteCode) {
      return c.json({ error: 'Invite code required' }, 400);
    }

    // Check if user is already in a household
    const userData = await kv.get(`user:${user.id}`);
    if (userData?.householdId) {
      return c.json({ error: 'Already in a household' }, 400);
    }

    // Find household by invite code
    const householdId = await kv.get(`household:code:${inviteCode.toUpperCase()}`);
    if (!householdId) {
      return c.json({ error: 'Invalid invite code' }, 404);
    }

    const household = await kv.get(`household:${householdId}`);
    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }

    // Check household size limit
    const allUsers = await kv.getByPrefix('user:');
    const householdMembers = allUsers.filter(u => u.householdId === householdId);
    if (householdMembers.length >= 10) {
      return c.json({ error: 'Household is full (max 10 members)' }, 400);
    }

    // Add user to household
    const updatedUser = { ...userData, householdId };
    await kv.set(`user:${user.id}`, updatedUser);
    
    return c.json(household);
  } catch (error) {
    console.error('Error joining household:', error);
    return c.json({ error: 'Failed to join household' }, 500);
  }
});

app.get('/make-server-23508aac/households/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userData = await kv.get(`user:${user.id}`);
    
    if (!userData?.householdId) {
      return c.json({ household: null, members: [] });
    }

    const household = await kv.get(`household:${userData.householdId}`);
    
    // Get all household members
    const allUsers = await kv.getByPrefix('user:');
    const members = allUsers.filter(u => u.householdId === userData.householdId);
    
    return c.json({ household, members });
  } catch (error) {
    console.error('Error fetching household:', error);
    return c.json({ error: 'Failed to fetch household' }, 500);
  }
});

// Coffees endpoints
app.get('/make-server-23508aac/coffees', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    
    console.log('Fetching coffees - auth header present:', !!authHeader);
    
    const user = await getUser(accessToken);

    if (!user) {
      console.log('Coffees fetch failed: No user found');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('Fetching household members for user:', user.id);
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    console.log('Household member IDs:', householdMemberIds);
    
    console.log('Fetching coffees from KV store');
    const allCoffees = await kv.getByPrefix('coffee:');
    console.log('Total coffees found:', allCoffees.length);
    
    // Filter to coffees created by user or household members
    const visibleCoffees = allCoffees.filter(coffee => 
      coffee.createdByUserId && householdMemberIds.includes(coffee.createdByUserId)
    );
    
    console.log('Visible coffees for user:', visibleCoffees.length);
    return c.json(visibleCoffees);
  } catch (error) {
    console.error('Error fetching coffees - Full error:', error);
    console.error('Error stack:', error?.stack);
    return c.json({ error: 'Failed to fetch coffees', details: error?.message }, 500);
  }
});

app.post('/make-server-23508aac/coffees', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const id = crypto.randomUUID();
    
    // Handle multiple images upload if provided
    let imageUrls: string[] = [];
    if (body.imageData && Array.isArray(body.imageData)) {
      for (const imageData of body.imageData) {
        const imageUrl = await saveImageToStorage(imageData, id);
        if (imageUrl) {
          imageUrls.push(imageUrl);
        }
      }
      // Remove imageData from body as we don't want to store it in KV
      delete body.imageData;
    }
    
    const coffee = {
      id,
      ...body,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      createdByUserId: user.id,
      createdAt: new Date().toISOString()
    };
    await kv.set(`coffee:${id}`, coffee);
    return c.json(coffee);
  } catch (error) {
    console.log('Error creating coffee:', error);
    return c.json({ error: 'Failed to create coffee' }, 500);
  }
});

app.delete('/make-server-23508aac/coffees/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const existing = await kv.get(`coffee:${id}`);
    if (!existing) {
      return c.json({ error: 'Coffee not found' }, 404);
    }

    // Verify coffee belongs to user's household
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    if (!existing.createdByUserId || !householdMemberIds.includes(existing.createdByUserId)) {
      return c.json({ error: 'Forbidden - coffee does not belong to your household' }, 403);
    }

    await kv.del(`coffee:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting coffee:', error);
    return c.json({ error: 'Failed to delete coffee' }, 500);
  }
});

app.put('/make-server-23508aac/coffees/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await kv.get(`coffee:${id}`);
    if (!existing) {
      return c.json({ error: 'Coffee not found' }, 404);
    }

    // Verify coffee belongs to user's household
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    if (!existing.createdByUserId || !householdMemberIds.includes(existing.createdByUserId)) {
      return c.json({ error: 'Forbidden - coffee does not belong to your household' }, 403);
    }
    
    // Handle multiple images upload if provided
    let imageUrls = existing.imageUrls || []; // Keep existing images by default
    if (body.imageData && Array.isArray(body.imageData)) {
      imageUrls = [];
      for (const imageData of body.imageData) {
        const imageUrl = await saveImageToStorage(imageData, id);
        if (imageUrl) {
          imageUrls.push(imageUrl);
        }
      }
      // Remove imageData from body as we don't want to store it in KV
      delete body.imageData;
    }
    
    const updated = { ...existing, ...body, imageUrls: imageUrls.length > 0 ? imageUrls : undefined };
    await kv.set(`coffee:${id}`, updated);
    return c.json(updated);
  } catch (error) {
    console.log('Error updating coffee:', error);
    return c.json({ error: 'Failed to update coffee' }, 500);
  }
});

// Migration endpoint - run once to migrate extraction -> brew (SAFE: keeps old data)
app.post('/make-server-23508aac/migrate-extraction-to-brew', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`Migration initiated by user: ${user.id}`);
    const result = await migrateExtractionToBrew();
    
    return c.json(result);
  } catch (error) {
    console.log('Error running migration:', error);
    return c.json({ error: 'Migration failed', details: String(error) }, 500);
  }
});

// Cleanup endpoint - run after verifying migration worked (DESTRUCTIVE: deletes old extraction: keys)
app.post('/make-server-23508aac/cleanup-old-extractions', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`Cleanup initiated by user: ${user.id}`);
    const result = await cleanupOldExtractions();
    
    return c.json(result);
  } catch (error) {
    console.log('Error running cleanup:', error);
    return c.json({ error: 'Cleanup failed', details: String(error) }, 500);
  }
});

// Brews endpoints (formerly Extractions)
app.get('/make-server-23508aac/brews', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const householdMemberIds = await getHouseholdMemberIds(user.id);
    const allBrews = await kv.getByPrefix('brew:');
    
    // Filter to brews where userId (barista) is user or household member
    const visibleBrews = allBrews.filter(brew => 
      brew.userId && householdMemberIds.includes(brew.userId)
    );
    
    return c.json(visibleBrews);
  } catch (error) {
    console.log('Error fetching brews:', error);
    return c.json({ error: 'Failed to fetch brews' }, 500);
  }
});

app.get('/make-server-23508aac/brews/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const brew = await kv.get(`brew:${id}`);
    if (!brew) {
      return c.json({ error: 'Brew not found' }, 404);
    }

    // Verify brew belongs to user's household
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    if (!brew.userId || !householdMemberIds.includes(brew.userId)) {
      return c.json({ error: 'Forbidden - brew does not belong to your household' }, 403);
    }

    return c.json(brew);
  } catch (error) {
    console.log('Error fetching brew:', error);
    return c.json({ error: 'Failed to fetch brew' }, 500);
  }
});

app.post('/make-server-23508aac/brews', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await getUser(accessToken);
    if (!user) {
      return c.json({ error: 'Unauthorized - please sign in to create brews' }, 401);
    }

    const body = await c.req.json();
    const id = crypto.randomUUID();
    
    // Validate userId belongs to household (if provided)
    const requestedUserId = body.userId || user.id;
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    if (!householdMemberIds.includes(requestedUserId)) {
      return c.json({ error: 'Forbidden - userId must belong to your household' }, 403);
    }
    
    const brew = {
      id,
      ...body,
      userId: requestedUserId, // Ensure userId is set (defaults to logged-in user)
      createdAt: new Date().toISOString()
    };
    await kv.set(`brew:${id}`, brew);
    
    // Start SMS notification if brew has no rating
    if (!brew.quality) {
      // Don't await - let it run in background
      notifications.startNotification(id).catch((error) => {
        console.log('Error starting notification:', error);
      });
    }
    
    // Generate suggestions if brew has quality rating or notes AND it's the newest brew for this coffee
    if (brew.quality || brew.tastingNotes || brew.personalNotes) {
      // Check if this is the newest brew for the coffee (scoped to user/household)
      const brewUserId = brew.userId || user.id;
      isNewestBrewForCoffee(id, brew.coffeeId, brewUserId).then(isNewest => {
        if (!isNewest) {
          console.log(`[CREATE] Skipping suggestions for brew ${id} - not the newest brew for coffee ${brew.coffeeId} in household`);
          return;
        }
        
        // Don't await - let it run in background
        generateBrewSuggestions(id, brewUserId).then(suggestions => {
          if (suggestions) {
            // Update brew with both concise and full suggestions
            kv.get(`brew:${id}`).then(existing => {
              if (existing) {
                kv.set(`brew:${id}`, {
                  ...existing,
                  suggestion: {
                    concise: suggestions.concise,
                    full: suggestions.full
                  }
                });
              }
            }).catch(error => {
              console.log('Error updating brew with suggestions:', error);
            });
          }
        }).catch(error => {
          console.log('Error generating suggestions:', error);
        });
      }).catch(error => {
        console.log('Error checking if brew is newest:', error);
      });
    }
    
    return c.json(brew);
  } catch (error) {
    console.log('Error creating brew:', error);
    return c.json({ error: 'Failed to create brew' }, 500);
  }
});

app.put('/make-server-23508aac/brews/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await getUser(accessToken);
    if (!user) {
      return c.json({ error: 'Unauthorized - please sign in to update brews' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await kv.get(`brew:${id}`);
    if (!existing) {
      return c.json({ error: 'Brew not found' }, 404);
    }

    // Verify brew belongs to user's household
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    if (!existing.userId || !householdMemberIds.includes(existing.userId)) {
      return c.json({ error: 'Forbidden - brew does not belong to your household' }, 403);
    }

    const updated = { ...existing, ...body };
    await kv.set(`brew:${id}`, updated);
    
    // If rating was added via web UI, clean up notification state
    if (body.quality && !existing.quality) {
      console.log(`[UPDATE] Brew ${id} was rated via web UI, cleaning up notifications`);
      
      // Clear active notification if this brew is currently active
      const activeNotification = await notifications.getActiveNotification(existing.userId);
      if (activeNotification && activeNotification.brewId === id) {
        await notifications.clearActiveNotification(existing.userId, id);
        
        // Clear pending response
        const userData = await kv.get(`user:${existing.userId}`);
        if (userData?.phoneNumber) {
          await notifications.clearPendingResponse(userData.phoneNumber);
        }
        
        // Process next in queue
        await notifications.processNextInQueue(existing.userId);
      } else {
        // If it's in the queue (not active), remove it from queue
        await notifications.removeFromNotificationQueue(existing.userId, id);
      }
    }
    
    // Regenerate suggestions if quality rating or notes were added/changed
    const qualityChanged = body.quality !== undefined && body.quality !== existing.quality;
    const tastingNotesChanged = body.tastingNotes !== undefined && body.tastingNotes !== existing.tastingNotes;
    const personalNotesChanged = body.personalNotes !== undefined && body.personalNotes !== existing.personalNotes;
    
    if (qualityChanged || tastingNotesChanged || personalNotesChanged) {
      // Check if brew has quality or notes (after update)
      if (updated.quality || updated.tastingNotes || updated.personalNotes) {
        // Check if this is the newest brew for the coffee (scoped to user/household)
        const brewUserId = existing.userId || user.id;
        const coffeeId = existing.coffeeId || updated.coffeeId; // Use existing.coffeeId (shouldn't change)
        console.log(`[UPDATE] Checking if brew ${id} is newest for coffee ${coffeeId} (userId: ${brewUserId})`);
        isNewestBrewForCoffee(id, coffeeId, brewUserId).then(isNewest => {
          if (!isNewest) {
            console.log(`[UPDATE] Skipping suggestions for brew ${id} - not the newest brew for coffee ${coffeeId} in household`);
            return;
          }
          
          console.log(`[UPDATE] Generating suggestions for brew ${id} - it is the newest brew for coffee ${coffeeId}`);
          // Don't await - let it run in background
          generateBrewSuggestions(id, brewUserId).then(suggestions => {
            if (suggestions) {
              console.log(`[UPDATE] Successfully generated suggestions for brew ${id}`);
              // Update brew with both concise and full suggestions
              kv.get(`brew:${id}`).then(existing => {
                if (existing) {
                  kv.set(`brew:${id}`, {
                    ...existing,
                    suggestion: {
                      concise: suggestions.concise,
                      full: suggestions.full
                    }
                  });
                  console.log(`[UPDATE] Saved suggestions to brew ${id}`);
                }
              }).catch(error => {
                console.log('Error updating brew with suggestions:', error);
              });
            } else {
              console.log(`[UPDATE] No suggestions generated for brew ${id} (returned null)`);
              // If suggestions is null (no brew history), remove existing suggestion
              kv.get(`brew:${id}`).then(existing => {
                if (existing && existing.suggestion) {
                  const { suggestion, ...rest } = existing;
                  kv.set(`brew:${id}`, rest);
                }
              }).catch(error => {
                console.log('Error removing suggestion:', error);
              });
            }
          }).catch(error => {
            console.log('Error generating suggestions:', error);
          });
        }).catch(error => {
          console.log('Error checking if brew is newest:', error);
        });
      } else {
        // Both quality and notes were removed - clear suggestions
        kv.get(`brew:${id}`).then(existing => {
          if (existing && existing.suggestion) {
            const { suggestion, ...rest } = existing;
            kv.set(`brew:${id}`, rest);
            console.log(`[UPDATE] Removed suggestions for brew ${id} - quality and notes were removed`);
          }
        }).catch(error => {
          console.log('Error removing suggestion:', error);
        });
      }
    }
    
    return c.json(updated);
  } catch (error) {
    console.log('Error updating brew:', error);
    return c.json({ error: 'Failed to update brew' }, 500);
  }
});

app.delete('/make-server-23508aac/brews/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await getUser(accessToken);
    if (!user) {
      return c.json({ error: 'Unauthorized - please sign in to delete brews' }, 401);
    }

    const id = c.req.param('id');
    const existing = await kv.get(`brew:${id}`);
    if (!existing) {
      return c.json({ error: 'Brew not found' }, 404);
    }

    // Verify brew belongs to user's household
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    if (!existing.userId || !householdMemberIds.includes(existing.userId)) {
      return c.json({ error: 'Forbidden - brew does not belong to your household' }, 403);
    }
    
    // Clean up notification state before deleting brew
    console.log(`[DELETE] Brew ${id} deleted, cleaning up notifications`);
    
    // Check if this was the newest brew for its coffee (scoped to user/household)
    const brewUserId = existing.userId || user.id;
    const wasNewest = await isNewestBrewForCoffee(id, existing.coffeeId, brewUserId);
    
    // Clear active notification if this brew is currently active
    const activeNotification = await notifications.getActiveNotification(existing.userId);
    if (activeNotification && activeNotification.brewId === id) {
      await notifications.clearActiveNotification(existing.userId, id);
      
      // Clear pending response and notes
      const userData = await kv.get(`user:${existing.userId}`);
      if (userData?.phoneNumber) {
        await notifications.clearPendingResponse(userData.phoneNumber);
        await notifications.clearPendingNotes(userData.phoneNumber);
      }
      
      // Process next in queue
      await notifications.processNextInQueue(existing.userId);
    } else {
      // If it's in the queue (not active), remove it from queue
      await notifications.removeFromNotificationQueue(existing.userId, id);
    }
    
    await kv.del(`brew:${id}`);
    
    // If this was the newest brew, check if the new newest brew needs suggestions
    if (wasNewest) {
      getNewestBrewForCoffee(existing.coffeeId, brewUserId).then(newNewest => {
        if (newNewest && (newNewest.quality || newNewest.tastingNotes || newNewest.personalNotes) && !newNewest.suggestion) {
          console.log(`[DELETE] Generating suggestions for newly-newest brew ${newNewest.id} after deletion`);
          // Don't await - let it run in background
          generateBrewSuggestions(newNewest.id, brewUserId).then(suggestions => {
            if (suggestions) {
              // Update brew with both concise and full suggestions
              kv.get(`brew:${newNewest.id}`).then(existingBrew => {
                if (existingBrew) {
                  kv.set(`brew:${newNewest.id}`, {
                    ...existingBrew,
                    suggestion: {
                      concise: suggestions.concise,
                      full: suggestions.full
                    }
                  });
                }
              }).catch(error => {
                console.log('Error updating brew with suggestions:', error);
              });
            }
          }).catch(error => {
            console.log('Error generating suggestions:', error);
          });
        }
      }).catch(error => {
        console.log('Error getting new newest brew:', error);
      });
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting brew:', error);
    return c.json({ error: 'Failed to delete brew' }, 500);
  }
});

// Extract coffee bag details from image using OpenAI Vision API
app.post('/make-server-23508aac/extract-coffee-bag', async (c) => {
  try {
    const { images } = await c.req.json();
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return c.json({ error: 'No images provided' }, 400);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    // Prepare the messages with all images
    const imageContents = images.map((imageData: string) => ({
      type: 'image_url',
      image_url: {
        url: imageData,
      },
    }));

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Please analyze this coffee bag image(s) and extract the following details:
1. Roaster name (the company that roasted the coffee)
2. Coffee name/offering (the specific coffee product name)
3. Roast date (in YYYY-MM-DD format if available)
4. Region/Origin (e.g., "Ethiopia", "Colombia", "Kenya" - the country or region where the coffee was grown)
5. Tasting notes (e.g., "chocolate, caramel, nutty" or "bright citrus, floral, berry" - flavor descriptors on the bag)
6. Roast level (Light, Medium-Light, Medium, Medium-Dark, or Dark)

Return ONLY a JSON object in this exact format with no additional text:
{
  "roaster": "roaster name here",
  "name": "coffee offering name here",
  "roastDate": "YYYY-MM-DD or empty string if not found",
  "region": "region/origin or empty string if not found",
  "notes": "comma-separated tasting notes or empty string if not found",
  "roastLevel": "Light, Medium-Light, Medium, Medium-Dark, or Dark (empty string if not found)"
}

If you cannot find a specific field, use an empty string for that field.`,
                },
                ...imageContents,
              ],
            },
          ],
          max_completion_tokens: 500,
          temperature: 0.1,
        }),
      });
    } catch (fetchError) {
      console.error('Error fetching from OpenAI:', fetchError);
      return c.json({ error: 'Failed to connect to OpenAI API', details: String(fetchError) }, 500);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return c.json({ error: 'Failed to process image with OpenAI API', details: errorText }, 500);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return c.json({ error: 'No response from OpenAI' }, 500);
    }

    // Parse the JSON response
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      
      // Remove ```json and ``` markers
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*\n?/, '').replace(/\n?```\\s*$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\\s*\n?/, '').replace(/\n?```\\s*$/, '');
      }
      
      cleanContent = cleanContent.trim();
      
      const extracted = JSON.parse(cleanContent);
      
      // Ensure the response has the expected structure
      const result = {
        roaster: extracted.roaster || '',
        name: extracted.name || '',
        roastDate: extracted.roastDate || '',
        region: extracted.region || '',
        notes: extracted.notes || '',
        roastLevel: extracted.roastLevel || '',
      };
      
      return c.json(result);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return c.json({ 
        error: 'Failed to parse extracted data',
        details: content.substring(0, 200) // Return first 200 chars for debugging
      }, 500);
    }
  } catch (error) {
    console.error('Error extracting coffee bag details:', error);
    return c.json({ error: 'Failed to extract coffee bag details', details: String(error) }, 500);
  }
});

// AI lookup for coffee details (region, roast level, tasting notes)
app.post('/make-server-23508aac/lookup-coffee-details', async (c) => {
  try {
    const { roaster, coffeeName, field } = await c.req.json();
    
    if (!roaster || !coffeeName) {
      return c.json({ error: 'Roaster and coffee name are required' }, 400);
    }

    if (!field || !['region', 'roastLevel', 'tastingNotes'].includes(field)) {
      return c.json({ error: 'Valid field parameter required (region, roastLevel, or tastingNotes)' }, 400);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    let prompt = '';
    if (field === 'region') {
      prompt = `You are a helpful assistant that searches the web for accurate coffee information.

Your task:
1. Search the web for the coffee "${coffeeName}" by "${roaster}".
2. Identify the region/origin where this coffee was grown (the country or countries).

Source priority (use this exact order of trust):
1. The roaster's official website (e.g., their own domain).
2. The roaster's official social media (Instagram, Facebook, etc.).
3. Trusted coffee retailers selling this coffee.
4. Coffee review sites and forums.
5. Any other sources.

Rules for choosing the region:
- If the roaster's main product page for this coffee has region/origin information, ALWAYS use that as the source of truth, even if social media or other sites differ slightly.
- If there are multiple official descriptions from the roaster:
  - Prefer the product page on the roaster's own site over social media posts.
  - If multiple product pages disagree, choose the most recent page that clearly lists the origin.
- Only fall back to retailers or review sites if you cannot find any roaster-owned description.

Output format:
1. Return ONLY country names (e.g., "Ethiopia", "Colombia", "Kenya").
2. Do NOT include specific regions within countries (e.g., use "Ethiopia" NOT "Ethiopia, Yirgacheffe").
3. For blends with multiple origins: return country names as a comma-separated list (e.g., "Colombia, Ethiopia").
4. For single origin: return only the country name (e.g., "Ethiopia").
5. Use commas ONLY to separate multiple countries for blends.
6. If you cannot find any reliable region information after searching, use "UNKNOWN".

Think step by step:
- First, briefly explain (in 1–3 sentences) which URL you chose as the source of truth and why, referencing the source priority rules.
- Then, on a new line, write exactly:

JSON:
{
  "region": "country name(s) or UNKNOWN"
}

Do not include any other text after the JSON block.`;
    } else if (field === 'roastLevel') {
      prompt = `You are a helpful assistant that searches the web for accurate coffee information.

Your task:
1. Search the web for the coffee "${coffeeName}" by "${roaster}".
2. Identify the roast level for this specific coffee.

Source priority (use this exact order of trust):
1. The roaster's official website (e.g., their own domain).
2. The roaster's official social media (Instagram, Facebook, etc.).
3. Trusted coffee retailers selling this coffee.
4. Coffee review sites and forums.
5. Any other sources.

Rules for choosing the roast level:
- If the roaster's main product page for this coffee has roast level information, ALWAYS use that as the source of truth, even if social media or other sites differ slightly.
- If there are multiple official descriptions from the roaster:
  - Prefer the product page on the roaster's own site over social media posts.
  - If multiple product pages disagree, choose the most recent page that clearly lists the roast level.
- Only fall back to retailers or review sites if you cannot find any roaster-owned description.

Output format:
1. Return one of these standard roast levels: "Light", "Medium", "Dark", "Medium-Light", or "Medium-Dark".
2. If the roaster uses different terminology, map it to one of these standard levels.
3. If you cannot find any reliable roast level information after searching, use "UNKNOWN".

Think step by step:
- First, briefly explain (in 1–3 sentences) which URL you chose as the source of truth and why, referencing the source priority rules.
- Then, on a new line, write exactly:

JSON:
{
  "roastLevel": "Light, Medium, Dark, Medium-Light, Medium-Dark, or UNKNOWN"
}

Do not include any other text after the JSON block.`;
    } else if (field === 'tastingNotes') {
      prompt = `You are a helpful assistant that searches the web for accurate coffee information.

Your task:
1. Search the web for the coffee "${coffeeName}" by "${roaster}".
2. Identify tasting notes / flavor descriptors for this specific coffee.

Source priority (use this exact order of trust):
1. The roaster's official website (e.g., their own domain).
2. The roaster's official social media (Instagram, Facebook, etc.).
3. Trusted coffee retailers selling this coffee.
4. Coffee review sites and forums.
5. Any other sources.

Rules for choosing notes:
- If the roaster's main product page for this coffee has tasting notes, ALWAYS use those as the source of truth, even if social media or other sites differ slightly.
- If there are multiple official descriptions from the roaster:
  - Prefer the product page on the roaster's own site over social media posts.
  - If multiple product pages disagree, choose the most recent page that clearly lists notes.
- Only fall back to retailers or review sites if you cannot find any roaster-owned description.

Output format:
1. Extract a comma-separated list of 3–5 tasting notes from the chosen roaster-owned description.
2. Use the exact terms and capitalization from the roaster whenever possible.
3. If you cannot find any reliable tasting notes after searching, use "UNKNOWN".

Think step by step:
- First, briefly explain (in 1–3 sentences) which URL you chose as the source of truth and why, referencing the source priority rules.
- Then, on a new line, write exactly:

JSON:
{
  "notes": "comma-separated tasting notes or UNKNOWN"
}

Do not include any other text after the JSON block.`;
    }

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          input: [
            {
              role: 'system',
              content: 'You are a helpful assistant that searches for accurate coffee information. Always prioritize information from the roaster\'s official sources (website, Instagram, social media) as the source of truth before considering third-party sources like coffee review sites or retailers.'
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          tools: [{ type: "web_search" }],
        }),
      });
    } catch (fetchError) {
      console.error('Error fetching from OpenAI:', fetchError);
      return c.json({ error: 'Failed to connect to OpenAI API', details: String(fetchError) }, 500);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log('OpenAI API error:', errorText);
      return c.json({ error: 'Failed to lookup coffee details with OpenAI API', details: errorText }, 500);
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));
    
    // In the Responses API, content is in data.output array
    // Find the message type output item
    const messageOutput = data.output?.find((item: any) => item.type === 'message');
    const content = messageOutput?.content?.[0]?.text;

    if (!content) {
      console.log('No content in response. Full data:', JSON.stringify(data, null, 2));
      return c.json({ error: 'No response from OpenAI', details: JSON.stringify(data) }, 500);
    }

    // Parse the JSON response
    try {
      // Look for "JSON:" marker and extract everything after it
      let cleanContent = content.trim();
      
      // Check if response contains "JSON:" marker (case-insensitive)
      const jsonMarkerIndex = cleanContent.search(/JSON:\s*/i);
      if (jsonMarkerIndex !== -1) {
        // Extract everything after "JSON:"
        cleanContent = cleanContent.substring(jsonMarkerIndex + 5).trim(); // 5 = length of "JSON:"
      }
      
      // Check if response contains markdown code block with JSON (```json or ```JSON)
      const codeBlockMatch = cleanContent.match(/```json\s*\n([\s\S]*?)\n```/i);
      if (codeBlockMatch) {
        // Extract the content between the code block markers
        cleanContent = codeBlockMatch[1].trim();
      } else {
        // Try to remove markdown code blocks if present (case-insensitive)
        cleanContent = cleanContent.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      }
      
      cleanContent = cleanContent.trim();
      
      const extracted = JSON.parse(cleanContent);
      
      // Process the response and convert UNKNOWN to null
      let result: any = {};
      
      if (field === 'region') {
        result.region = extracted.region === 'UNKNOWN' ? null : (extracted.region || null);
      } else if (field === 'roastLevel') {
        result.roastLevel = extracted.roastLevel === 'UNKNOWN' ? null : (extracted.roastLevel || null);
      } else if (field === 'tastingNotes') {
        result.notes = extracted.notes === 'UNKNOWN' ? null : (extracted.notes || null);
      }
      
      return c.json(result);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return c.json({ 
        error: 'Failed to parse lookup data',
        details: content.substring(0, 200) // Return first 200 chars for debugging
      }, 500);
    }
  } catch (error) {
    console.error('Error in lookup-coffee-details:', error);
    return c.json({ error: 'Failed to lookup coffee details', details: String(error) }, 500);
  }
});

// Twilio SMS webhook for receiving rating responses
app.post('/make-server-23508aac/sms-webhook', async (c) => {
  try {
    // Validate Twilio signature
    const twilioSignature = c.req.header('X-Twilio-Signature');
    const url = new URL(c.req.url);
    const fullUrl = url.toString();
    
    const body = await c.req.text();
    
    // Parse params once
    const params = new URLSearchParams(body);
    
    // Skip signature validation if coming through proxy (has Authorization header with anon key)
    const authHeader = c.req.header('Authorization');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const isFromProxy = authHeader === `Bearer ${anonKey}`;
    
    if (!isFromProxy) {
      // Validate signature
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      if (!authToken) {
        console.error('TWILIO_AUTH_TOKEN not configured');
        return c.text('Server configuration error', 500);
      }
      
      // Compute the expected signature
      const paramsObject: Record<string, string> = {};
      for (const [key, value] of params.entries()) {
        paramsObject[key] = value;
      }
      
      // Create the signature data string
      let data = fullUrl;
      const sortedKeys = Object.keys(paramsObject).sort();
      for (const key of sortedKeys) {
        data += key + paramsObject[key];
      }
      
      // Compute HMAC-SHA1
      const encoder = new TextEncoder();
      const keyData = encoder.encode(authToken);
      const messageData = encoder.encode(data);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
      
      if (twilioSignature !== expectedSignature) {
        console.error('Invalid Twilio signature');
        return c.text('Forbidden', 403);
      }
    }
    
    const from = params.get('From');
    const messageBody = params.get('Body');
    
    if (!from || !messageBody) {
      return c.text('Missing parameters', 400);
    }
    
    // Check if this is a notes response first
    const hasPendingNotes = await notifications.getPendingNotes(from);
    
    if (hasPendingNotes) {
      // Handle notes response
      const success = await notifications.handleNotesResponse(from, messageBody);
      
      if (success) {
        // Clear the pending response now that notes are done
        await notifications.clearPendingResponse(from);
        
        // Check if user skipped
        const skipKeywords = ['skip', 'no', 'none'];
        if (skipKeywords.includes(messageBody.trim().toLowerCase())) {
          await notifications.sendSMS(from, 'Got it! Brew saved.');
        } else {
          await notifications.sendSMS(from, 'Notes added!');
        }
      }
      
      return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, {
        'Content-Type': 'text/xml',
      });
    }
    
    // Check if user wants to skip the rating request
    const skipKeywords = ['skip', 'no', 'none'];
    if (skipKeywords.includes(messageBody.trim().toLowerCase())) {
      const hasPendingRating = await notifications.getPendingResponse(from);
      
      if (hasPendingRating) {
        // Get the brew to clear all notification state
        const brewId = hasPendingRating;
        const brew = await kv.get(`brew:${brewId}`);
        
        if (brew) {
          // Clear all notification state for this brew
          await notifications.clearActiveNotification(brew.userId, brewId);
          await notifications.clearPendingResponse(from);
          
          // Send acknowledgment
          await notifications.sendSMS(from, 'Got it! Rating skipped.');
          
          // Process next brew in queue
          await notifications.processNextInQueue(brew.userId);
        }
      }
      
      return c.text('<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>', 200, {
        'Content-Type': 'text/xml',
      });
    }
    
    // Parse rating (1, 2, or 3)
    const rating = parseInt(messageBody.trim());
    
    if (![1, 2, 3].includes(rating)) {
      // Check if there's actually a pending response before sending error
      const hasPendingRating = await notifications.getPendingResponse(from);
      
      if (!hasPendingRating) {
        // No notifications in queue - friendly message
        await notifications.sendSMS(
          from,
          "You don't have any pending rating requests right now. Check back after your next brew."
        );
      } else {
        // Has pending rating but invalid format
        await notifications.sendSMS(
          from,
          'Please reply with 1 (Bad), 2 (Decent), or 3 (Exceptional) to rate your brew, or SKIP to skip.'
        );
      }
      return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, {
        'Content-Type': 'text/xml',
      });
    }
    
    // Handle rating response
    const success = await notifications.handleRatingResponse(from, rating);
    
    if (success) {
      const ratingText = rating === 1 ? 'Bad' : rating === 2 ? 'Decent' : 'Exceptional';
      
      // Get brew to include method in confirmation
      const brewId = await notifications.getPendingResponse(from);
      if (brewId) {
        const brew = await kv.get(`brew:${brewId}`);
        const method = brew?.brewMethod ? brew.brewMethod.toLowerCase() : 'brew';
        await notifications.sendSMS(from, `Thanks! Your ${method} was rated ${ratingText}.`);
        
        // Ask for notes with suggestions based on rating
        await notifications.setPendingNotes(from, brewId);
        const notesMessage = notifications.buildNotesRequestMessage(rating);
        await notifications.sendSMS(from, notesMessage);
      } else {
        // Fallback if we can't get brew
        await notifications.sendSMS(from, `Thanks! Your brew was rated ${ratingText}.`);
      }
    } else {
      // Rating was valid format but no pending response found
      await notifications.sendSMS(
        from,
        "You don't have any pending rating requests right now. Check back after your next brew."
      );
    }
    
    // Return TwiML response
    return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, {
      'Content-Type': 'text/xml',
    });
  } catch (error) {
    console.error('Error in SMS webhook:', error);
    return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, {
      'Content-Type': 'text/xml',
    });
  }
});

// Cron endpoint to check for reminders (call this every minute or use Deno.cron)
app.get('/make-server-23508aac/check-reminders', async (c) => {
  try {
    // Don't await - run in background to avoid timeout
    notifications.checkReminders().catch((error) => {
      console.error('Background error checking reminders:', error);
    });
    
    // Return immediately
    return c.json({ success: true, message: 'Reminder check initiated' });
  } catch (error) {
    console.error('Error initiating reminder check:', error);
    return c.json({ error: 'Failed to initiate reminder check', details: String(error) }, 500);
  }
});

// DEBUG: Clear all active notifications and queues
app.post('/make-server-23508aac/debug/clear-notifications', async (c) => {
  try {
    console.log('[DEBUG] Clearing all active notifications and queues...');
    
    // Clear all active notifications
    const activeNotifications = await kv.getByPrefix('notification_active:');
    for (const notification of activeNotifications) {
      await kv.del(`notification_active:${notification.userId}:${notification.extractionId}`);
    }
    console.log(`[DEBUG] Cleared ${activeNotifications.length} active notifications`);
    
    // Clear all notification queues
    const queues = await kv.getByPrefix('notification_queue:');
    for (const queueEntry of queues) {
      // queueEntry is the actual data (array), need to extract userId from the key
      const allKeys = await kv.getByPrefix('notification_queue:');
      for (const key of Object.keys(allKeys)) {
        await kv.del(key);
      }
    }
    console.log(`[DEBUG] Cleared notification queues`);
    
    // Clear all pending responses
    const pendingKeys = await kv.getByPrefix('notification_pending:');
    for (const key of Object.keys(pendingKeys)) {
      await kv.del(key);
    }
    console.log(`[DEBUG] Cleared pending responses`);
    
    // Clear all pending notes
    const pendingNotesKeys = await kv.getByPrefix('notification_pending_notes:');
    for (const key of Object.keys(pendingNotesKeys)) {
      await kv.del(key);
    }
    console.log(`[DEBUG] Cleared pending notes`);
    
    return c.json({ 
      success: true, 
      message: 'All notification states cleared'
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return c.json({ error: 'Failed to clear notifications', details: String(error) }, 500);
  }
});

// Clear SMS queue for a specific user (authenticated endpoint)
app.post('/make-server-23508aac/users/clear-sms-queue', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`[CLEAR SMS QUEUE] Clearing SMS queue for user ${user.id}`);

    // Get user's phone number
    const userData = await kv.get(`user:${user.id}`);
    
    // Clear active notification for this user
    const activeNotifications = await kv.getByPrefix(`notification_active:${user.id}:`);
    for (const notification of activeNotifications) {
      await kv.del(`notification_active:${user.id}:${notification.extractionId}`);
    }
    
    // Clear notification queue for this user
    await kv.del(`notification_queue:${user.id}`);
    
    // Clear pending responses for this user's phone number
    if (userData?.phoneNumber) {
      await kv.del(`notification_pending:${userData.phoneNumber}`);
      await kv.del(`notification_pending_notes:${userData.phoneNumber}`);
    }
    
    console.log(`[CLEAR SMS QUEUE] Cleared ${activeNotifications.length} active notifications and queue for user ${user.id}`);
    
    return c.json({ 
      success: true, 
      message: 'SMS queue cleared successfully',
      cleared: {
        activeNotifications: activeNotifications.length,
        queueCleared: true
      }
    });
  } catch (error) {
    console.error('[CLEAR SMS QUEUE] Error:', error);
    return c.json({ error: 'Failed to clear SMS queue', details: String(error) }, 500);
  }
});

// Generate coffee bag representative image using Gemini
app.post('/make-server-23508aac/generate-coffee-bag-image', async (c) => {
  try {
    const { roaster, coffeeName, region, notes, roastLevel, referenceImage, customPrompt } = await c.req.json();
    
    if (!roaster || !coffeeName) {
      return c.json({ error: 'Roaster and coffee name required' }, 400);
    }

    if (!referenceImage) {
      return c.json({ error: 'Reference image required' }, 400);
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      return c.json({ error: 'Google API key not configured' }, 500);
    }

    // Build detailed description for image generation with white background
    let prompt = `Create a clean modern 3D studio product render of the coffee bag shown in the reference image. Preserve the exact layout, logo placement, typography hierarchy, and major artwork shapes from the reference, but simplify fine textures and micro-details. Text policy: The reference image may have incomplete, partially visible, or misspelled text for the roaster/brand name and coffee name. Use the provided names as strong hints: Roaster is "${roaster}" and Coffee name is "${coffeeName}". Keep only text that matches or closely resembles these names, even if partially visible or slightly misspelled on the bag. Use your judgment to identify which text on the bag corresponds to the roaster name and which to the coffee name based on these hints. Remove all other text including region, origin, tasting notes, weight, dates, brewing instructions, and any other descriptive text. Keep the preserved text placement, alignment, and spatial relationships identical to the reference. Rendering style: high-quality 3D product render with subtle material depth, soft natural studio lighting, crisp edges, smooth surfaces, minimal wrinkles, no grain, no noise, no dirt, no scratches, no photoreal texture. The coffee bag should look fresh, brand new, and pristine - not used or wrinkled. The bag should appear as if it just came from the factory with perfect condition and no wear. The coffee bag colors must look natural and normal. Shadow: Add a soft, realistic contact shadow directly beneath the base of the bag. Crucially, this shadow must be perfectly centered and symmetrical, extending equally on both the left and right sides of the bag to create a balanced, professional product showcase aesthetic on the white background. Scale + framing: The bag must fit within a virtual container of 920x920 pixels (centered within a 1024x1024 canvas). Scale the bag proportionally until it touches either the width OR height boundary of this container, whichever comes first. Then center it perfectly on the white 1024x1024 canvas. Camera must be fixed and consistent: front-facing, centered, no tilt, no rotation, symmetrical, presented like a premium ecommerce product hero shot. Use #FFFFFF hex code for the background.`;

    // Append custom prompt if provided
    if (customPrompt && customPrompt.trim()) {
      prompt += ` Additional instructions: ${customPrompt.trim()}`;
    }

    console.log('Generating coffee bag image with white background');

    // Convert base64 reference image data
    const base64Data = referenceImage.replace(/^data:image\/[a-z]+;base64,/, '');

    // Generate image
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Image Generation API error:', errorText);
      return c.json({ error: 'Failed to generate image', details: errorText }, 500);
    }

    const data = await response.json();
    
    let b64Image: string | null = null;
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        b64Image = part.inlineData.data;
        break;
      }
    }
    
    if (!b64Image) {
      console.error('No image in response');
      return c.json({ error: 'No image generated' }, 500);
    }

    // Detect mime type from the base64 data
    const mimeType = b64Image.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
    
    return c.json({ imageUrl: `data:${mimeType};base64,${b64Image}` });
  } catch (error) {
    console.error('Error generating coffee bag image:', error);
    return c.json({ error: 'Failed to generate coffee bag image', details: String(error) }, 500);
  }
});

// Get representative coffee image
app.get('/make-server-23508aac/coffee-representative-image', async (c) => {
  try {
    const roaster = c.req.query('roaster');
    const coffeeName = c.req.query('coffeeName');
    
    if (!roaster || !coffeeName) {
      return c.json({ imageUrl: null });
    }

    const key = `representative-image:${roaster}|${coffeeName}`;
    
    // Add timeout to KV store operation with proper cleanup
    let timeoutId: number;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('KV timeout')), 3000);
    });
    
    let imageUrl = null;
    try {
      imageUrl = await Promise.race([
        kv.get(key),
        timeoutPromise
      ]);
      clearTimeout(timeoutId!);
    } catch (kvError) {
      clearTimeout(timeoutId!);
      console.error('KV store error fetching representative image:', kvError);
      // Return null if KV store fails - don't throw
      imageUrl = null;
    }
    
    return c.json({ imageUrl: imageUrl || null });
  } catch (error) {
    console.error('Error fetching representative image:', error);
    return c.json({ imageUrl: null });
  }
});

// Save representative coffee image
app.post('/make-server-23508aac/coffee-representative-image', async (c) => {
  try {
    const { roaster, coffeeName, imageUrl } = await c.req.json();
    
    if (!roaster || !coffeeName || !imageUrl) {
      return c.json({ error: 'Roaster, coffee name, and image URL required' }, 400);
    }

    const key = `representative-image:${roaster}|${coffeeName}`;
    
    try {
      await kv.set(key, imageUrl);
    } catch (kvError) {
      console.error('KV store error saving representative image:', kvError);
      return c.json({ error: 'Failed to save to database' }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error saving representative image:', error);
    return c.json({ error: 'Failed to save representative image' }, 500);
  }
});

// Helper function to check if a brew is the newest for its coffee (scoped to user/household)
async function isNewestBrewForCoffee(brewId: string, coffeeId: string, userId: string): Promise<boolean> {
  const householdMemberIds = await getHouseholdMemberIds(userId);
  const allBrews = await kv.getByPrefix('brew:');
  const coffeeBrews = allBrews.filter((b: any) => 
    b.coffeeId === coffeeId && 
    b.userId && 
    householdMemberIds.includes(b.userId)
  );
  
  console.log(`[isNewestBrewForCoffee] Checking brew ${brewId} for coffee ${coffeeId}, found ${coffeeBrews.length} matching brews in household`);
  
  if (coffeeBrews.length === 0) {
    console.log(`[isNewestBrewForCoffee] No brews found for coffee ${coffeeId} in household`);
    return false;
  }
  
  // Sort by date (most recent first)
  coffeeBrews.sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  const newestBrewId = coffeeBrews[0].id;
  const isNewest = newestBrewId === brewId;
  console.log(`[isNewestBrewForCoffee] Newest brew is ${newestBrewId}, checking brew ${brewId}: ${isNewest}`);
  
  // Check if this brew is the most recent
  return isNewest;
}

// Helper function to get the newest brew for a coffee (scoped to user/household)
async function getNewestBrewForCoffee(coffeeId: string, userId: string): Promise<any | null> {
  const householdMemberIds = await getHouseholdMemberIds(userId);
  const allBrews = await kv.getByPrefix('brew:');
  const coffeeBrews = allBrews.filter((b: any) => 
    b.coffeeId === coffeeId && 
    b.userId && 
    householdMemberIds.includes(b.userId)
  );
  
  if (coffeeBrews.length === 0) return null;
  
  // Sort by date (most recent first)
  coffeeBrews.sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return coffeeBrews[0];
}

// Generate brew suggestions in background (both concise and full formats)
async function generateBrewSuggestions(brewId: string, userId: string): Promise<{ concise: { goal: string; action: string; confidence: 'High' | 'Medium' | 'Low' }; full: { summary: string; primaryIssue: string; suggestions: any[] } } | null> {
  try {
    // Fetch the baseline brew (the one that triggered the job)
    const baselineBrew = await kv.get(`brew:${brewId}`);
    if (!baselineBrew) {
      console.log(`[generateBrewSuggestions] Brew ${brewId} not found`);
      return null;
    }

    // Fetch coffee data
    const coffee = await kv.get(`coffee:${baselineBrew.coffeeId}`);
    if (!coffee) {
      console.log(`[generateBrewSuggestions] Coffee ${baselineBrew.coffeeId} not found`);
      return null;
    }

    // Fetch all brews for the same coffee and brew method (scoped to user/household)
    const householdMemberIds = await getHouseholdMemberIds(userId);
    const allBrews = await kv.getByPrefix('brew:');
    const matchingBrews = allBrews.filter((b: any) => 
      b.coffeeId === baselineBrew.coffeeId && 
      b.brewMethod === baselineBrew.brewMethod &&
      b.userId &&
      householdMemberIds.includes(b.userId)
    );

    // Allow suggestions even with just the baseline brew
    // The AI can provide useful suggestions based on brew parameters and coffee characteristics

    // Sort by date (most recent first)
    matchingBrews.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Select brew history: top 10 most recent + baseline brew + exceptional brew
    const top10Recent = matchingBrews.slice(0, 10);
    const top10Ids = new Set(top10Recent.map((b: any) => b.id));
    
    // Find exceptional brew (most recent with quality === 3)
    const exceptionalBrew = matchingBrews.find((b: any) => b.quality === 3);
    
    // Build brew list to include
    let brewsToInclude = [...top10Recent];
    
    // Add baseline brew if not already in top 10
    if (!top10Ids.has(brewId)) {
      brewsToInclude.push(baselineBrew);
    }
    
    // Add exceptional brew if not already included
    if (exceptionalBrew && !brewsToInclude.find((b: any) => b.id === exceptionalBrew.id)) {
      brewsToInclude.push(exceptionalBrew);
    }
    
    // Re-sort chronologically (most recent first)
    brewsToInclude.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Mark baseline and exceptional brews
    const brewsWithTags = brewsToInclude.map((b: any) => ({
      ...b,
      isBaseline: b.id === brewId,
      isExceptional: exceptionalBrew && b.id === exceptionalBrew.id
    }));

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('[generateBrewSuggestions] OpenAI API key not configured');
      return null;
    }

    // Helper functions
    const getQualityLabel = (quality: number | undefined) => {
      if (!quality) return 'Not rated';
      return quality === 1 ? 'Bad' : quality === 2 ? 'Decent' : 'Excellent';
    };

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Build base prompt parts (shared between both formats)
    const coffeeInfo = `COFFEE:
- Name: ${coffee.name}
- Roaster: ${coffee.roaster}
- Brew Method: ${baselineBrew.brewMethod}${coffee.region ? `\n- Region: ${coffee.region}` : ''}${coffee.roastLevel ? `\n- Roast Level: ${coffee.roastLevel}` : ''}${coffee.notes ? `\n- Flavor Notes: ${coffee.notes}` : ''}`;

    let brewHistoryText = `BREW HISTORY (Most recent to oldest):
`;
    
    brewsWithTags.forEach((brew: any, idx: number) => {
      const brewNum = idx + 1;
      const isTarget = brew.isBaseline;
      const isExceptional = brew.isExceptional;
      
      let qualifiers = '';
      if (isTarget && isExceptional) {
        qualifiers = ' ⭐ REFERENCE BREW, 🏆 BEST RECORDED BREW';
      } else if (isTarget) {
        qualifiers = ' ⭐ REFERENCE BREW';
      } else if (isExceptional) {
        qualifiers = ' 🏆 BEST RECORDED BREW';
      }
      
      brewHistoryText += `
BREW #${brewNum} (${formatDate(brew.createdAt)})${qualifiers}:
- Brewer: ${brew.brewerName || 'Not specified'}
- Grinder: ${brew.grinderName || 'Not specified'}
- Bean Temperature: ${brew.coffeeTemperature === 'frozen' ? 'Frozen' : 'Room Temperature'}
- Grind Setting: ${brew.grindSetting}
- Dosage: ${brew.dosage}g
- Water Temperature: ${brew.waterTemp ? `${brew.waterTemp}°F` : 'Not recorded'}`;

      brewHistoryText += formatBrewForPrompt(brew, baselineBrew.brewMethod);

      brewHistoryText += `
- Quality Rating: ${getQualityLabel(brew.quality)}${brew.tastingNotes ? `
- Tasting Notes: ${brew.tastingNotes}` : ''}${(brew.personalNotes || (brew as any).notes) ? `
- Extraction Notes: ${brew.personalNotes || (brew as any).notes}` : ''}
`;
    });

    const considerations = `
IMPORTANT CONSIDERATIONS:
1. Focus on the REFERENCE BREW (marked with ⭐): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried and avoid suggesting the same adjustments that were already attempted.
2. Grinder Direction: Different grinders have different scales. Some use lower numbers for finer grinds (e.g., Niche Zero, Fellow Ode), while others use higher numbers for finer grinds. Ensure your suggestion moves in the correct direction for the specific grinder being used.
3. Grinder Sensitivity: Pay attention to how sensitive the grinder's adjustments are. Stepless grinders like the Niche Zero are highly sensitive (0.5 adjustments matter), while stepped grinders may need larger adjustments (2-3 steps).
4. Equipment Context: Consider the brewer and grinder being used when making suggestions. Different equipment has different characteristics and optimal parameters.
5. Avoid Repetition: Review the previous brews to ensure you're not suggesting something that was already tried. If a previous brew tried a parameter change and it didn't improve things, suggest a different approach.
6. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
7. Baseline Brew Terminology: When referring to the REFERENCE BREW (marked with ⭐) in your summary or suggestions, always use the term "baseline brew" instead of "most recent brew" or "best brew". This brew is the starting point for improvement suggestions.
8. Do not infer causes that are not supported by recorded data.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless history strongly suggests otherwise):
   - Grind / flow behavior
   - Final weight / ratio
   - Water temperature
   - Dose
   - If flow issues indicate puck preparation or channeling, address distribution, tamping, or pre-infusion before changing core parameters.

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact (example: "should reduce sourness and increase body").

C) Confidence score:
   - Every suggestion must include a confidence score: High / Medium / Low.
   - Confidence should reflect how strongly the brew history supports the change (e.g., repeated evidence vs weak signal).
   - Use "High" only when supported by at least two prior brews or a direct comparison.

D) Primary failure mode:
   - Before listing suggestions, identify exactly ONE primary failure mode for the selected brew (e.g., "under-extracted due to fast flow" or "over-extracted due to excessive yield").
   - All suggestions must directly address this failure mode.

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer suggestions rather than forcing additional ones.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful changes.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.

F) Learning from excellent brews:
   - If the history contains an excellent brew, it is acceptable to recommend reverting one or more parameters back toward that setup, with reasoning.
   - Reverting to a previously successful setting is not considered repetition.
   - When referring to it, use descriptive language like "an earlier excellent brew" without mentioning brew numbers.

G) Prefer minimal changes:
   - When suggesting adjustments, prefer the smallest reasonable change that could plausibly fix the issue.
   - Avoid large jumps unless history clearly shows they are necessary.

H) Stability check:
   - If a parameter appears optimal based on excellent brews, explicitly state that it should remain unchanged.`;

    // Build concise format prompt
    const concisePrompt = `You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.

${coffeeInfo}

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

${brewHistoryText}
${considerations}

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "goal": "2-3 words describing the primary goal (e.g., 'Reduce sourness', 'Increase body', 'Fix channeling')",
  "action": "2-4 words describing the action (e.g., 'Grind finer', 'Increase temperature', 'Reduce final weight')",
  "confidence": "High" | "Medium" | "Low"
}

CRITICAL REQUIREMENTS:
- Goal must be exactly 2-3 words - no complete sentences, no explanations
- Action must be exactly 2-4 words - no complete sentences, no explanations
- Prioritize the MOST IMPORTANT goal/action based on the baseline brew analysis
- Goal and action must be based on improving the baseline brew (marked with ⭐ REFERENCE BREW) specifically
- Identify the single most impactful change that addresses the primary failure mode of the baseline brew
- Confidence should reflect how strongly the brew history supports this specific change`;

    // Build full format prompt (same as existing endpoint)
    const fullPrompt = `You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.

${coffeeInfo}

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

${brewHistoryText}
${considerations}

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "summary": "Brief diagnostic summary (1-2 sentences). State the outcome (quality rating and key tasting notes) and what was missing or wrong. Avoid hedging language like 'likely', 'suggests', 'step in the right direction'. Collapse cause and effect into one sentence.",
  "primaryIssue": "The primary failure mode (e.g., 'under-extracted due to fast flow' or 'over-extracted due to excessive yield')",
  "suggestions": [
    {
      "parameter": "Parameter name",
      "action": "Action with specific magnitude (no period at end)",
      "effect": "Expected taste/texture effect as a complete sentence starting with 'This will' or 'This should' (no period at end)",
      "reasoning": "Concise explanation (1 sentence) of why this works based on brew history. Do NOT reference brew numbers (no period at end)",
      "confidence": "High" | "Medium" | "Low"
    }
  ]
}

REQUIREMENTS:
- You must provide at least 1 suggestion and at most 3 suggestions
- Each suggestion must follow the structure: Action → Expected effect → Why it matters (based on history)
- Only include high-quality, non-redundant suggestions`;

    // Call OpenAI API for both formats
    const [conciseResponse, fullResponse] = await Promise.all([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [
            { role: 'system', content: 'You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.' },
            { role: 'user', content: concisePrompt }
          ],
          temperature: 0.2,
          max_completion_tokens: 200,
          response_format: { type: 'json_object' }
        }),
      }),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [
            { role: 'system', content: 'You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.' },
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.2,
          max_completion_tokens: 1000,
          response_format: { type: 'json_object' }
        }),
      })
    ]);

    if (!conciseResponse.ok || !fullResponse.ok) {
      console.error('[generateBrewSuggestions] OpenAI API error', {
        concise: conciseResponse.status,
        full: fullResponse.status
      });
      return null;
    }

    const conciseData = await conciseResponse.json();
    const fullData = await fullResponse.json();

    const conciseContent = conciseData.choices?.[0]?.message?.content;
    const fullContent = fullData.choices?.[0]?.message?.content;

    if (!conciseContent || !fullContent) {
      console.error('[generateBrewSuggestions] No content in OpenAI response');
      return null;
    }

    try {
      const concise = JSON.parse(conciseContent);
      const full = JSON.parse(fullContent);

      // Validate concise format
      if (!concise.goal || !concise.action || !concise.confidence) {
        console.error('[generateBrewSuggestions] Invalid concise format', concise);
        return null;
      }

      // Validate full format
      if (!full.summary || !full.primaryIssue || !Array.isArray(full.suggestions)) {
        console.error('[generateBrewSuggestions] Invalid full format', full);
        return null;
      }

      return {
        concise: {
          goal: concise.goal,
          action: concise.action,
          confidence: concise.confidence as 'High' | 'Medium' | 'Low'
        },
        full: {
          summary: full.summary,
          primaryIssue: full.primaryIssue,
          suggestions: full.suggestions
        }
      };
    } catch (parseError) {
      console.error('[generateBrewSuggestions] Failed to parse JSON', parseError);
      return null;
    }
  } catch (error) {
    console.error('[generateBrewSuggestions] Error generating suggestions', error);
    return null;
  }
}

// Get AI suggestions for improving brew
app.post('/make-server-23508aac/brew-suggestions', async (c) => {
  try {
    const { coffee, brews, brewMethod, targetBrewId, brewerName, grinderName } = await c.req.json();
    
    if (!coffee) {
      return c.json({ error: 'Coffee data required' }, 400);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    // Check if this is a first-time coffee (no previous brews)
    const isFirstTime = !brews || brews.length === 0;
    
    let prompt: string;
    let systemMessage: string;

    if (isFirstTime) {
      // First-time coffee prompt: suggest starting parameters
      systemMessage = 'You are an expert barista helping set up initial brew parameters for a new coffee. Provide specific, actionable starting parameters based on coffee characteristics. Respond with valid JSON only.';
      
      // Build the parameters array based on brew method
      const baseParameters = `    {
      "name": "Grind Setting",
      "recommendation": "Specific setting on the grinder (e.g., 'Start at 6.5 on the Fellow Ode Gen 2')",
      "explanation": "One sentence explaining why this setting works for this coffee and equipment"
    },
    {
      "name": "Dosage",
      "recommendation": "Specific dose (e.g., '20g')",
      "explanation": "One sentence explaining why this dose suits the brew method and coffee"
    },
    {
      "name": "Water Temperature",
      "recommendation": "Specific temperature (e.g., '200°F')",
      "explanation": "One sentence explaining why this temperature suits the roast level"
    },
    {
      "name": "Brew Time",
      "recommendation": "Target total brew time from start to finish (e.g., '2:45-3:00')",
      "explanation": "One sentence explaining why this timing supports balance"
    },
    {
      "name": "Final Weight/Ratio",
      "recommendation": "Target final output weight and ratio (e.g., '300g output (1:15 ratio)')",
      "explanation": "One sentence explaining why this ratio fits the flavor profile and method"
    }`;
      
      const pourStructureParameter = `,
    {
      "name": "Pour Structure",
      "recommendation": "Stage-by-stage pour details with specific weights and timings (e.g., 'Bloom: 40g for 45s, First pour: 100g to 140g at 0:45, Second pour: 160g to 300g at 1:45')",
      "explanation": "One sentence explaining why this pour structure suits the coffee characteristics"
    }`;
      
      const parametersSection = supportsStages(brewMethod as any) 
        ? baseParameters + pourStructureParameter 
        : baseParameters;
      
      prompt = `You are helping a barista brew a coffee for the first time. Based on the coffee's characteristics, suggest optimal starting parameters for an excellent brew.

COFFEE:
- Name: ${coffee.name}
- Roaster: ${coffee.roaster}
- Brew Method: ${brewMethod}${coffee.region ? `\n- Region: ${coffee.region}` : ''}${coffee.roastLevel ? `\n- Roast Level: ${coffee.roastLevel}` : ''}${coffee.notes ? `\n- Flavor Notes: ${coffee.notes}` : ''}${brewerName ? `\n- Brewing Equipment: ${brewerName}` : ''}${grinderName ? `\n- Grinder: ${grinderName}` : ''}

GOAL:
Provide starting parameters that have a high probability of yielding a well-balanced brew (≈3/3 stars) on the first attempt, with room for easy adjustment.

IMPORTANT GUIDELINES:
- Adapt recommendations to the brew method (espresso, pour-over, immersion, etc.).
- Commit to one primary recommended value per parameter.
- Use narrow ranges only when unavoidable (e.g., brew time).
- Prefer forgiving starting points that avoid stalled flow, over-extraction, or under-extraction.
- When grinders use numeric dials, assume typical real-world ranges for that grinder and method, then pick the best starting point.
- Assume grinder is calibrated to factory default unless stated otherwise.
- Do not rename, reorder, or omit any fields.
- Parameter "name" values must match the schema exactly.

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "introduction": "Brief introduction (1-2 sentences) acknowledging this is the first time brewing this coffee and what makes it distinctive (origin, roast level, or flavor profile)",
  "parameters": [
    {
      "name": "Grind Setting",
      "recommendation": "Specific setting on the grinder (e.g., 'Start at 6.5 on the Fellow Ode Gen 2')",
      "explanation": "One sentence explaining why this setting works for this coffee and equipment"
    },
    {
      "name": "Dosage",
      "recommendation": "Specific dose (e.g., '20g')",
      "explanation": "One sentence explaining why this dose suits the brew method and coffee"
    },
    {
      "name": "Water Temperature",
      "recommendation": "Specific temperature (e.g., '200°F')",
      "explanation": "One sentence explaining why this temperature suits the roast level"
    },
    {
      "name": "Brew Time",
      "recommendation": "Target total brew time from start to finish (e.g., '2:45-3:00')",
      "explanation": "One sentence explaining why this timing supports balance"
    },
    {
      "name": "Final Weight/Ratio",
      "recommendation": "Target final output weight and ratio (e.g., '300g output (1:15 ratio)')",
      "explanation": "One sentence explaining why this ratio fits the flavor profile and method"
    }
\${parametersSection}
  ],
  "note": "These are based on common best practices for this brew method and equipment. Adjust grind first, then ratio or time, based on taste and flow."
}`;
    } else {
      // Existing improvement prompt for coffees with history
      systemMessage = 'You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.';
      
      // Frontend sends: top 10 most recent + baseline brew + most recent Exceptional brew
      // All brews are already filtered and tagged with isBaseline and isExceptional
      // Use brews as-is (already sorted chronologically by frontend)
      const brewsToInclude = brews;
      
      // Find the target brew (baseline) and exceptional brew using tags
      const targetBrew = brews.find((b: any) => b.isBaseline) || brews.find((b: any) => b.id === targetBrewId) || brews[0];
      const exceptionalBrew = brews.find((b: any) => b.isExceptional);

      // Helper function to get quality label
      const getQualityLabel = (quality: number | undefined) => {
        if (!quality) return 'Not rated';
        return quality === 1 ? 'Bad' : quality === 2 ? 'Decent' : 'Excellent';
      };

      // Helper function to format date and time
      const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeFormatted = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${dateFormatted} at ${timeFormatted}`;
      };

      // Helper function to format date only
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      // Build the prompt with full brew history
      prompt = `You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.

COFFEE:
- Name: ${coffee.name}
- Roaster: ${coffee.roaster}
- Brew Method: ${brewMethod}${coffee.region ? `\n- Region: ${coffee.region}` : ''}${coffee.roastLevel ? `\n- Roast Level: ${coffee.roastLevel}` : ''}${coffee.notes ? `\n- Flavor Notes: ${coffee.notes}` : ''}

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

BREW HISTORY (Most recent to oldest):
`;

    // Add selected brews in chronological order (most recent first)
    brewsToInclude.forEach((brew: any, idx: number) => {
      const brewNum = idx + 1;
      const isTarget = brew.isBaseline || brew.id === targetBrew?.id;
      const isExceptional = brew.isExceptional || (exceptionalBrew && brew.id === exceptionalBrew.id);
      
      let qualifiers = '';
      if (isTarget && isExceptional) {
        qualifiers = ' ⭐ REFERENCE BREW, 🏆 BEST RECORDED BREW';
      } else if (isTarget) {
        qualifiers = ' ⭐ REFERENCE BREW';
      } else if (isExceptional) {
        qualifiers = ' 🏆 BEST RECORDED BREW';
      }
      
      prompt += `
BREW #${brewNum} (${formatDate(brew.createdAt)})${qualifiers}:
- Brewer: ${brew.brewerName || 'Not specified'}
- Grinder: ${brew.grinderName || 'Not specified'}
- Bean Temperature: ${brew.coffeeTemperature === 'frozen' ? 'Frozen' : 'Room Temperature'}
- Grind Setting: ${brew.grindSetting}
- Dosage: ${brew.dosage}g
- Water Temperature: ${brew.waterTemp ? `${brew.waterTemp}°F` : 'Not recorded'}`;

      // Add brew-method-specific details
      prompt += formatBrewForPrompt(brew, brewMethod);

      prompt += `
- Quality Rating: ${getQualityLabel(brew.quality)}${brew.tastingNotes ? `
- Tasting Notes: ${brew.tastingNotes}` : ''}${brew.notes ? `
- Extraction Notes: ${brew.notes}` : ''}
`;
    });

    prompt += `
IMPORTANT CONSIDERATIONS:
1. Focus on the REFERENCE BREW (marked with ⭐): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried and avoid suggesting the same adjustments that were already attempted.
2. Grinder Direction: Different grinders have different scales. Some use lower numbers for finer grinds (e.g., Niche Zero, Fellow Ode), while others use higher numbers for finer grinds. Ensure your suggestion moves in the correct direction for the specific grinder being used.
3. Grinder Sensitivity: Pay attention to how sensitive the grinder's adjustments are. Stepless grinders like the Niche Zero are highly sensitive (0.5 adjustments matter), while stepped grinders may need larger adjustments (2-3 steps).
4. Equipment Context: Consider the brewer and grinder being used when making suggestions. Different equipment has different characteristics and optimal parameters.
5. Avoid Repetition: Review the previous brews to ensure you're not suggesting something that was already tried. If a previous brew tried a parameter change and it didn't improve things, suggest a different approach.
6. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
7. Baseline Brew Terminology: When referring to the REFERENCE BREW (marked with ⭐) in your summary or suggestions, always use the term "baseline brew" instead of "most recent brew" or "best brew". This brew is the starting point for improvement suggestions.
8. Do not infer causes that are not supported by recorded data.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless history strongly suggests otherwise):
   - Grind / flow behavior
   - Final weight / ratio
   - Water temperature
   - Dose
   - If flow issues indicate puck preparation or channeling, address distribution, tamping, or pre-infusion before changing core parameters.

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact (example: "should reduce sourness and increase body").

C) Confidence score:
   - Every suggestion must include a confidence score: High / Medium / Low.
   - Confidence should reflect how strongly the brew history supports the change (e.g., repeated evidence vs weak signal).
   - Use "High" only when supported by at least two prior brews or a direct comparison.

D) Primary failure mode:
   - Before listing suggestions, identify exactly ONE primary failure mode for the selected brew (e.g., "under-extracted due to fast flow" or "over-extracted due to excessive yield").
   - All suggestions must directly address this failure mode.

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer suggestions rather than forcing additional ones.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful changes.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.

F) Learning from excellent brews:
   - If the history contains an excellent brew, it is acceptable to recommend reverting one or more parameters back toward that setup, with reasoning.
   - Reverting to a previously successful setting is not considered repetition.
   - When referring to it, use descriptive language like "an earlier excellent brew" without mentioning brew numbers.

G) Prefer minimal changes:
   - When suggesting adjustments, prefer the smallest reasonable change that could plausibly fix the issue.
   - Avoid large jumps unless history clearly shows they are necessary.

H) Stability check:
   - If a parameter appears optimal based on excellent brews, explicitly state that it should remain unchanged.

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "summary": "Brief diagnostic summary (1-2 sentences). State the outcome (quality rating and key tasting notes) and what was missing or wrong. Avoid hedging language like 'likely', 'suggests', 'step in the right direction'. Collapse cause and effect into one sentence.",
  "primaryIssue": "The primary failure mode (e.g., 'under-extracted due to fast flow' or 'over-extracted due to excessive yield')",
  "suggestions": [
    {
      "parameter": "Parameter name",
      "action": "Action with specific magnitude (no period at end)",
      "effect": "Expected taste/texture effect as a complete sentence starting with 'This will' or 'This should' (no period at end)",
      "reasoning": "Concise explanation (1 sentence) of why this works based on brew history. Do NOT reference brew numbers (no period at end)",
      "confidence": "High" | "Medium" | "Low"
    }
  ]
}

REQUIREMENTS:
- You must provide at least 1 suggestion and at most 3 suggestions
- Each suggestion must follow the structure: Action → Expected effect → Why it matters (based on history)
- Only include high-quality, non-redundant suggestions`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_completion_tokens: 1000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error status:', response.status);
      console.error('OpenAI API error details:', JSON.stringify(error, null, 2));
      return c.json({ error: 'Failed to generate suggestions' }, 500);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in OpenAI response');
      return c.json({ error: 'No content received from AI' }, 500);
    }

    try {
      const suggestions = JSON.parse(content);
      return c.json(suggestions);
    } catch (parseError) {
      console.error('Failed to parse AI suggestions JSON:', parseError);
      return c.json({ error: 'Invalid JSON response from AI' }, 500);
    }
  } catch (error) {
    console.error('Error in AI suggestions endpoint:', error);
    return c.json({ error: 'Failed to generate suggestions' }, 500);
  }
});

// La Marzocco endpoints

// Get machine status
app.get('/make-server-23508aac/lamarzocco/status', async (c) => {
  try {
    const status = await lamarzocco.getMachineStatus();
    return c.json(status);
  } catch (error) {
    return c.json({ 
      error: 'Failed to get machine status', 
      details: error.message 
    }, 500);
  }
});

// Stream machine status updates via Server-Sent Events (SSE)
app.get('/make-server-23508aac/lamarzocco/stream', async (c) => {
  try {
    let streamClosed = false;
    let generator: AsyncGenerator | null = null;
    let keepaliveInterval: number | null = null;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();
          
          // Helper function to safely enqueue data
          const safeEnqueue = (data: Uint8Array): boolean => {
            if (streamClosed) return false;
            try {
              controller.enqueue(data);
              return true;
            } catch (err) {
              streamClosed = true;
              // Immediately clear the interval when we detect stream closure
              if (keepaliveInterval !== null) {
                clearInterval(keepaliveInterval);
                keepaliveInterval = null;
              }
              return false;
            }
          };
          
          // Send initial connection message
          if (!safeEnqueue(encoder.encode('event: connected\ndata: {"message": "Connected to La Marzocco stream"}\n\n'))) {
            return;
          }

          // Send keepalive pings every 15 seconds to prevent timeout
          keepaliveInterval = setInterval(() => {
            if (streamClosed) {
              if (keepaliveInterval !== null) {
                clearInterval(keepaliveInterval);
                keepaliveInterval = null;
              }
              return;
            }
            safeEnqueue(encoder.encode('event: keepalive\ndata: {\"timestamp\": ' + Date.now() + '}\\n\\n'));
          }, 15000);

          // Create generator
          try {
            generator = lamarzocco.streamMachineStatusUpdates();
          } catch (genError) {
            safeEnqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Failed to initialize stream', details: genError.message })}\n\n`));
            throw genError;
          }

          // Stream updates
          try {
            for await (const update of generator) {
              // Check if stream was closed
              if (streamClosed) {
                break;
              }
              
              try {
                const data = JSON.stringify(update);
                if (!safeEnqueue(encoder.encode(`event: update\ndata: ${data}\n\n`))) {
                  break;
                }
              } catch (stringifyError) {
                // Continue with next update
              }
            }
          } catch (iterError) {
            if (!streamClosed) {
              safeEnqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream iteration error', details: iterError.message })}\n\n`));
            }
          }
          
          // Close controller when done
          if (!streamClosed) {
            try {
              controller.close();
            } catch (closeError) {
              // Controller may already be closed
            }
          }
        } catch (error) {
          if (!streamClosed) {
            try {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`));
            } catch (enqueueError) {
              // Cannot enqueue error (stream closed)
            }
            try {
              controller.close();
            } catch (closeError) {
              // Cannot close controller
            }
          }
        } finally {
          streamClosed = true;
          // Clear keepalive interval
          if (keepaliveInterval !== null) {
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;
          }
          // Ensure generator cleanup
          if (generator && typeof generator.return === 'function') {
            try {
              await generator.return();
            } catch (err) {
              // Silently clean up generator
            }
          }
        }
      },
      cancel() {
        streamClosed = true;
        // Clear keepalive interval
        if (keepaliveInterval !== null) {
          clearInterval(keepaliveInterval);
          keepaliveInterval = null;
        }
        // Clean up generator if it exists
        if (generator && typeof generator.return === 'function') {
          try {
            generator.return();
          } catch (err) {
            // Silently clean up generator
          }
        }
      }
    });

    // Return streaming response using Hono's context
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');
    
    return c.body(stream);
  } catch (error) {
    console.error('Error setting up La Marzocco stream:', error);
    return c.json({ 
      error: 'Failed to start stream', 
      details: error.message 
    }, 500);
  }
});

// Equipment endpoints
app.get('/make-server-23508aac/equipment', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get household member IDs
    const householdMemberIds = await getHouseholdMemberIds(user.id);
    
    // Load equipment for user and household members
    const allEquipment: any[] = [];
    const migrations: Promise<void>[] = [];
    
    for (const memberId of householdMemberIds) {
      const memberEquipment = await kv.getByPrefix(`equipment:${memberId}:`);
      
      // Auto-migrate equipment
      for (const eq of memberEquipment) {
        let needsMigration = false;
        
        // Migrate grinders to have methods array if they don't already
        if (eq.type === 'grinder' && !eq.methods && eq.method) {
          eq.methods = [eq.method];
          needsMigration = true;
        }
        
        // Migrate equipment to use primaryForMethods if they don't already
        if (!eq.primaryForMethods && eq.primary) {
          eq.primaryForMethods = [eq.method];
          needsMigration = true;
        }
        
        if (needsMigration) {
          migrations.push(kv.set(`equipment:${memberId}:${eq.id}`, eq));
        }
      }
      
      allEquipment.push(...memberEquipment);
    }
    
    // Execute all migrations in parallel
    if (migrations.length > 0) {
      await Promise.all(migrations);
    }
    
    return c.json(allEquipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return c.json({ error: 'Failed to fetch equipment' }, 500);
  }
});

app.post('/make-server-23508aac/equipment', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name, company, model, type, method, methods } = await c.req.json();

    // Support both old (name) and new (company + model) fields
    if ((!company || !model) && !name) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // For grinders, accept methods array; for brewers, require single method
    if (!type || (type === 'grinder' && !methods && !method) || (type === 'brewer' && !method)) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Get the methods to use - for grinders use methods array, for brewers use single method
    const equipmentMethods = type === 'grinder' ? (methods || [method]) : undefined;
    const equipmentMethod = type === 'brewer' ? method : (methods ? methods[0] : method);

    // Check if there's existing equipment of the same type and method
    const allEquipment = await kv.getByPrefix(`equipment:${user.id}:`);
    
    // Determine which methods this equipment should be primary for
    const primaryForMethods: string[] = [];
    const methodsToCheck = equipmentMethods || [equipmentMethod];
    
    for (const m of methodsToCheck) {
      // Check if there's already a primary for this method
      const hasPrimary = allEquipment.some((eq: any) => {
        if (eq.type !== type) return false;
        // Check using primaryForMethods if available, otherwise fall back to primary boolean
        if (eq.primaryForMethods) {
          return eq.primaryForMethods.includes(m);
        }
        return eq.primary && eq.method === m;
      });
      
      if (!hasPrimary) {
        primaryForMethods.push(m);
      }
    }

    const id = crypto.randomUUID();
    
    // Generate name from company + model for backwards compatibility
    const equipmentName = (company && model) ? `${company} ${model}` : name;
    
    const equipment = {
      id,
      name: equipmentName,
      company: company || undefined,
      model: model || undefined,
      type,
      method: equipmentMethod,
      ...(equipmentMethods ? { methods: equipmentMethods } : {}),
      active: true,
      primary: primaryForMethods.length > 0, // Keep for backwards compatibility
      primaryForMethods,
      userId: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`equipment:${user.id}:${id}`, equipment);
    return c.json(equipment);
  } catch (error) {
    console.error('Error creating equipment:', error);
    return c.json({ error: 'Failed to create equipment' }, 500);
  }
});

app.put('/make-server-23508aac/equipment/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const existing = await kv.get(`equipment:${user.id}:${id}`);

    if (!existing) {
      return c.json({ error: 'Equipment not found' }, 404);
    }

    const { name, company, model, type, method, methods, active } = await c.req.json();
    
    // Generate new name from company + model if provided
    const newName = (company !== undefined && model !== undefined) 
      ? `${company} ${model}` 
      : (name !== undefined ? name : existing.name);
    
    // If methods are being updated, recalculate primaryForMethods
    let primaryForMethods = existing.primaryForMethods || [];
    
    if (methods !== undefined) {
      const allEquipment = await kv.getByPrefix(`equipment:${user.id}:`);
      const newMethods = methods || [];
      const oldMethods = existing.methods || [existing.method];
      const addedMethods = newMethods.filter((m: string) => !oldMethods.includes(m));
      
      // For newly added methods, check if there's already a primary
      const updatedPrimaryForMethods = [...primaryForMethods];
      
      for (const m of addedMethods) {
        const hasPrimary = allEquipment.some((eq: any) => {
          if (eq.id === id || eq.type !== existing.type) return false;
          if (eq.primaryForMethods) {
            return eq.primaryForMethods.includes(m);
          }
          return eq.primary && eq.method === m;
        });
        
        // Only add as primary if no other equipment is primary for this method
        if (!hasPrimary && !updatedPrimaryForMethods.includes(m)) {
          updatedPrimaryForMethods.push(m);
        }
      }
      
      // Remove methods that are no longer supported
      primaryForMethods = updatedPrimaryForMethods.filter((m: string) => newMethods.includes(m));
    }
    
    const updated = {
      ...existing,
      name: newName,
      company: company !== undefined ? company : existing.company,
      model: model !== undefined ? model : existing.model,
      type: type !== undefined ? type : existing.type,
      method: method !== undefined ? method : existing.method,
      ...(methods !== undefined ? { methods } : {}),
      active: active !== undefined ? active : existing.active,
      primaryForMethods,
      primary: primaryForMethods.length > 0, // Keep for backwards compatibility
    };

    await kv.set(`equipment:${user.id}:${id}`, updated);

    // Update denormalized equipment names in all brews using this equipment (scoped to household)
    if (newName && newName !== existing.name) {
      const householdMemberIds = await getHouseholdMemberIds(user.id);
      const allBrews = await kv.getByPrefix('brew:');
      const householdBrews = allBrews.filter((brew: any) => 
        brew.userId && householdMemberIds.includes(brew.userId)
      );
      const updates: Promise<void>[] = [];

      for (const brew of householdBrews) {
        let needsUpdate = false;
        const updatedBrew = { ...brew };

        if (brew.brewerId === id) {
          updatedBrew.brewerName = newName;
          needsUpdate = true;
        }

        if (brew.grinderId === id) {
          updatedBrew.grinderName = newName;
          needsUpdate = true;
        }

        if (needsUpdate) {
          updates.push(kv.set(`brew:${brew.id}`, updatedBrew));
        }
      }

      await Promise.all(updates);
    }

    return c.json(updated);
  } catch (error) {
    console.error('Error updating equipment:', error);
    return c.json({ error: 'Failed to update equipment' }, 500);
  }
});

app.delete('/make-server-23508aac/equipment/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const existing = await kv.get(`equipment:${user.id}:${id}`);

    if (!existing) {
      return c.json({ error: 'Equipment not found' }, 404);
    }

    const wasPrimary = existing.primary;
    const equipmentType = existing.type;
    const equipmentMethod = existing.method;

    await kv.del(`equipment:${user.id}:${id}`);
    
    // If we deleted a primary equipment, set the most recently added available equipment as primary
    if (wasPrimary) {
      const allEquipment = await kv.getByPrefix(`equipment:${user.id}:`);
      const sameTypeAndMethod = allEquipment
        .filter((eq: any) => 
          eq.type === equipmentType && 
          eq.method === equipmentMethod && 
          eq.active
        )
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (sameTypeAndMethod.length > 0) {
        const newPrimary = sameTypeAndMethod[0];
        newPrimary.primary = true;
        await kv.set(`equipment:${user.id}:${newPrimary.id}`, newPrimary);
      }
    }
    
    // Note: We don't update or delete equipment references in brews
    // This preserves historical data - brews keep the equipment name at time of creation
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    return c.json({ error: 'Failed to delete equipment' }, 500);
  }
});

// Toggle equipment active status
app.put('/make-server-23508aac/equipment/:id/toggle-active', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const existing = await kv.get(`equipment:${user.id}:${id}`);

    if (!existing) {
      return c.json({ error: 'Equipment not found' }, 404);
    }

    const updated = { ...existing, active: !existing.active };
    await kv.set(`equipment:${user.id}:${id}`, updated);

    return c.json(updated);
  } catch (error) {
    console.error('Error toggling equipment active status:', error);
    return c.json({ error: 'Failed to toggle equipment' }, 500);
  }
});

// Set equipment as primary for a specific method
app.put('/make-server-23508aac/equipment/:id/primary', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const user = await getUser(accessToken);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const method = c.req.query('method'); // Get method from query parameter
    const existing = await kv.get(`equipment:${user.id}:${id}`);

    if (!existing) {
      return c.json({ error: 'Equipment not found' }, 404);
    }

    if (!method) {
      return c.json({ error: 'Method parameter is required' }, 400);
    }

    // Get all equipment
    const allEquipment = await kv.getByPrefix(`equipment:${user.id}:`);
    const updates: Promise<void>[] = [];

    // Remove this method from primaryForMethods of all other equipment of the same type
    for (const eq of allEquipment) {
      if (eq.id !== id && eq.type === existing.type) {
        const equipmentMethods = eq.methods || [eq.method];
        
        // Only update if this equipment supports the method
        if (equipmentMethods.includes(method)) {
          const primaryForMethods = eq.primaryForMethods || (eq.primary && eq.method === method ? [eq.method] : []);
          const updatedPrimaryForMethods = primaryForMethods.filter((m: string) => m !== method);
          
          updates.push(kv.set(`equipment:${user.id}:${eq.id}`, { 
            ...eq, 
            primaryForMethods: updatedPrimaryForMethods,
            primary: updatedPrimaryForMethods.length > 0 // Keep for backwards compatibility
          }));
        }
      }
    }

    // Add this method to primaryForMethods of the current equipment
    const existingPrimaryForMethods = existing.primaryForMethods || (existing.primary ? [existing.method] : []);
    const updatedPrimaryForMethods = [...new Set([...existingPrimaryForMethods, method])];
    
    const updated = { 
      ...existing, 
      primaryForMethods: updatedPrimaryForMethods,
      primary: true // Keep for backwards compatibility
    };
    updates.push(kv.set(`equipment:${user.id}:${id}`, updated));

    await Promise.all(updates);

    return c.json(updated);
  } catch (error) {
    console.error('Error setting equipment as primary:', error);
    return c.json({ error: 'Failed to set equipment as primary' }, 500);
  }
});

// 404 handler for unmatched routes
app.notFound((c) => {
  console.log(`404 - Route not found: ${c.req.method} ${c.req.url}`);
  return c.json({ error: 'Not found', path: c.req.url }, 404);
});

// Version endpoint for client-side update detection
app.get('/make-server-23508aac/version', (c) => {
  return c.json({ version: '2026-01-31-brews-refactor' });
});

// Wrap the app.fetch with timeout handling (but exclude streaming endpoints)
const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    
    // Don't apply timeout to streaming endpoints
    if (url.pathname.includes('/stream') || url.pathname.includes('/lamarzocco')) {
      return await app.fetch(req);
    }
    
    // Set a timeout to prevent hanging connections for regular requests
    const timeout = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 25000); // 25 second timeout
    });
    
    const response = app.fetch(req);
    
    return await Promise.race([response, timeout]);
  } catch (error) {
    // Only log non-timeout errors and non-connection errors
    if (!error.message?.includes('timeout') && !error.message?.includes('connection')) {
      console.error('Handler error:', error);
    }
    return new Response(
      JSON.stringify({ error: 'Request failed', details: String(error) }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};

Deno.serve(handler);