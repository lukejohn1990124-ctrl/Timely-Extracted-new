/**
 * PayPal OAuth and API integration
 * Implements secure OAuth 2.0 flow with token encryption
 */

import { encrypt, decrypt } from './encryption';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
}

interface PayPalTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface PayPalUserInfo {
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

interface PayPalInvoice {
  id: string;
  status: string;
  detail: {
    invoice_number: string;
    currency_code: string;
  };
  amount: {
    currency_code: string;
    value: string;
  };
  due_amount?: {
    currency_code: string;
    value: string;
  };
  invoicer: {
    name?: {
      given_name?: string;
      surname?: string;
    };
    email_address?: string;
  };
  primary_recipients: Array<{
    billing_info: {
      name?: {
        given_name?: string;
        surname?: string;
      };
      email_address?: string;
    };
  }>;
  due_date?: string;
  invoice_date?: string;
}

function getPayPalApiBase(clientId: string): string {
  // Use sandbox API if client ID starts with 'A' (sandbox pattern)
  return clientId.startsWith('A') 
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

export function getPayPalAuthUrl(config: PayPalConfig, state: string): string {
  const params = new URLSearchParams({
    flowEntry: 'static',
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid profile email https://uri.paypal.com/services/invoicing',
    redirect_uri: config.redirectUri,
    state,
  });

  // Use sandbox URL if client ID starts with 'A' (sandbox pattern), otherwise use production
  const baseUrl = config.clientId.startsWith('A') 
    ? 'https://www.sandbox.paypal.com' 
    : 'https://www.paypal.com';
  
  return `${baseUrl}/signin/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  config: PayPalConfig
): Promise<{ accessToken: string; refreshToken: string }> {
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
  const apiBase = getPayPalApiBase(config.clientId);
  
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`PayPal token exchange failed: ${response.statusText}`);
  }

  const data: PayPalTokenResponse = await response.json();
  
  // Encrypt tokens before returning
  const encryptedAccessToken = await encrypt(data.access_token, config.encryptionKey);
  const encryptedRefreshToken = await encrypt(data.refresh_token, config.encryptionKey);

  return {
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
  };
}

export async function refreshAccessToken(
  encryptedRefreshToken: string,
  config: PayPalConfig
): Promise<string> {
  const refreshToken = await decrypt(encryptedRefreshToken, config.encryptionKey);
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
  const apiBase = getPayPalApiBase(config.clientId);
  
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`PayPal token refresh failed: ${response.statusText}`);
  }

  const data: PayPalTokenResponse = await response.json();
  return await encrypt(data.access_token, config.encryptionKey);
}

export async function fetchPayPalUserInfo(
  encryptedAccessToken: string,
  encryptionKey: string,
  clientId: string
): Promise<PayPalUserInfo> {
  const accessToken = await decrypt(encryptedAccessToken, encryptionKey);
  const apiBase = getPayPalApiBase(clientId);
  
  const response = await fetch(
    `${apiBase}/v1/identity/openid-userinfo?schema=openid`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`PayPal user info fetch failed: ${response.statusText}`);
  }

  return await response.json() as PayPalUserInfo;
}

export async function fetchPayPalInvoices(
  encryptedAccessToken: string,
  encryptionKey: string,
  clientId: string
): Promise<PayPalInvoice[]> {
  const accessToken = await decrypt(encryptedAccessToken, encryptionKey);
  const apiBase = getPayPalApiBase(clientId);
  
  const response = await fetch(
    `${apiBase}/v2/invoicing/invoices?page=1&page_size=100&total_required=true`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PayPal invoice fetch error:', response.status, errorText);
    throw new Error(`PayPal invoice fetch failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as { items?: PayPalInvoice[] };
  return data.items || [];
}

export async function fetchPayPalAccountInfo(
  encryptedAccessToken: string,
  encryptionKey: string,
  clientId: string
): Promise<{ accountId: string; balance: { currency: string; value: string } | null }> {
  const accessToken = await decrypt(encryptedAccessToken, encryptionKey);
  const apiBase = getPayPalApiBase(clientId);
  
  // Fetch user info to get account ID (payer_id)
  const userInfoResponse = await fetch(
    `${apiBase}/v1/identity/openid-userinfo?schema=openid`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!userInfoResponse.ok) {
    const errorText = await userInfoResponse.text();
    console.error('PayPal account info fetch error:', userInfoResponse.status, errorText);
    throw new Error(`PayPal account info fetch failed: ${userInfoResponse.status} ${userInfoResponse.statusText}`);
  }

  const userInfo = await userInfoResponse.json() as { payer_id?: string; user_id?: string };
  console.log('PayPal user info response:', userInfo);
  const accountId = userInfo.payer_id || userInfo.user_id || 'Unknown';

  // Try to fetch balance (may not be available in sandbox)
  let balance = null;
  try {
    const balanceResponse = await fetch(
      `${apiBase}/v1/reporting/balances`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json() as { 
        balances?: Array<{ currency: string; available_balance: { value: string } }> 
      };
      if (balanceData.balances && balanceData.balances.length > 0) {
        const primaryBalance = balanceData.balances[0];
        balance = {
          currency: primaryBalance.currency,
          value: primaryBalance.available_balance?.value || '0.00'
        };
      }
    }
  } catch (e) {
    // Balance fetch may fail in sandbox - that's okay
    console.log('Balance fetch failed (normal in sandbox):', e);
  }

  return { accountId, balance };
}
