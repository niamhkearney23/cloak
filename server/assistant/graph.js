// Microsoft 365 (Outlook) connection through Microsoft Graph.
//
// The mailbox owner signs in once (OAuth 2.0 authorisation code + PKCE). We
// keep a refresh token in the encrypted store and use it to read mail and the
// calendar, create reply drafts, and send the fixed acknowledgement and the
// daily summary.

import crypto from 'node:crypto';

export const SCOPES = ['offline_access', 'openid', 'profile', 'User.Read', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite', 'Contacts.Read'];
const GRAPH = 'https://graph.microsoft.com/v1.0';

export function msConfigFromEnv(env = process.env) {
  if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.CLOAK_PUBLIC_URL) return null;
  return {
    clientId: env.MS_CLIENT_ID,
    clientSecret: env.MS_CLIENT_SECRET,
    tenant: env.MS_TENANT_ID || 'organizations',
    redirectUri: `${env.CLOAK_PUBLIC_URL.replace(/\/$/, '')}/assistant/callback`,
  };
}

export function pkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function authorizeUrl(ms, { state, challenge }) {
  const q = new URLSearchParams({
    client_id: ms.clientId,
    response_type: 'code',
    redirect_uri: ms.redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(ms.tenant)}/oauth2/v2.0/authorize?${q}`;
}

async function tokenRequest(ms, params, fetchImpl) {
  const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(ms.tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: ms.clientId, client_secret: ms.clientSecret, scope: SCOPES.join(' '), ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || `Microsoft sign-in failed (${res.status})`);
    err.code = data.error;
    throw err;
  }
  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) - 120) * 1000,
  };
}

export function exchangeCode(ms, { code, verifier }, fetchImpl = fetch) {
  return tokenRequest(ms, { grant_type: 'authorization_code', code, redirect_uri: ms.redirectUri, code_verifier: verifier }, fetchImpl);
}

/**
 * A Graph client for one mailbox. getTokens/saveTokens let it refresh the
 * access token and persist the new refresh token.
 */
export function createGraph({ ms, getTokens, saveTokens, fetchImpl = fetch }) {
  async function accessToken() {
    let t = await getTokens();
    if (!t) throw Object.assign(new Error('The mailbox is not connected.'), { code: 'not_connected' });
    if (!t.access || Date.now() >= t.expiresAt) {
      try {
        const fresh = await tokenRequest(ms, { grant_type: 'refresh_token', refresh_token: t.refresh }, fetchImpl);
        t = { ...fresh, refresh: fresh.refresh || t.refresh };
        await saveTokens(t);
      } catch (err) {
        if (err.code === 'invalid_grant') err.code = 'reconnect';
        throw err;
      }
    }
    return t.access;
  }

  async function call(method, pathOrUrl, { body, headers = {} } = {}) {
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH}${pathOrUrl}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429 || res.status === 503) {
        const wait = Math.min(Number(res.headers.get('retry-after') || 5), 30);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      if (res.status === 204 || res.status === 202) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error(data.error?.message || `Microsoft 365 error ${res.status}`), { status: res.status, code: data.error?.code });
      }
      return data;
    }
    throw new Error('Microsoft 365 is busy. Will try again on the next check.');
  }

  async function all(path, max = 2000) {
    const out = [];
    let next = path;
    while (next && out.length < max) {
      const page = await call('GET', next);
      out.push(...(page.value || []));
      next = page['@odata.nextLink'];
    }
    return out;
  }

  const TEXT = { Prefer: 'outlook.body-content-type="text"' };

  return {
    me: () => call('GET', '/me?$select=displayName,mail,userPrincipalName'),

    /** Inbox messages received after `sinceIso`, oldest first. */
    async newMessages(sinceIso, top = 25) {
      const q = new URLSearchParams({
        $filter: `receivedDateTime ge ${sinceIso}`,
        $orderby: 'receivedDateTime asc',
        $top: String(top),
        $select: 'id,subject,from,receivedDateTime,isDraft',
      });
      return (await call('GET', `/me/mailFolders/inbox/messages?${q}`)).value || [];
    },

    /** One message, as plain text. uniqueBody is only the new part of a thread. */
    message: (id) => call('GET', `/me/messages/${encodeURIComponent(id)}?$select=id,subject,body,uniqueBody,from,sender,toRecipients,ccRecipients,replyTo,receivedDateTime,conversationId,internetMessageHeaders,hasAttachments,inferenceClassification,categories`, { headers: TEXT }),

    createReplyDraft: (id, comment) => call('POST', `/me/messages/${encodeURIComponent(id)}/createReply`, { body: { comment } }),

    /** Delete a reply draft, but only if it is still an unsent draft. */
    async deleteDraft(id) {
      let m;
      try {
        m = await call('GET', `/me/messages/${encodeURIComponent(id)}?$select=id,isDraft`);
      } catch (err) {
        if (err.status === 404) return false;
        throw err;
      }
      if (!m || m.isDraft !== true) return false;
      await call('DELETE', `/me/messages/${encodeURIComponent(id)}`);
      return true;
    },

    reply: (id, comment) => call('POST', `/me/messages/${encodeURIComponent(id)}/reply`, { body: { comment } }),

    async addCategory(id, category, existing = []) {
      if (existing.includes(category)) return;
      await call('PATCH', `/me/messages/${encodeURIComponent(id)}`, { body: { categories: [...existing, category] } });
    },

    sendMail: ({ to, subject, html }) => call('POST', '/me/sendMail', {
      body: {
        message: { subject, body: { contentType: 'HTML', content: html }, toRecipients: to.map((address) => ({ emailAddress: { address } })) },
        saveToSentItems: true,
      },
    }),

    calendar(startIso, endIso) {
      const q = new URLSearchParams({
        startDateTime: startIso,
        endDateTime: endIso,
        $select: 'subject,start,end,location,attendees,organizer,isAllDay,isCancelled,isOnlineMeeting',
        $orderby: 'start/dateTime',
        $top: '50',
      });
      return all(`/me/calendarView?${q}`, 100);
    },

    contacts: () => all('/me/contacts?$select=displayName,emailAddresses,companyName&$top=200'),

    /**
     * Pencil an entry into the calendar. No attendees are added, so no
     * invitations are sent to anyone. Times are UTC ISO strings; all-day
     * entries use plain dates (YYYY-MM-DD).
     */
    createEvent: ({ subject, startUtc, endUtc, allDay, startDate, endDate, location, note }) => call('POST', '/me/events', {
      body: {
        subject,
        isAllDay: !!allDay,
        start: allDay ? { dateTime: `${startDate}T00:00:00`, timeZone: 'UTC' } : { dateTime: startUtc.replace(/Z$/, ''), timeZone: 'UTC' },
        end: allDay ? { dateTime: `${endDate}T00:00:00`, timeZone: 'UTC' } : { dateTime: endUtc.replace(/Z$/, ''), timeZone: 'UTC' },
        showAs: 'tentative',
        categories: ['Cloak suggestion'],
        isReminderOn: true,
        reminderMinutesBeforeStart: allDay ? 24 * 60 : 60,
        location: location ? { displayName: location } : undefined,
        body: { contentType: 'text', content: note || '' },
        responseRequested: false,
      },
    }),
  };
}
