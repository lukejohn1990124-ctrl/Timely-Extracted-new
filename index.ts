import { Hono } from "hono";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import { getPayPalAuthUrl, exchangeCodeForTokens, fetchPayPalInvoices, fetchPayPalUserInfo, fetchPayPalAccountInfo } from "./lib/paypal";

interface EmailParams {
  to: string;
  subject: string;
  html_body?: string;
  text_body?: string;
  reply_to?: string;
  customer_id?: string;
}

interface EmailResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

interface EmailService {
  send(params: EmailParams): Promise<EmailResult>;
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  EMAILS: EmailService;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  ENCRYPTION_KEY: string;
  MAILCHIMP_CLIENT_ID: string;
  MAILCHIMP_CLIENT_SECRET: string;
  GMAIL_CLIENT_ID: string;
  GMAIL_CLIENT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

// OAuth redirect URL endpoint
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

// Exchange code for session token
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

// Get current user
app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

// Logout endpoint
app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// PayPal OAuth: Get authorization URL
app.get("/api/integrations/paypal/auth-url", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const state = crypto.randomUUID();
  
  // Store state in session or database for validation on callback
  // For simplicity, encoding userId in state (in production, use a separate state store)
  const encodedState = btoa(JSON.stringify({ userId: user.id, state }));
  
  const redirectUri = `${new URL(c.req.url).origin}/api/integrations/paypal/callback`;
  
  console.log('PayPal OAuth Debug:', {
    origin: new URL(c.req.url).origin,
    redirectUri,
    clientId: c.env.PAYPAL_CLIENT_ID.substring(0, 10) + '...'
  });
  
  const authUrl = getPayPalAuthUrl(
    {
      clientId: c.env.PAYPAL_CLIENT_ID,
      clientSecret: c.env.PAYPAL_CLIENT_SECRET,
      redirectUri,
      encryptionKey: c.env.ENCRYPTION_KEY,
    },
    encodedState
  );

  return c.json({ authUrl, redirectUri }, 200);
});

// Helper to return an HTML page for OAuth callback
function oauthResultPage(success: boolean, message: string, redirectUrl: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${success ? 'Connected!' : 'Connection Error'}</title>
  <meta http-equiv="refresh" content="2;url=${redirectUrl}">
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .container { text-align: center; padding: 2rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    .message { color: #374151; margin-bottom: 1rem; }
    .redirect { color: #6b7280; font-size: 0.875rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? '✓' : '✕'}</div>
    <div class="message">${message}</div>
    <div class="redirect">Redirecting... <a href="${redirectUrl}">Click here</a> if not redirected.</div>
  </div>
  <script>setTimeout(() => window.location.href = "${redirectUrl}", 1500);</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// PayPal OAuth: Complete OAuth (called from React component)
app.post("/api/integrations/paypal/complete-oauth", async (c) => {
  try {
    const { code, state } = await c.req.json();
    const origin = new URL(c.req.url).origin;
    
    if (!code || !state) {
      return c.json({ error: 'Missing authorization parameters' }, 400);
    }

    // Decode and validate state
    const { userId } = JSON.parse(atob(state));
    
    const redirectUri = `${origin}/api/integrations/paypal/callback`;
    
    // Exchange code for tokens
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code, {
      clientId: c.env.PAYPAL_CLIENT_ID,
      clientSecret: c.env.PAYPAL_CLIENT_SECRET,
      redirectUri,
      encryptionKey: c.env.ENCRYPTION_KEY,
    });

    // Try to fetch user info (optional - may fail in sandbox)
    let userIdentifier: string | null = null;
    try {
      const userInfo = await fetchPayPalUserInfo(accessToken, c.env.ENCRYPTION_KEY, c.env.PAYPAL_CLIENT_ID);
      userIdentifier = userInfo.email || null;
    } catch (userInfoError) {
      console.log('Could not fetch PayPal user info (this is normal in sandbox):', userInfoError);
    }

    // Store encrypted tokens and user identifier in database
    const existing = await c.env.DB.prepare(
      "SELECT id FROM integrations WHERE user_id = ? AND provider = ?"
    ).bind(userId, "paypal").first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE integrations 
         SET access_token = ?, refresh_token = ?, user_identifier = ?, is_connected = 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      ).bind(accessToken, refreshToken, userIdentifier, existing.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO integrations (user_id, provider, access_token, refresh_token, user_identifier, is_connected, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, "paypal", accessToken, refreshToken, userIdentifier).run();
    }

    return c.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('PayPal OAuth completion error:', errorMessage);
    return c.json({ error: errorMessage }, 500);
  }
});

// PayPal OAuth: Handle callback (legacy - redirects to React handler)
app.get("/api/integrations/paypal/callback", async (c) => {
  try {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const origin = new URL(c.req.url).origin;
    
    if (!code || !state) {
      return oauthResultPage(false, 'Missing authorization parameters', `${origin}/settings/integrations?error=missing_params`);
    }
    // Decode and validate state
    const { userId } = JSON.parse(atob(state));
    
    const redirectUri = `${origin}/api/integrations/paypal/callback`;
    
    // Exchange code for tokens
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code, {
      clientId: c.env.PAYPAL_CLIENT_ID,
      clientSecret: c.env.PAYPAL_CLIENT_SECRET,
      redirectUri,
      encryptionKey: c.env.ENCRYPTION_KEY,
    });

    // Try to fetch user info (optional - may fail in sandbox)
    let userIdentifier: string | null = null;
    try {
      const userInfo = await fetchPayPalUserInfo(accessToken, c.env.ENCRYPTION_KEY, c.env.PAYPAL_CLIENT_ID);
      userIdentifier = userInfo.email || null;
    } catch (userInfoError) {
      console.log('Could not fetch PayPal user info (this is normal in sandbox):', userInfoError);
    }

    // Store encrypted tokens and user identifier in database
    const existing = await c.env.DB.prepare(
      "SELECT id FROM integrations WHERE user_id = ? AND provider = ?"
    ).bind(userId, "paypal").first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE integrations 
         SET access_token = ?, refresh_token = ?, user_identifier = ?, is_connected = 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      ).bind(accessToken, refreshToken, userIdentifier, existing.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO integrations (user_id, provider, access_token, refresh_token, user_identifier, is_connected, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, "paypal", accessToken, refreshToken, userIdentifier).run();
    }

    return oauthResultPage(true, 'PayPal connected successfully!', `${origin}/settings/integrations?connected=paypal`);
  } catch (error) {
    const origin = new URL(c.req.url).origin;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return oauthResultPage(false, `Connection failed: ${errorMessage}`, `${origin}/settings/integrations?error=paypal`);
  }
});

// Get PayPal connection status
app.get("/api/integrations/paypal/status", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const userId = String(user.id);
  
  // First try to find integration for this user
  let integration = await c.env.DB.prepare(
    "SELECT id, is_connected, last_synced_at, user_identifier, access_token FROM integrations WHERE user_id = ? AND provider = ?"
  ).bind(userId, "paypal").first<{ id: number; is_connected: number; last_synced_at: string | null; user_identifier: string | null; access_token: string | null }>();

  // If not found, check if there's ANY connected PayPal integration
  if (!integration) {
    integration = await c.env.DB.prepare(
      "SELECT id, is_connected, last_synced_at, user_identifier, access_token FROM integrations WHERE provider = ? AND is_connected = 1 LIMIT 1"
    ).bind("paypal").first<{ id: number; is_connected: number; last_synced_at: string | null; user_identifier: string | null; access_token: string | null }>();
    
    if (integration) {
      // Update the integration to the current user
      await c.env.DB.prepare(
        "UPDATE integrations SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(userId, integration.id).run();
    }
  }

  let accountInfo = null;
  if (integration?.is_connected === 1 && integration.access_token) {
    try {
      console.log('Fetching PayPal account info for user', user.id);
      accountInfo = await fetchPayPalAccountInfo(
        integration.access_token,
        c.env.ENCRYPTION_KEY,
        c.env.PAYPAL_CLIENT_ID
      );
      console.log('PayPal account info retrieved:', { 
        accountId: accountInfo.accountId, 
        hasBalance: !!accountInfo.balance 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to fetch PayPal account info:', errorMessage, error);
    }
  }

  return c.json({
    connected: integration?.is_connected === 1,
    lastSynced: integration?.last_synced_at,
    userIdentifier: integration?.user_identifier,
    accountId: accountInfo?.accountId,
    balance: accountInfo?.balance,
  });
});

// Disconnect PayPal
app.post("/api/integrations/paypal/disconnect", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  await c.env.DB.prepare(
    `UPDATE integrations 
     SET is_connected = 0, access_token = NULL, refresh_token = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND provider = ?`
  ).bind(user.id, "paypal").run();

  return c.json({ success: true });
});

// Sync PayPal invoices
app.post("/api/integrations/paypal/sync", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  try {
    const userId = String(user.id);
    
    // First try to find integration for this user
    let integration = await c.env.DB.prepare(
      "SELECT id, access_token, refresh_token, user_id FROM integrations WHERE user_id = ? AND provider = ? AND is_connected = 1"
    ).bind(userId, "paypal").first<{ id: number; access_token: string; refresh_token: string; user_id: string }>();

    // If not found, check if there's ANY connected PayPal integration (in case user_id format differs)
    if (!integration) {
      console.log('No integration found for user', userId, '- checking for any connected PayPal integration');
      integration = await c.env.DB.prepare(
        "SELECT id, access_token, refresh_token, user_id FROM integrations WHERE provider = ? AND is_connected = 1 LIMIT 1"
      ).bind("paypal").first<{ id: number; access_token: string; refresh_token: string; user_id: string }>();
      
      if (integration) {
        console.log('Found integration under different user_id:', integration.user_id, '- updating to current user:', userId);
        // Update the integration to the current user
        await c.env.DB.prepare(
          "UPDATE integrations SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(userId, integration.id).run();
      }
    }

    if (!integration || !integration.access_token) {
      console.error('PayPal sync failed: No connected integration found for user', userId);
      return c.json({ error: "PayPal not connected" }, 400);
    }

    // Fetch invoices from PayPal
    console.log('Fetching PayPal invoices for user', user.id, 'type:', typeof user.id);
    let invoices: Awaited<ReturnType<typeof fetchPayPalInvoices>> = [];
    let fetchError: string | null = null;
    let accessToken = integration.access_token;
    
    try {
      invoices = await fetchPayPalInvoices(accessToken, c.env.ENCRYPTION_KEY, c.env.PAYPAL_CLIENT_ID);
      console.log(`Fetched ${invoices.length} invoices from PayPal`);
    } catch (fetchErr) {
      const errorMessage = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error';
      console.error('PayPal invoice fetch failed:', errorMessage);
      
      // If we get a 401 error, try refreshing the access token
      if (errorMessage.includes('401') && integration.refresh_token) {
        console.log('Access token expired, attempting to refresh...');
        try {
          const { refreshAccessToken } = await import('./lib/paypal');
          const newAccessToken = await refreshAccessToken(integration.refresh_token, {
            clientId: c.env.PAYPAL_CLIENT_ID,
            clientSecret: c.env.PAYPAL_CLIENT_SECRET,
            redirectUri: `${new URL(c.req.url).origin}/api/integrations/paypal/callback`,
            encryptionKey: c.env.ENCRYPTION_KEY,
          });
          
          // Update the access token in the database
          await c.env.DB.prepare(
            "UPDATE integrations SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(newAccessToken, integration.id).run();
          
          console.log('Access token refreshed successfully, retrying invoice fetch...');
          accessToken = newAccessToken;
          
          // Retry fetching invoices with the new token
          invoices = await fetchPayPalInvoices(accessToken, c.env.ENCRYPTION_KEY, c.env.PAYPAL_CLIENT_ID);
          console.log(`Fetched ${invoices.length} invoices from PayPal after token refresh`);
        } catch (refreshErr) {
          fetchError = refreshErr instanceof Error ? refreshErr.message : 'Token refresh failed';
          console.error('Failed to refresh access token:', fetchError);
          throw new Error(`PayPal invoice fetch failed: ${errorMessage}`);
        }
      } else {
        fetchError = errorMessage;
        throw new Error(`PayPal invoice fetch failed: ${errorMessage}`);
      }
    }
    
    // Store invoices in database
    let syncedCount = 0;
    let updatedCount = 0;
    for (const invoice of invoices) {
      try {
        console.log('Processing invoice:', JSON.stringify({
          id: invoice.id,
          status: invoice.status,
          invoice_number: invoice.detail?.invoice_number,
          amount: invoice.amount?.value,
          due_date: invoice.due_date,
          invoice_date: invoice.invoice_date
        }));

        const client = invoice.primary_recipients?.[0]?.billing_info;
        const clientName = client?.name 
          ? `${client.name.given_name || ''} ${client.name.surname || ''}`.trim()
          : 'Unknown Client';
        
        // Ensure user.id is stored as string consistently
        const userId = String(user.id);
        
        // First check if this invoice exists at all (without user_id filter)
        const existingAny = await c.env.DB.prepare(
          "SELECT id, user_id FROM invoices WHERE external_id = ? AND integration_source = ?"
        ).bind(invoice.id, "paypal").first<{ id: number; user_id: string }>();
        
        // Then check for this specific user
        const existing = await c.env.DB.prepare(
          "SELECT id FROM invoices WHERE external_id = ? AND integration_source = ? AND user_id = ?"
        ).bind(invoice.id, "paypal", userId).first();
        
        console.log('Invoice check:', { 
          external_id: invoice.id,
          currentUserId: userId,
          currentUserIdType: typeof userId,
          existsForAnyUser: existingAny ? { id: existingAny.id, storedUserId: existingAny.user_id, storedUserIdType: typeof existingAny.user_id } : null,
          existsForThisUser: !!existing
        });
        
        // If exists for different user, update to current user (user is re-syncing their own PayPal)
        if (existingAny && !existing) {
          console.log('Invoice exists but for different user, updating to current user');
          await c.env.DB.prepare(
            "UPDATE invoices SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(userId, existingAny.id).run();
          updatedCount++;
          continue; // Skip to next invoice
        }

        const status = invoice.status === "PAID" ? "paid" : 
                       invoice.status === "UNPAID" ? "pending" : 
                       invoice.status === "MARKED_AS_PAID" ? "paid" : "pending";

        if (existing) {
          console.log('Updating existing invoice:', existing.id);
          const result = await c.env.DB.prepare(
            `UPDATE invoices 
             SET status = ?, amount = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          ).bind(status, parseFloat(invoice.amount?.value || "0"), existing.id).run();
          console.log('Update result:', result.success ? 'success' : 'failed');
        } else {
          console.log('Inserting new invoice with data:', {
            invoice_number: invoice.detail?.invoice_number || invoice.id,
            client_name: clientName,
            amount: parseFloat(invoice.amount?.value || "0"),
            due_date: invoice.due_date || invoice.invoice_date || new Date().toISOString().split('T')[0],
            status
          });
          
          const result = await c.env.DB.prepare(
            `INSERT INTO invoices (user_id, invoice_number, client_name, client_email, amount, due_date, status, integration_source, external_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).bind(
            userId,
            invoice.detail?.invoice_number || invoice.id,
            clientName,
            client?.email_address || null,
            parseFloat(invoice.amount?.value || "0"),
            invoice.due_date || invoice.invoice_date || new Date().toISOString().split('T')[0],
            status,
            "paypal",
            invoice.id
          ).run();
          
          if (result.success) {
            console.log('Insert successful');
            syncedCount++;
          } else {
            console.error('Insert failed - result:', result);
          }
        }
      } catch (invoiceError) {
        console.error('Error processing invoice:', invoice.id, invoiceError);
        // Continue with next invoice
      }
    }

    // Update last synced timestamp
    await c.env.DB.prepare(
      "UPDATE integrations SET last_synced_at = CURRENT_TIMESTAMP WHERE user_id = ? AND provider = ?"
    ).bind(user.id, "paypal").run();

    // Check what's actually in the database
    // Ensure userId is consistent
    const finalUserId = String(user.id);
    
    const allInvoicesInDb = await c.env.DB.prepare(
      "SELECT id, user_id, external_id, invoice_number, client_name, amount, status FROM invoices WHERE integration_source = ?"
    ).bind("paypal").all();
    
    const thisUserInvoices = await c.env.DB.prepare(
      "SELECT id, external_id, invoice_number, client_name, amount, status FROM invoices WHERE user_id = ? AND integration_source = ?"
    ).bind(finalUserId, "paypal").all();

    console.log(`PayPal sync completed: ${syncedCount} new, ${updatedCount} updated`);
    console.log('All PayPal invoices in DB:', JSON.stringify(allInvoicesInDb.results));
    console.log('This user invoices:', JSON.stringify(thisUserInvoices.results));
    console.log('Current user.id:', finalUserId, 'type:', typeof finalUserId);
    
    return c.json({ 
      success: true, 
      syncedCount,
      updatedCount,
      debug: {
        currentUserId: finalUserId,
        totalFromPayPal: invoices.length,
        fetchError,
        invoiceIds: invoices.map(inv => inv.id),
        invoiceSummaries: invoices.slice(0, 5).map(inv => ({
          id: inv.id,
          status: inv.status,
          invoice_number: inv.detail?.invoice_number,
          amount: inv.amount?.value
        })),
        allInvoicesInDb: allInvoicesInDb.results,
        thisUserInvoices: thisUserInvoices.results
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("PayPal sync error:", errorMessage, error);
    return c.json({ error: `Failed to sync PayPal invoices: ${errorMessage}` }, 500);
  }
});

// Create scheduled reminder
app.post("/api/reminders/scheduled", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { invoiceId, schedules, recipientEmails, bulkGroupId } = body;

    if (!invoiceId || !schedules || !recipientEmails || recipientEmails.length === 0) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const userId = String(user.id);
    const emailsJson = JSON.stringify(recipientEmails);

    // Get invoice details
    const invoice = await c.env.DB.prepare(
      "SELECT due_date FROM invoices WHERE id = ? AND user_id = ?"
    ).bind(invoiceId, userId).first<{ due_date: string }>();

    if (!invoice) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    const dueDate = new Date(invoice.due_date);
    const createdReminders = [];

    // Create a scheduled reminder for each enabled schedule
    for (const schedule of schedules) {
      if (!schedule.enabled || !schedule.template) continue;

      const scheduledDate = new Date(dueDate);
      scheduledDate.setDate(scheduledDate.getDate() + schedule.day);

      // Store template data as JSON for templates from localStorage
      const templateData = JSON.stringify(schedule.template);

      const result = await c.env.DB.prepare(
        `INSERT INTO scheduled_reminders 
         (user_id, invoice_id, schedule_type, days_overdue, template_id, template_data, recipient_emails, scheduled_date, bulk_group_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        userId,
        invoiceId,
        bulkGroupId ? "bulk" : (schedule.isCustom ? "custom" : "standard"),
        schedule.day,
        schedule.template.id,
        templateData,
        emailsJson,
        scheduledDate.toISOString().split('T')[0],
        bulkGroupId || null
      ).run();

      if (result.success) {
        createdReminders.push({
          scheduleType: bulkGroupId ? "bulk" : (schedule.isCustom ? "custom" : "standard"),
          daysOverdue: schedule.day,
          scheduledDate: scheduledDate.toISOString().split('T')[0]
        });
      }
    }

    return c.json({ 
      success: true, 
      created: createdReminders.length,
      reminders: createdReminders
    });
  } catch (error) {
    console.error("Failed to create scheduled reminders:", error);
    return c.json({ error: "Failed to create reminders" }, 500);
  }
});

// Get scheduled reminders
app.get("/api/reminders/scheduled", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const userId = String(user.id);
    
    const reminders = await c.env.DB.prepare(
      `SELECT 
         sr.id,
         sr.invoice_id,
         sr.days_overdue,
         sr.scheduled_date,
         sr.is_sent,
         sr.sent_at,
         sr.recipient_emails,
         sr.template_data,
         sr.created_at,
         sr.schedule_type,
         sr.bulk_group_id,
         i.invoice_number,
         i.client_name,
         i.client_email,
         i.amount,
         i.external_id,
         et.name as template_name
       FROM scheduled_reminders sr
       JOIN invoices i ON sr.invoice_id = i.id
       LEFT JOIN email_templates et ON sr.template_id = et.id
       WHERE sr.user_id = ? AND sr.is_sent = 0
       ORDER BY sr.scheduled_date ASC`
    ).bind(userId).all();

    const formattedReminders = (reminders.results || []).map((r: any) => {
      // Try to get template name from template_data first, fallback to database
      let templateName = r.template_name;
      if (r.template_data) {
        try {
          const templateData = JSON.parse(r.template_data);
          templateName = templateData.name || templateName;
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      return {
        id: r.id,
        invoiceId: r.invoice_id,
        invoiceNumber: r.invoice_number,
        clientName: r.client_name,
        clientEmail: r.client_email,
        clientId: r.external_id || String(r.invoice_id),
        amount: r.amount,
        daysOverdue: r.days_overdue,
        scheduledDate: r.scheduled_date,
        recipientEmails: JSON.parse(r.recipient_emails),
        templateName,
        isSent: r.is_sent === 1,
        sentAt: r.sent_at,
        createdAt: r.created_at,
        scheduleType: r.schedule_type || 'standard',
        bulkGroupId: r.bulk_group_id || null
      };
    });

    return c.json({ reminders: formattedReminders });
  } catch (error) {
    console.error("Failed to fetch scheduled reminders:", error);
    return c.json({ error: "Failed to fetch reminders" }, 500);
  }
});

// Update scheduled reminder
app.put("/api/reminders/scheduled/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const reminderId = c.req.param("id");
    const body = await c.req.json();
    const { scheduledDate, recipientEmails, daysOverdue } = body;

    const userId = String(user.id);

    // Verify reminder belongs to user
    const reminder = await c.env.DB.prepare(
      "SELECT id FROM scheduled_reminders WHERE id = ? AND user_id = ?"
    ).bind(reminderId, userId).first();

    if (!reminder) {
      return c.json({ error: "Reminder not found" }, 404);
    }

    // Build update query
    const emailsJson = recipientEmails ? JSON.stringify(recipientEmails) : null;
    
    const result = await c.env.DB.prepare(
      `UPDATE scheduled_reminders 
       SET scheduled_date = COALESCE(?, scheduled_date),
           recipient_emails = COALESCE(?, recipient_emails),
           days_overdue = COALESCE(?, days_overdue),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      scheduledDate || null,
      emailsJson,
      daysOverdue || null,
      reminderId
    ).run();

    if (result.success) {
      return c.json({ success: true });
    } else {
      return c.json({ error: "Failed to update reminder" }, 500);
    }
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return c.json({ error: "Failed to update reminder" }, 500);
  }
});

// Delete scheduled reminder
app.delete("/api/reminders/scheduled/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const reminderId = c.req.param("id");
    const userId = String(user.id);

    // Verify reminder belongs to user
    const reminder = await c.env.DB.prepare(
      "SELECT id FROM scheduled_reminders WHERE id = ? AND user_id = ?"
    ).bind(reminderId, userId).first();

    if (!reminder) {
      return c.json({ error: "Reminder not found" }, 404);
    }

    const result = await c.env.DB.prepare(
      "DELETE FROM scheduled_reminders WHERE id = ?"
    ).bind(reminderId).run();

    if (result.success) {
      return c.json({ success: true });
    } else {
      return c.json({ error: "Failed to delete reminder" }, 500);
    }
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    return c.json({ error: "Failed to delete reminder" }, 500);
  }
});

// Send test email
app.post("/api/reminders/test-send", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { recipientEmails, templateId, invoiceId } = body;

    if (!recipientEmails || !templateId || !invoiceId) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // In a real implementation, this would send actual emails
    // For now, we'll just log the attempt
    console.log("Test send email:", {
      recipients: recipientEmails,
      templateId,
      invoiceId,
      userId: user.id
    });

    // Simulate a small delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return c.json({ 
      success: true,
      message: "Test email sent successfully",
      recipients: recipientEmails
    });
  } catch (error) {
    console.error("Failed to send test email:", error);
    return c.json({ error: "Failed to send test email" }, 500);
  }
});

// Get email provider status
app.get("/api/email-providers/status", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const userId = String(user.id);

    const providers = await c.env.DB.prepare(
      `SELECT provider_name, from_email, from_name, is_active, provider_type, created_at 
       FROM email_providers 
       WHERE user_id = ? AND is_active = 1`
    ).bind(userId).all();

    const configuredProviders: Record<string, { configured: boolean; fromEmail?: string; fromName?: string; providerType?: string }> = {
      mocha: { configured: true, fromEmail: "noreply@timely.app", fromName: "Timely" },
      // API providers
      sendgrid: { configured: false },
      mailchimp: { configured: false },
      sendinblue: { configured: false },
      postmark: { configured: false },
      // SMTP providers (App Password)
      gmail: { configured: false },
      outlook: { configured: false },
      yahoo: { configured: false },
      icloud: { configured: false },
    };

    for (const provider of (providers.results || []) as any[]) {
      if (configuredProviders[provider.provider_name]) {
        configuredProviders[provider.provider_name] = {
          configured: true,
          fromEmail: provider.from_email,
          fromName: provider.from_name,
          providerType: provider.provider_type || 'api',
        };
      }
    }

    return c.json({ providers: configuredProviders });
  } catch (error) {
    console.error("Failed to fetch provider status:", error);
    return c.json({ error: "Failed to fetch provider status" }, 500);
  }
});

// Save email provider configuration
app.post("/api/email-providers", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { providerName, apiKey, fromEmail, fromName, providerType, smtpHost, smtpPort, smtpSecure, smtpUsername } = body;

    if (!providerName || !apiKey) {
      return c.json({ error: "Provider name and credentials are required" }, 400);
    }

    const validApiProviders = ["sendgrid", "mailchimp", "sendinblue", "postmark"];
    const validSmtpProviders = ["gmail", "outlook", "yahoo", "icloud"];
    const allValidProviders = [...validApiProviders, ...validSmtpProviders];
    
    if (!allValidProviders.includes(providerName)) {
      return c.json({ error: "Invalid provider" }, 400);
    }

    // Validate SMTP providers require email
    if (validSmtpProviders.includes(providerName) && !fromEmail) {
      return c.json({ error: "Email address is required for personal email providers" }, 400);
    }

    const userId = String(user.id);

    // Check if provider already exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM email_providers WHERE user_id = ? AND provider_name = ?"
    ).bind(userId, providerName).first();

    if (existing) {
      // Update existing
      await c.env.DB.prepare(
        `UPDATE email_providers 
         SET api_key = ?, from_email = ?, from_name = ?, provider_type = ?, 
             smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_username = ?,
             is_active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(
        apiKey, 
        fromEmail || null, 
        fromName || null, 
        providerType || 'api',
        smtpHost || null,
        smtpPort || null,
        smtpSecure ? 1 : 0,
        smtpUsername || null,
        existing.id
      ).run();
    } else {
      // Create new
      await c.env.DB.prepare(
        `INSERT INTO email_providers (user_id, provider_name, api_key, from_email, from_name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_username, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        userId, 
        providerName, 
        apiKey, 
        fromEmail || null, 
        fromName || null,
        providerType || 'api',
        smtpHost || null,
        smtpPort || null,
        smtpSecure ? 1 : 0,
        smtpUsername || null
      ).run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to save provider:", error);
    return c.json({ error: "Failed to save provider configuration" }, 500);
  }
});

// Delete email provider configuration
app.delete("/api/email-providers/:provider", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const providerName = c.req.param("provider");
    const userId = String(user.id);

    await c.env.DB.prepare(
      "UPDATE email_providers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND provider_name = ?"
    ).bind(userId, providerName).run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to delete provider:", error);
    return c.json({ error: "Failed to delete provider" }, 500);
  }
});

// Update sender email for a provider
app.post("/api/email-providers/update-sender", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { providerName, fromEmail } = body;

    if (!providerName || !fromEmail) {
      return c.json({ error: "Provider name and sender email are required" }, 400);
    }

    const userId = String(user.id);

    // Check if provider exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM email_providers WHERE user_id = ? AND provider_name = ? AND is_active = 1"
    ).bind(userId, providerName).first();

    if (!existing) {
      return c.json({ error: "Provider not found" }, 404);
    }

    // Update the sender email
    await c.env.DB.prepare(
      "UPDATE email_providers SET from_email = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND provider_name = ?"
    ).bind(fromEmail, userId, providerName).run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to update sender email:", error);
    return c.json({ error: "Failed to update sender email" }, 500);
  }
});

// Test send email from template
app.post("/api/templates/test-send", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { provider, emails, subject, body: emailBody, htmlBody } = body;

    if (!emails || emails.length === 0) {
      return c.json({ error: "At least one recipient email is required" }, 400);
    }

    if (!subject || !emailBody) {
      return c.json({ error: "Subject and body are required" }, 400);
    }

    const userId = String(user.id);

    // Get the provider configuration
    const providerConfig = await c.env.DB.prepare(
      "SELECT api_key, from_email, from_name FROM email_providers WHERE user_id = ? AND provider_name = ? AND is_active = 1"
    ).bind(userId, provider).first<{ api_key: string; from_email: string; from_name: string }>();

    // If using third-party provider but not configured
    if (provider !== "mocha" && !providerConfig) {
      return c.json({ 
        error: `${provider} is not configured. Please add your API key in Settings > Email Providers.` 
      }, 400);
    }

    let results: { email: string; success: boolean; error?: string }[] = [];

    // Send based on provider
    switch (provider) {
      case "mocha":
        // Use Mocha's built-in email service
        // Check if EMAILS service is available (not available in dev preview)
        if (!c.env.EMAILS) {
          return c.json({ 
            success: false,
            error: "Mocha Email is only available in the published app. Please publish your app first, then send test emails from the live version.",
            isDevMode: true
          }, 400);
        }
        
        for (const email of emails) {
          try {
            console.log(`[Mocha Email] Sending to ${email}:`, { subject, bodyLength: emailBody.length });
            const result = await c.env.EMAILS.send({
              to: email,
              subject: subject,
              html_body: htmlBody || `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
              text_body: emailBody,
            });
            
            if (result.success) {
              console.log(`[Mocha Email] Sent successfully to ${email}, message_id: ${result.message_id}`);
              results.push({ email, success: true });
            } else {
              console.error(`[Mocha Email] Failed to send to ${email}:`, result.error);
              results.push({ email, success: false, error: result.error || 'Failed to send' });
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed';
            console.error(`[Mocha Email] Error sending to ${email}:`, err);
            
            // Check if this is a dev environment error
            if (errorMsg.includes('socket') || errorMsg.includes('emails-service')) {
              return c.json({ 
                success: false,
                error: "Mocha Email is only available in the published app. Please publish your app and test from the live version at your app's URL.",
                isDevMode: true
              }, 400);
            }
            
            results.push({ email, success: false, error: errorMsg });
          }
        }
        break;

      case "sendgrid":
        if (!providerConfig) {
          return c.json({ error: "SendGrid is not configured" }, 400);
        }
        for (const email of emails) {
          try {
            const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${providerConfig.api_key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email }] }],
                from: { 
                  email: providerConfig.from_email || "noreply@example.com",
                  name: providerConfig.from_name || "Timely"
                },
                subject,
                content: [
                  { type: "text/plain", value: emailBody },
                  ...(htmlBody ? [{ type: "text/html", value: htmlBody }] : [])
                ],
              }),
            });

            if (response.ok || response.status === 202) {
              results.push({ email, success: true });
            } else {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = (errorData as any)?.errors?.[0]?.message || `HTTP ${response.status}`;
              
              // Check for sender verification errors
              const errorText = JSON.stringify(errorData).toLowerCase();
              if (errorText.includes('authorization') && (errorText.includes('invalid') || errorText.includes('expired') || errorText.includes('revoked'))) {
                results.push({ 
                  email, 
                  success: false, 
                  error: `It appears you haven't verified "${providerConfig.from_email}" with SendGrid. Please visit https://app.sendgrid.com/settings/sender_auth to verify your sender identity before sending emails.`
                });
              } else if (errorText.includes('does not contain a verified') || errorText.includes('not a verified sender')) {
                results.push({ 
                  email, 
                  success: false, 
                  error: `The email address "${providerConfig.from_email}" is not verified in your SendGrid account. Please visit https://app.sendgrid.com/settings/sender_auth to verify it.`
                });
              } else {
                results.push({ email, success: false, error: errorMessage });
              }
            }
          } catch (err) {
            results.push({ email, success: false, error: err instanceof Error ? err.message : 'Failed' });
          }
        }
        break;

      case "mailchimp":
        if (!providerConfig) {
          return c.json({ error: "Mailchimp/Mandrill is not configured" }, 400);
        }
        
        // Validate API key format - Mandrill keys don't start with "sk"
        if (providerConfig.api_key.startsWith('sk')) {
          return c.json({ 
            error: "Invalid Mandrill API key. The key you entered appears to be from a different service (possibly Stripe). Mandrill API keys are different from regular Mailchimp API keys. You need to sign up for Mandrill (a paid add-on) at https://mailchimp.com/features/transactional-email/ and generate a Mandrill-specific API key.",
            invalidKeyFormat: true
          }, 400);
        }
        
        for (const email of emails) {
          try {
            const response = await fetch("https://mandrillapp.com/api/1.0/messages/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: providerConfig.api_key,
                message: {
                  from_email: providerConfig.from_email || "noreply@example.com",
                  from_name: providerConfig.from_name || "Timely",
                  to: [{ email, type: "to" }],
                  subject,
                  text: emailBody,
                  ...(htmlBody && { html: htmlBody }),
                },
              }),
            });

            const data = await response.json() as any;
            
            // Check for authentication errors (error response can be object or array)
            const isInvalidKey = (Array.isArray(data) && data[0]?.name === "Invalid_Key") || 
                                (!Array.isArray(data) && data?.name === "Invalid_Key");
            
            if (isInvalidKey) {
              results.push({ 
                email, 
                success: false, 
                error: "Invalid Mandrill API key. Make sure you're using a Mandrill-specific key from https://mandrillapp.com/settings/index, not a regular Mailchimp API key."
              });
            } else if (Array.isArray(data) && (data[0]?.status === "sent" || data[0]?.status === "queued")) {
              results.push({ email, success: true });
            } else {
              const errorMessage = Array.isArray(data) 
                ? (data[0]?.reject_reason || data[0]?.message || "Failed to send")
                : (data?.message || "Failed to send");
              results.push({ email, success: false, error: errorMessage });
            }
          } catch (err) {
            results.push({ email, success: false, error: err instanceof Error ? err.message : 'Failed' });
          }
        }
        break;

      case "sendinblue":
        if (!providerConfig) {
          return c.json({ error: "Brevo/Sendinblue is not configured" }, 400);
        }
        for (const email of emails) {
          try {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: {
                "api-key": providerConfig.api_key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sender: { 
                  email: providerConfig.from_email || "noreply@example.com",
                  name: providerConfig.from_name || "Timely"
                },
                to: [{ email }],
                subject,
                textContent: emailBody,
                ...(htmlBody && { htmlContent: htmlBody }),
              }),
            });

            if (response.ok) {
              results.push({ email, success: true });
            } else {
              const errorData = await response.json().catch(() => ({}));
              results.push({ email, success: false, error: (errorData as any)?.message || `HTTP ${response.status}` });
            }
          } catch (err) {
            results.push({ email, success: false, error: err instanceof Error ? err.message : 'Failed' });
          }
        }
        break;

      case "postmark":
        if (!providerConfig) {
          return c.json({ error: "Postmark is not configured" }, 400);
        }
        for (const email of emails) {
          try {
            const response = await fetch("https://api.postmarkapp.com/email", {
              method: "POST",
              headers: {
                "X-Postmark-Server-Token": providerConfig.api_key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                From: providerConfig.from_email || "noreply@example.com",
                To: email,
                Subject: subject,
                TextBody: emailBody,
                ...(htmlBody && { HtmlBody: htmlBody }),
              }),
            });

            if (response.ok) {
              results.push({ email, success: true });
            } else {
              const errorData = await response.json().catch(() => ({}));
              results.push({ email, success: false, error: (errorData as any)?.Message || `HTTP ${response.status}` });
            }
          } catch (err) {
            results.push({ email, success: false, error: err instanceof Error ? err.message : 'Failed' });
          }
        }
        break;

      // SMTP providers (Gmail, Outlook, Yahoo, iCloud) using MailChannels API
      case "gmail":
      case "outlook":
      case "yahoo":
      case "icloud":
        if (!providerConfig) {
          return c.json({ error: `${provider} is not configured` }, 400);
        }
        for (const email of emails) {
          try {
            // Use MailChannels API (available on Cloudflare Workers)
            const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                personalizations: [{
                  to: [{ email }],
                }],
                from: {
                  email: providerConfig.from_email,
                  name: providerConfig.from_name || providerConfig.from_email?.split('@')[0] || "Timely",
                },
                subject,
                content: [
                  { type: "text/plain", value: emailBody },
                  ...(htmlBody ? [{ type: "text/html", value: htmlBody }] : []),
                ],
              }),
            });

            if (response.ok || response.status === 202) {
              results.push({ email, success: true });
            } else {
              const errorText = await response.text().catch(() => "");
              console.error(`MailChannels error for ${provider}:`, response.status, errorText);
              
              // Provide helpful error message for SMTP providers
              results.push({ 
                email, 
                success: false, 
                error: `Email sending via ${provider} requires additional domain verification. Consider using the built-in Mocha Email or a service like SendGrid for reliable delivery.`
              });
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed';
            console.error(`Error sending via ${provider}:`, err);
            results.push({ email, success: false, error: errorMsg });
          }
        }
        break;

      default:
        return c.json({ error: `Unknown provider: ${provider}` }, 400);
    }

    // Check if all succeeded
    const allSucceeded = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;

    if (allSucceeded) {
      return c.json({ 
        success: true,
        message: `Test email${emails.length > 1 ? 's' : ''} sent successfully`,
        results
      });
    } else if (successCount > 0) {
      return c.json({ 
        success: true,
        message: `${successCount}/${emails.length} emails sent successfully`,
        results
      });
    } else {
      return c.json({ 
        success: false,
        error: results[0]?.error || "Failed to send test emails",
        results
      }, 400);
    }
  } catch (error) {
    console.error("Failed to send test email:", error);
    return c.json({ error: "Failed to send test email" }, 500);
  }
});

// Get email templates
app.get("/api/templates", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const userId = String(user.id);
    
    const templates = await c.env.DB.prepare(
      `SELECT id, name, tone as type, subject, body, is_custom, created_at, updated_at
       FROM email_templates 
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(userId).all();

    const formattedTemplates = (templates.results || []).map((t: any) => ({
      id: String(t.id),
      name: t.name,
      type: t.type || 'blank',
      subject: t.subject,
      body: t.body,
      customHtml: '',
      lastModified: new Date(t.updated_at).toLocaleString("en-US", { 
        month: "short", 
        day: "numeric", 
        hour: "numeric", 
        minute: "2-digit",
        hour12: true 
      }),
    }));

    return c.json({ templates: formattedTemplates });
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return c.json({ error: "Failed to fetch templates" }, 500);
  }
});

// Create email template
app.post("/api/templates", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { name, type, subject, bodyText, customHtml } = body;

    // Validate template name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: "Template name is required" }, 400);
    }

    const trimmedName = name.trim();

    // Validate name format (alphanumeric, spaces, hyphens, underscores only, 1-100 chars)
    if (!/^[a-zA-Z0-9\s\-_]{1,100}$/.test(trimmedName)) {
      return c.json({ 
        error: "Template name can only contain letters, numbers, spaces, hyphens, and underscores (1-100 characters)" 
      }, 400);
    }

    const userId = String(user.id);

    // Check for duplicate name
    const existing = await c.env.DB.prepare(
      "SELECT id FROM email_templates WHERE user_id = ? AND name = ?"
    ).bind(userId, trimmedName).first();

    if (existing) {
      return c.json({ error: "A template with this name already exists" }, 409);
    }

    // Create template
    const result = await c.env.DB.prepare(
      `INSERT INTO email_templates (user_id, name, tone, subject, body, is_custom, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, trimmedName, type || 'blank', subject || '', bodyText || '').run();

    if (result.success) {
      return c.json({ 
        success: true,
        template: {
          id: String(result.meta.last_row_id),
          name: trimmedName,
          type: type || 'blank',
          subject: subject || '',
          body: bodyText || '',
          customHtml: customHtml || '',
        }
      });
    } else {
      return c.json({ error: "Failed to create template" }, 500);
    }
  } catch (error) {
    console.error("Failed to create template:", error);
    return c.json({ error: "Failed to create template" }, 500);
  }
});

// Update email template
app.put("/api/templates/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const templateId = c.req.param("id");
    const body = await c.req.json();
    const { name, type, subject, bodyText } = body;

    // Validate template name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return c.json({ error: "Template name is required" }, 400);
      }

      const trimmedName = name.trim();

      // Validate name format
      if (!/^[a-zA-Z0-9\s\-_]{1,100}$/.test(trimmedName)) {
        return c.json({ 
          error: "Template name can only contain letters, numbers, spaces, hyphens, and underscores (1-100 characters)" 
        }, 400);
      }

      const userId = String(user.id);

      // Check for duplicate name (excluding current template)
      const existing = await c.env.DB.prepare(
        "SELECT id FROM email_templates WHERE user_id = ? AND name = ? AND id != ?"
      ).bind(userId, trimmedName, templateId).first();

      if (existing) {
        return c.json({ error: "A template with this name already exists" }, 409);
      }
    }

    const userId = String(user.id);

    // Verify template belongs to user
    const template = await c.env.DB.prepare(
      "SELECT id FROM email_templates WHERE id = ? AND user_id = ?"
    ).bind(templateId, userId).first();

    if (!template) {
      return c.json({ error: "Template not found" }, 404);
    }

    // Update template
    const result = await c.env.DB.prepare(
      `UPDATE email_templates 
       SET name = COALESCE(?, name),
           tone = COALESCE(?, tone),
           subject = COALESCE(?, subject),
           body = COALESCE(?, body),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      name?.trim() || null,
      type || null,
      subject || null,
      bodyText || null,
      templateId
    ).run();

    if (result.success) {
      return c.json({ success: true });
    } else {
      return c.json({ error: "Failed to update template" }, 500);
    }
  } catch (error) {
    console.error("Failed to update template:", error);
    return c.json({ error: "Failed to update template" }, 500);
  }
});

// Delete email template
app.delete("/api/templates/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const templateId = c.req.param("id");
    const userId = String(user.id);

    // Verify template belongs to user
    const template = await c.env.DB.prepare(
      "SELECT id FROM email_templates WHERE id = ? AND user_id = ?"
    ).bind(templateId, userId).first();

    if (!template) {
      return c.json({ error: "Template not found" }, 404);
    }

    // Delete template
    const result = await c.env.DB.prepare(
      "DELETE FROM email_templates WHERE id = ?"
    ).bind(templateId).run();

    if (result.success) {
      return c.json({ success: true });
    } else {
      return c.json({ error: "Failed to delete template" }, 500);
    }
  } catch (error) {
    console.error("Failed to delete template:", error);
    return c.json({ error: "Failed to delete template" }, 500);
  }
});

// ==================== MAILCHIMP OAUTH ====================

// Mailchimp OAuth: Get authorization URL
app.get("/api/oauth/mailchimp/auth-url", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!c.env.MAILCHIMP_CLIENT_ID) {
    return c.json({ error: "Mailchimp OAuth is not configured. Please add MAILCHIMP_CLIENT_ID in app settings." }, 400);
  }

  const state = btoa(JSON.stringify({ userId: user.id, nonce: crypto.randomUUID() }));
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/oauth/mailchimp/callback`;

  const authUrl = new URL("https://login.mailchimp.com/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", c.env.MAILCHIMP_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return c.json({ authUrl: authUrl.toString() });
});

// Mailchimp OAuth: Complete OAuth (called from React component)
app.post("/api/oauth/mailchimp/complete", async (c) => {
  try {
    const { code, state } = await c.req.json();
    const origin = new URL(c.req.url).origin;
    
    console.log('[Mailchimp OAuth] Starting completion:', { origin, hasCode: !!code, hasState: !!state });
    
    if (!code || !state) {
      return c.json({ error: 'Missing authorization parameters' }, 400);
    }

    const { userId: rawUserId } = JSON.parse(atob(state));
    const userId = String(rawUserId);
    const redirectUri = `${origin}/api/oauth/mailchimp/callback`;
    
    console.log('[Mailchimp OAuth] Decoded state:', { userId, redirectUri });
    
    // Check if secrets are configured
    if (!c.env.MAILCHIMP_CLIENT_ID || !c.env.MAILCHIMP_CLIENT_SECRET) {
      console.error('[Mailchimp OAuth] Missing client credentials');
      return c.json({ error: 'Mailchimp OAuth is not configured. Please add MAILCHIMP_CLIENT_ID and MAILCHIMP_CLIENT_SECRET secrets.' }, 500);
    }

    // Exchange code for access token
    console.log('[Mailchimp OAuth] Exchanging code for token...');
    const tokenResponse = await fetch("https://login.mailchimp.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: c.env.MAILCHIMP_CLIENT_ID,
        client_secret: c.env.MAILCHIMP_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Mailchimp OAuth] Token exchange failed:', { 
        status: tokenResponse.status, 
        statusText: tokenResponse.statusText,
        error: errorText,
        redirectUri 
      });
      return c.json({ 
        error: `Failed to exchange authorization code: ${tokenResponse.status} ${tokenResponse.statusText}. Make sure the redirect URI registered in Mailchimp matches: ${redirectUri}` 
      }, 500);
    }

    console.log('[Mailchimp OAuth] Token exchange successful');
    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Get Mailchimp metadata (API endpoint and account info)
    console.log('[Mailchimp OAuth] Fetching account metadata...');
    const metadataResponse = await fetch("https://login.mailchimp.com/oauth2/metadata", {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('[Mailchimp OAuth] Failed to get metadata:', { status: metadataResponse.status, error: errorText });
      return c.json({ error: "Failed to get account info" }, 500);
    }

    const metadata = await metadataResponse.json() as {
      dc: string;
      accountname: string;
      user_id: string;
      login: { login_id: string; login_name: string; login_email: string };
    };
    
    console.log('[Mailchimp OAuth] Got metadata:', { accountName: metadata.accountname, dc: metadata.dc });

    // Store connection in database
    const existing = await c.env.DB.prepare(
      "SELECT id FROM oauth_connections WHERE user_id = ? AND provider = ?"
    ).bind(userId, "mailchimp").first();

    const accountEmail = metadata.login?.login_email || null;
    
    if (existing) {
      console.log('[Mailchimp OAuth] Updating existing connection');
      await c.env.DB.prepare(
        `UPDATE oauth_connections 
         SET access_token = ?, dc = ?, account_id = ?, account_name = ?, account_email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(accessToken, metadata.dc, metadata.user_id, metadata.accountname, accountEmail, existing.id).run();
    } else {
      console.log('[Mailchimp OAuth] Creating new connection');
      await c.env.DB.prepare(
        `INSERT INTO oauth_connections (user_id, provider, access_token, dc, account_id, account_name, account_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, "mailchimp", accessToken, metadata.dc, metadata.user_id, metadata.accountname, accountEmail).run();
    }

    console.log('[Mailchimp OAuth] Connection saved successfully');
    return c.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error('[Mailchimp OAuth] Completion error:', errorMessage, err);
    return c.json({ error: errorMessage }, 500);
  }
});

// Mailchimp OAuth: Handle callback (MUST be before assets handler)
app.get("/api/oauth/mailchimp/callback", async (c) => {
  const origin = new URL(c.req.url).origin;
  
  // Force return HTML immediately to test if this route is being hit
  console.log('[Mailchimp Callback] ===== ROUTE HIT ===== URL:', c.req.url);
  
  try {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    
    console.log('[Mailchimp Callback] Received callback:', { hasCode: !!code, hasState: !!state, error });
    
    if (error) {
      console.error('[Mailchimp Callback] OAuth error:', error);
      return oauthResultPage(false, `Mailchimp authorization failed: ${error}`, `${origin}/settings/email-providers?error=mailchimp`);
    }

    if (!code || !state) {
      console.error('[Mailchimp Callback] Missing parameters');
      return oauthResultPage(false, 'Missing authorization parameters', `${origin}/settings/email-providers?error=missing_params`);
    }

    // Check if secrets are configured
    if (!c.env.MAILCHIMP_CLIENT_ID || !c.env.MAILCHIMP_CLIENT_SECRET) {
      console.error('[Mailchimp Callback] Missing client credentials');
      return oauthResultPage(false, 'Mailchimp OAuth is not configured on the server', `${origin}/settings/email-providers?error=config`);
    }

    const { userId: rawUserId } = JSON.parse(atob(state));
    const userId = String(rawUserId);
    const redirectUri = `${origin}/api/oauth/mailchimp/callback`;
    
    console.log('[Mailchimp Callback] Processing OAuth for user:', userId);
    console.log('[Mailchimp Callback] Using redirect URI:', redirectUri);

    // Exchange code for access token
    const tokenResponse = await fetch("https://login.mailchimp.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: c.env.MAILCHIMP_CLIENT_ID,
        client_secret: c.env.MAILCHIMP_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Mailchimp Callback] Token exchange failed:', { 
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        redirectUri 
      });
      return oauthResultPage(
        false, 
        `Failed to exchange authorization code. Please verify your redirect URI in Mailchimp is set to: ${redirectUri}`,
        `${origin}/settings/email-providers?error=token_exchange`
      );
    }

    console.log('[Mailchimp Callback] Token exchange successful');
    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Get Mailchimp metadata
    console.log('[Mailchimp Callback] Fetching account metadata...');
    const metadataResponse = await fetch("https://login.mailchimp.com/oauth2/metadata", {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('[Mailchimp Callback] Metadata fetch failed:', errorText);
      return oauthResultPage(false, 'Failed to get account info', `${origin}/settings/email-providers?error=metadata`);
    }

    const metadata = await metadataResponse.json() as {
      dc: string;
      accountname: string;
      user_id: string;
      login: { login_id: string; login_name: string; login_email: string };
    };
    
    console.log('[Mailchimp Callback] Got metadata:', { accountName: metadata.accountname, dc: metadata.dc });

    // Store connection in database
    const existing = await c.env.DB.prepare(
      "SELECT id FROM oauth_connections WHERE user_id = ? AND provider = ?"
    ).bind(userId, "mailchimp").first();

    const accountEmail = metadata.login?.login_email || null;
    
    if (existing) {
      console.log('[Mailchimp Callback] Updating existing connection');
      await c.env.DB.prepare(
        `UPDATE oauth_connections 
         SET access_token = ?, dc = ?, account_id = ?, account_name = ?, account_email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(accessToken, metadata.dc, metadata.user_id, metadata.accountname, accountEmail, existing.id).run();
    } else {
      console.log('[Mailchimp Callback] Creating new connection');
      await c.env.DB.prepare(
        `INSERT INTO oauth_connections (user_id, provider, access_token, dc, account_id, account_name, account_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, "mailchimp", accessToken, metadata.dc, metadata.user_id, metadata.accountname, accountEmail).run();
    }

    console.log('[Mailchimp Callback] Connection saved successfully');
    
    // Use a simpler redirect response to ensure it works
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${origin}/settings/email-providers?connected=mailchimp`
      }
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : '';
    console.error('[Mailchimp Callback] Processing error:', { errorMessage, errorStack, err });
    
    // Return a very simple error page to ensure it renders
    return new Response(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Connection Error</h1>
          <p>Error: ${errorMessage}</p>
          <p><a href="${origin}/settings/email-providers?error=mailchimp">Back to Settings</a></p>
          <pre>${errorStack}</pre>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
});

// Mailchimp OAuth: Get connection status
app.get("/api/oauth/mailchimp/status", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = String(user.id);
  const connection = await c.env.DB.prepare(
    "SELECT account_name, account_id, dc, created_at FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "mailchimp").first<{ account_name: string; account_id: string; dc: string; created_at: string }>();

  if (!connection) {
    return c.json({ connected: false });
  }

  return c.json({
    connected: true,
    accountName: connection.account_name,
    accountId: connection.account_id,
    connectedAt: connection.created_at,
  });
});

// Mailchimp OAuth: Disconnect
app.post("/api/oauth/mailchimp/disconnect", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = String(user.id);
  await c.env.DB.prepare(
    "DELETE FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "mailchimp").run();

  return c.json({ success: true });
});

// Mailchimp: Get audiences (lists)
app.get("/api/oauth/mailchimp/audiences", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = String(user.id);
  const connection = await c.env.DB.prepare(
    "SELECT access_token, dc FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "mailchimp").first<{ access_token: string; dc: string }>();

  if (!connection) {
    return c.json({ error: "Mailchimp not connected" }, 400);
  }

  try {
    const response = await fetch(`https://${connection.dc}.api.mailchimp.com/3.0/lists?count=100`, {
      headers: { Authorization: `OAuth ${connection.access_token}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Mailchimp API error:", errorData);
      return c.json({ error: "Failed to fetch audiences" }, 500);
    }

    const data = await response.json() as { lists: Array<{ id: string; name: string; stats: { member_count: number } }> };

    return c.json({
      audiences: data.lists.map(list => ({
        id: list.id,
        name: list.name,
        memberCount: list.stats.member_count,
      })),
    });
  } catch (err) {
    console.error("Mailchimp audiences error:", err);
    return c.json({ error: "Failed to fetch audiences" }, 500);
  }
});

// Mailchimp: Add contact to audience
app.post("/api/oauth/mailchimp/audiences/:audienceId/contacts", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const audienceId = c.req.param("audienceId");
  const body = await c.req.json();
  const { email, firstName, lastName } = body;

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const userId = String(user.id);
  const connection = await c.env.DB.prepare(
    "SELECT access_token, dc FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "mailchimp").first<{ access_token: string; dc: string }>();

  if (!connection) {
    return c.json({ error: "Mailchimp not connected" }, 400);
  }

  try {
    // Calculate MD5 hash of lowercase email for Mailchimp subscriber ID
    const emailLower = email.toLowerCase();
    const encoder = new TextEncoder();
    const data = encoder.encode(emailLower);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const subscriberHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Use PUT to add or update subscriber (upsert)
    const response = await fetch(
      `https://${connection.dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`,
      {
        method: "PUT",
        headers: {
          Authorization: `OAuth ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email,
          status_if_new: "subscribed",
          merge_fields: {
            ...(firstName && { FNAME: firstName }),
            ...(lastName && { LNAME: lastName }),
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Mailchimp add contact error:", errorData);
      return c.json({ error: (errorData as any)?.detail || "Failed to add contact" }, 500);
    }

    const contact = await response.json() as { id: string; status: string };
    return c.json({ 
      success: true, 
      contactId: contact.id,
      status: contact.status,
    });
  } catch (err) {
    console.error("Mailchimp add contact error:", err);
    return c.json({ error: "Failed to add contact to audience" }, 500);
  }
});

// Mailchimp: Create campaign draft
app.post("/api/oauth/mailchimp/campaigns", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { audienceId, subject, previewText, fromName, htmlContent, textContent } = body;

  if (!audienceId || !subject) {
    return c.json({ error: "Audience and subject are required" }, 400);
  }

  const userId = String(user.id);
  const connection = await c.env.DB.prepare(
    "SELECT access_token, dc, account_email FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "mailchimp").first<{ access_token: string; dc: string; account_email: string | null }>();

  if (!connection) {
    return c.json({ error: "Mailchimp not connected" }, 400);
  }

  if (!connection.account_email) {
    return c.json({ error: "Mailchimp account email not available. Please reconnect your Mailchimp account." }, 400);
  }

  try {
    // Step 1: Create the campaign
    const campaignResponse = await fetch(`https://${connection.dc}.api.mailchimp.com/3.0/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: audienceId },
        settings: {
          subject_line: subject,
          preview_text: previewText || "",
          from_name: fromName || "Timely",
          reply_to: connection.account_email,
        },
      }),
    });

    if (!campaignResponse.ok) {
      const errorData = await campaignResponse.json().catch(() => ({})) as any;
      console.error("Mailchimp create campaign error:", JSON.stringify(errorData, null, 2));
      
      // Extract detailed validation errors
      let errorMessage = errorData?.detail || "Failed to create campaign";
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        const fieldErrors = errorData.errors.map((e: any) => `${e.field}: ${e.message}`).join('; ');
        errorMessage = `${errorMessage}. Details: ${fieldErrors}`;
      }
      
      return c.json({ error: errorMessage, details: errorData }, 500);
    }

    const campaign = await campaignResponse.json() as { id: string; web_id: number; archive_url: string };

    // Step 2: Set campaign content
    if (htmlContent || textContent) {
      const contentResponse = await fetch(`https://${connection.dc}.api.mailchimp.com/3.0/campaigns/${campaign.id}/content`, {
        method: "PUT",
        headers: {
          Authorization: `OAuth ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: htmlContent || `<html><body><p>${(textContent || "").replace(/\n/g, "<br>")}</p></body></html>`,
          plain_text: textContent || "",
        }),
      });

      if (!contentResponse.ok) {
        console.error("Failed to set campaign content, but campaign was created");
      }
    }

    // Return campaign info with link to edit in Mailchimp
    const editUrl = `https://${connection.dc}.admin.mailchimp.com/campaigns/edit?id=${campaign.web_id}`;

    return c.json({
      success: true,
      campaignId: campaign.id,
      editUrl,
      message: "Campaign draft created in Mailchimp",
    });
  } catch (err) {
    console.error("Mailchimp create campaign error:", err);
    return c.json({ error: "Failed to create campaign" }, 500);
  }
});

// ==================== Gmail OAuth ====================

// Gmail OAuth: Get auth URL
app.get("/api/oauth/gmail/auth-url", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!c.env.GMAIL_CLIENT_ID) {
    return c.json({ error: "Gmail OAuth is not configured. Please add GMAIL_CLIENT_ID in app settings." }, 400);
  }

  const state = btoa(JSON.stringify({ userId: user.id, nonce: crypto.randomUUID() }));
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/oauth/gmail/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", c.env.GMAIL_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return c.json({ authUrl: authUrl.toString() });
});

// Gmail OAuth: Complete OAuth (called from React component)
app.post("/api/oauth/gmail/complete", async (c) => {
  try {
    const { code, state } = await c.req.json();
    const origin = new URL(c.req.url).origin;
    
    console.log('[Gmail OAuth] Starting completion:', { origin, hasCode: !!code, hasState: !!state });
    
    if (!code || !state) {
      return c.json({ error: 'Missing authorization parameters' }, 400);
    }

    const { userId: rawUserId } = JSON.parse(atob(state));
    const userId = String(rawUserId);
    const redirectUri = `${origin}/api/oauth/gmail/callback`;
    
    if (!c.env.GMAIL_CLIENT_ID || !c.env.GMAIL_CLIENT_SECRET) {
      console.error('[Gmail OAuth] Missing client credentials');
      return c.json({ error: 'Gmail OAuth is not configured. Please add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET secrets.' }, 500);
    }

    // Exchange code for access token
    console.log('[Gmail OAuth] Exchanging code for token...');
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: c.env.GMAIL_CLIENT_ID,
        client_secret: c.env.GMAIL_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Gmail OAuth] Token exchange failed:', { 
        status: tokenResponse.status, 
        error: errorText,
        redirectUri 
      });
      return c.json({ 
        error: `Failed to exchange authorization code: ${tokenResponse.status}. Make sure the redirect URI registered in Google Cloud matches: ${redirectUri}` 
      }, 500);
    }

    const tokenData = await tokenResponse.json() as { 
      access_token: string; 
      refresh_token?: string;
      expires_in: number;
    };
    
    console.log('[Gmail OAuth] Token exchange successful, fetching user info...');

    // Get user's email
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error('[Gmail OAuth] Failed to get user info');
      return c.json({ error: "Failed to get user info" }, 500);
    }

    const userInfo = await userInfoResponse.json() as { email: string; name?: string };
    console.log('[Gmail OAuth] Got user info:', { email: userInfo.email });

    // Store connection in database
    const existing = await c.env.DB.prepare(
      "SELECT id FROM oauth_connections WHERE user_id = ? AND provider = ?"
    ).bind(userId, "gmail").first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE oauth_connections 
         SET access_token = ?, refresh_token = ?, account_email = ?, account_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(tokenData.access_token, tokenData.refresh_token || null, userInfo.email, userInfo.name || userInfo.email, existing.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO oauth_connections (user_id, provider, access_token, refresh_token, account_email, account_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, "gmail", tokenData.access_token, tokenData.refresh_token || null, userInfo.email, userInfo.name || userInfo.email).run();
    }

    console.log('[Gmail OAuth] Connection saved successfully');
    return c.json({ success: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error('[Gmail OAuth] Completion error:', errorMessage, err);
    return c.json({ error: errorMessage }, 500);
  }
});

// Gmail OAuth: Handle callback
app.get("/api/oauth/gmail/callback", async (c) => {
  const origin = new URL(c.req.url).origin;
  console.log('[Gmail Callback] Route hit, URL:', c.req.url);
  
  try {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    
    if (error) {
      console.error('[Gmail Callback] OAuth error:', error);
      return oauthResultPage(false, `Gmail authorization failed: ${error}`, `${origin}/settings/email-providers?error=gmail`);
    }

    if (!code || !state) {
      return oauthResultPage(false, 'Missing authorization parameters', `${origin}/settings/email-providers?error=gmail`);
    }

    // Return page that posts back to our complete endpoint
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connecting Gmail...</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Connecting to Gmail...</h2>
            <p>Please wait while we complete the connection.</p>
          </div>
          <script>
            (async () => {
              try {
                const response = await fetch('${origin}/api/oauth/gmail/complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: '${code}', state: '${state}' })
                });
                const data = await response.json();
                if (data.success) {
                  window.location.href = '${origin}/settings/email-providers?connected=gmail';
                } else {
                  window.location.href = '${origin}/settings/email-providers?error=gmail&message=' + encodeURIComponent(data.error || 'Unknown error');
                }
              } catch (err) {
                window.location.href = '${origin}/settings/email-providers?error=gmail&message=' + encodeURIComponent(err.message);
              }
            })();
          </script>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (err) {
    console.error('[Gmail Callback] Error:', err);
    return oauthResultPage(false, 'Connection failed', `${origin}/settings/email-providers?error=gmail`);
  }
});

// Gmail OAuth: Check status
app.get("/api/oauth/gmail/status", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = String(user.id);
  const connection = await c.env.DB.prepare(
    "SELECT account_name, account_email, created_at FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "gmail").first<{ account_name: string; account_email: string; created_at: string }>();

  if (!connection) {
    return c.json({ connected: false });
  }

  return c.json({
    connected: true,
    accountName: connection.account_name,
    accountEmail: connection.account_email,
    connectedAt: connection.created_at,
  });
});

// Gmail OAuth: Disconnect
app.post("/api/oauth/gmail/disconnect", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = String(user.id);
  await c.env.DB.prepare(
    "DELETE FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "gmail").run();

  return c.json({ success: true });
});

// Helper: Refresh Gmail access token
async function refreshGmailToken(c: any, connectionId: number, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: c.env.GMAIL_CLIENT_ID,
        client_secret: c.env.GMAIL_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('[Gmail] Failed to refresh token');
      return null;
    }

    const data = await response.json() as { access_token: string };
    
    // Update stored access token
    await c.env.DB.prepare(
      "UPDATE oauth_connections SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(data.access_token, connectionId).run();

    return data.access_token;
  } catch (err) {
    console.error('[Gmail] Token refresh error:', err);
    return null;
  }
}

// Gmail: Create draft
app.post("/api/campaigns/gmail", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { subject, htmlContent, textContent } = body;

  if (!subject) {
    return c.json({ error: "Subject is required" }, 400);
  }

  const userId = String(user.id);
  const connection = await c.env.DB.prepare(
    "SELECT id, access_token, refresh_token, account_email FROM oauth_connections WHERE user_id = ? AND provider = ?"
  ).bind(userId, "gmail").first<{ id: number; access_token: string; refresh_token: string; account_email: string }>();

  if (!connection) {
    return c.json({ error: "Gmail not connected" }, 400);
  }

  let accessToken = connection.access_token;

  // Build RFC 2822 email message
  const emailContent = htmlContent || textContent || "";
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
  
  const rawEmail = [
    `From: ${connection.account_email}`,
    `To: `,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    textContent || emailContent.replace(/<[^>]*>/g, ""),
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    htmlContent || `<html><body>${(textContent || "").replace(/\n/g, "<br>")}</body></html>`,
    `--${boundary}--`,
  ].join("\r\n");

  // Base64url encode the email
  const encodedEmail = btoa(rawEmail)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  async function createDraft(token: string) {
    return fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { raw: encodedEmail }
      }),
    });
  }

  try {
    let response = await createDraft(accessToken);
    
    // If unauthorized, try refreshing the token
    if (response.status === 401 && connection.refresh_token) {
      console.log('[Gmail] Access token expired, refreshing...');
      const newToken = await refreshGmailToken(c, connection.id, connection.refresh_token);
      if (newToken) {
        accessToken = newToken;
        response = await createDraft(accessToken);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gmail] Create draft failed:', { status: response.status, error: errorText });
      return c.json({ error: `Failed to create draft: ${response.status}` }, 500);
    }

    const draft = await response.json() as { id: string; message: { id: string } };
    console.log('[Gmail] Draft created:', draft.id);

    // Gmail drafts can be edited at mail.google.com
    const editUrl = `https://mail.google.com/mail/u/0/#drafts?compose=${draft.message.id}`;

    return c.json({
      success: true,
      draftId: draft.id,
      editUrl,
      message: "Draft created in Gmail",
    });
  } catch (err) {
    console.error('[Gmail] Create draft error:', err);
    return c.json({ error: "Failed to create draft" }, 500);
  }
});

// Brevo: Create campaign draft
app.post("/api/campaigns/brevo", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { subject, htmlContent, textContent, campaignName } = body;

  if (!subject) {
    return c.json({ error: "Subject is required" }, 400);
  }

  const userId = String(user.id);
  const providerConfig = await c.env.DB.prepare(
    "SELECT api_key, from_email, from_name FROM email_providers WHERE user_id = ? AND provider_name = ? AND is_active = 1"
  ).bind(userId, "sendinblue").first<{ api_key: string; from_email: string; from_name: string }>();

  if (!providerConfig || !providerConfig.api_key) {
    return c.json({ error: "Brevo not configured" }, 400);
  }

  if (!providerConfig.from_email) {
    return c.json({ error: "Verified sender email required for Brevo campaigns" }, 400);
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/emailCampaigns", {
      method: "POST",
      headers: {
        "api-key": providerConfig.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
        subject: subject,
        sender: {
          name: providerConfig.from_name || "Timely",
          email: providerConfig.from_email,
        },
        htmlContent: htmlContent || `<html><body><p>${(textContent || "").replace(/\n/g, "<br>")}</p></body></html>`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as any;
      console.error("Brevo create campaign error:", JSON.stringify(errorData, null, 2));
      return c.json({ error: errorData?.message || "Failed to create campaign" }, 500);
    }

    const campaign = await response.json() as { id: number };
    const editUrl = `https://app.brevo.com/camp/step2/${campaign.id}`;

    return c.json({
      success: true,
      campaignId: campaign.id,
      editUrl,
      message: "Campaign draft created in Brevo",
    });
  } catch (err) {
    console.error("Brevo create campaign error:", err);
    return c.json({ error: "Failed to create campaign" }, 500);
  }
});

// SendGrid: Create single send (marketing campaign)
app.post("/api/campaigns/sendgrid", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { subject, htmlContent, textContent, campaignName } = body;

  if (!subject) {
    return c.json({ error: "Subject is required" }, 400);
  }

  const userId = String(user.id);
  const providerConfig = await c.env.DB.prepare(
    "SELECT api_key, from_email, from_name FROM email_providers WHERE user_id = ? AND provider_name = ? AND is_active = 1"
  ).bind(userId, "sendgrid").first<{ api_key: string; from_email: string; from_name: string }>();

  if (!providerConfig || !providerConfig.api_key) {
    return c.json({ error: "SendGrid not configured" }, 400);
  }

  if (!providerConfig.from_email) {
    return c.json({ error: "Verified sender email required for SendGrid campaigns" }, 400);
  }

  try {
    // SendGrid Marketing Campaigns API - Create Single Send
    const response = await fetch("https://api.sendgrid.com/v3/marketing/singlesends", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${providerConfig.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
        send_to: { all: true },
        email_config: {
          subject: subject,
          sender_id: null, // Will use verified sender
          html_content: htmlContent || `<html><body><p>${(textContent || "").replace(/\n/g, "<br>")}</p></body></html>`,
          plain_content: textContent || "",
          generate_plain_content: !textContent,
          custom_unsubscribe_url: "",
          suppression_group_id: null,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as any;
      console.error("SendGrid create campaign error:", JSON.stringify(errorData, null, 2));
      
      // Check for common issues
      if (errorData?.errors) {
        const errorMessages = errorData.errors.map((e: any) => e.message).join('; ');
        return c.json({ error: errorMessages || "Failed to create campaign" }, 500);
      }
      return c.json({ error: "Failed to create campaign. Make sure you have Marketing Campaigns enabled in SendGrid." }, 500);
    }

    const campaign = await response.json() as { id: string };
    const editUrl = `https://mc.sendgrid.com/single-sends/${campaign.id}/build`;

    return c.json({
      success: true,
      campaignId: campaign.id,
      editUrl,
      message: "Single send draft created in SendGrid",
    });
  } catch (err) {
    console.error("SendGrid create campaign error:", err);
    return c.json({ error: "Failed to create campaign" }, 500);
  }
});

// Postmark: Create email template
app.post("/api/campaigns/postmark", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { subject, htmlContent, textContent, templateName } = body;

  if (!subject) {
    return c.json({ error: "Subject is required" }, 400);
  }

  const userId = String(user.id);
  const providerConfig = await c.env.DB.prepare(
    "SELECT api_key, from_email, from_name FROM email_providers WHERE user_id = ? AND provider_name = ? AND is_active = 1"
  ).bind(userId, "postmark").first<{ api_key: string; from_email: string; from_name: string }>();

  if (!providerConfig || !providerConfig.api_key) {
    return c.json({ error: "Postmark not configured" }, 400);
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/templates", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": providerConfig.api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        Name: templateName || `Template - ${new Date().toLocaleDateString()}`,
        Subject: subject,
        HtmlBody: htmlContent || `<html><body><p>${(textContent || "").replace(/\n/g, "<br>")}</p></body></html>`,
        TextBody: textContent || "",
        TemplateType: "Standard",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as any;
      console.error("Postmark create template error:", JSON.stringify(errorData, null, 2));
      return c.json({ error: errorData?.Message || "Failed to create template" }, 500);
    }

    const template = await response.json() as { TemplateId: number; Alias: string };
    const editUrl = `https://account.postmarkapp.com/servers/${providerConfig.api_key.substring(0, 8)}/templates/${template.TemplateId}/edit`;

    return c.json({
      success: true,
      templateId: template.TemplateId,
      editUrl,
      message: "Email template created in Postmark",
    });
  } catch (err) {
    console.error("Postmark create template error:", err);
    return c.json({ error: "Failed to create template" }, 500);
  }
});

// Get PayPal invoices
app.get("/api/invoices/paypal", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const userId = String(user.id);
    console.log('Fetching PayPal invoices for user:', userId);
    
    // First try to get invoices for this user
    let invoices = await c.env.DB.prepare(
      `SELECT id, invoice_number, client_name, client_email, amount, due_date, status, 
              payment_date, external_id, created_at, updated_at
       FROM invoices 
       WHERE user_id = ? AND integration_source = ?
       ORDER BY created_at DESC`
    ).bind(userId, "paypal").all();

    // If no invoices found for this user, check if there are any PayPal invoices at all
    // and adopt them to this user (for single-user apps)
    if (invoices.results?.length === 0) {
      const allPayPalInvoices = await c.env.DB.prepare(
        `SELECT id FROM invoices WHERE integration_source = ?`
      ).bind("paypal").all();
      
      if (allPayPalInvoices.results && allPayPalInvoices.results.length > 0) {
        console.log('Found', allPayPalInvoices.results.length, 'orphaned PayPal invoices - adopting to current user');
        // Update all PayPal invoices to belong to current user
        await c.env.DB.prepare(
          `UPDATE invoices SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE integration_source = ?`
        ).bind(userId, "paypal").run();
        
        // Re-fetch after adoption
        invoices = await c.env.DB.prepare(
          `SELECT id, invoice_number, client_name, client_email, amount, due_date, status, 
                  payment_date, external_id, created_at, updated_at
           FROM invoices 
           WHERE user_id = ? AND integration_source = ?
           ORDER BY created_at DESC`
        ).bind(userId, "paypal").all();
      }
    }

    console.log('Returning', invoices.results?.length || 0, 'invoices');

    return c.json({ 
      invoices: invoices.results || [],
      debug: {
        currentUserId: userId,
        foundForUser: invoices.results?.length || 0
      }
    });
  } catch (error) {
    console.error("Failed to fetch PayPal invoices:", error);
    return c.json({ error: "Failed to fetch invoices" }, 500);
  }
});

// Assets handler - only for non-API routes
app.get("*", (c) => {
  const path = new URL(c.req.url).pathname;
  
  // Never serve assets for API routes - they should have been handled above
  if (path.startsWith('/api/')) {
    return c.json({ error: 'API endpoint not found' }, 404);
  }
  
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
