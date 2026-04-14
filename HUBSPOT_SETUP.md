# HubSpot Forms Setup — Pulse Plumbing & Gas

Step-by-step guide to creating the three forms and retrieving all IDs needed
for the environment variables.

---

## Step 1 — Find Your Portal ID

1. Log in to **app.hubspot.com**
2. Click your **account name** in the top-right corner
3. Your Portal ID is the number shown beneath your account name (e.g. `12345678`)
4. Copy it — this is your `HUBSPOT_PORTAL_ID`

---

## Step 2 — Create the Main Quote / Contact Form

This form handles all standard quote requests from the website.

### 2a — Create the form

1. In HubSpot, go to **Marketing → Forms**
2. Click **Create form** (top right)
3. Select **Embedded form** → click **Next**
4. Choose **Blank template** → click **Start**

### 2b — Add these fields (in order)

Click **Add field** for each one:

| Field label | Field name (internal) | Type | Required |
|---|---|---|---|
| First name | `firstname` | Single-line text | Yes |
| Last name | `lastname` | Single-line text | No |
| Email | `email` | Email | Yes |
| Phone number | `phone` | Phone number | Yes |
| Company name | `company` | Single-line text | No |
| Service type | `service_type` | Dropdown | No |
| Industry | `industry` | Single-line text | No |
| Suburb | `suburb` | Single-line text | No |
| Message | `message` | Multi-line text | No |
| Preferred contact time | `preferred_time` | Single-line text | No |

### 2c — Configure the Service Type dropdown options

Click the **Service type** field → **Edit options** → add:

- Emergency
- Blocked Drain
- Hot Water System
- Gas Fitting
- Leak Detection
- Drain Camera (CCTV)
- Backflow Prevention
- Maintenance
- Commercial
- Residential
- Other

### 2d — Add hidden fields

Click **Add field** → search for "Hidden" → add a **Hidden field** for each:

| Label | Internal name | Default value |
|---|---|---|
| Source | `source` | Website |
| Page source | `page_source` | *(leave blank — set by form)* |
| UTM Source | `utm_source` | *(leave blank)* |
| UTM Medium | `utm_medium` | *(leave blank)* |
| UTM Campaign | `utm_campaign` | *(leave blank)* |

### 2e — Configure form settings

1. Click **Options** tab (top of form editor)
2. **What should happen after a visitor submits this form?**
   → Select **Display an inline thank you message**
   → Message: *"Thanks! We'll call you within 2 hours."*
3. Turn off **Always create contact for new email address** if you want deduplication
4. Under **Send a follow-up email** — skip for now (optional)

### 2f — Name and publish

1. Click **Update** (top right) to save
2. Name it: `Pulse Plumbing — Quote Request`
3. Click **Publish**

### 2g — Get the Form ID

1. Go to **Marketing → Forms**
2. Click your form name
3. Look at the URL — it will be:
   `https://app.hubspot.com/forms/12345678/editor/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
4. The long string after `/editor/` is your **Form GUID**
5. Copy it — this is your `HUBSPOT_FORM_ID`

**Alternative:** Click **Actions → Share** on the form — the embed code contains
`portalId` and `formId` values.

---

## Step 3 — Create the Civil RFQ Form

This form handles B2B civil project enquiries from the `/civil` section.

### 3a — Create the form

1. Go to **Marketing → Forms** → **Create form**
2. **Embedded form** → **Blank template** → **Start**

### 3b — Add these fields

| Field label | Field name (internal) | Type | Required |
|---|---|---|---|
| Company name | `company` | Single-line text | Yes |
| Contact name | `firstname` | Single-line text | Yes |
| Last name | `lastname` | Single-line text | No |
| Job title | `jobtitle` | Single-line text | No |
| Email | `email` | Email | Yes |
| Phone number | `phone` | Phone number | Yes |
| Project type | `project_type` | Dropdown | Yes |
| Estimated project value | `project_value` | Dropdown | No |
| Project location | `project_location` | Single-line text | No |
| Project description | `message` | Multi-line text | Yes |
| Project timeline | `start_date` | Single-line text | No |
| How did you find us? | `how_found` | Single-line text | No |

### 3c — Project Type dropdown options

- Sewer Construction
- Water Mains
- Stormwater
- Infrastructure Maintenance
- Pump Stations
- Civil Earthworks
- Other

### 3d — Estimated Project Value dropdown options

- Under $100K
- $100K – $250K
- $250K – $500K
- $500K – $1M
- $1M+
- TBD / Not yet determined

### 3e — Add hidden fields

| Label | Internal name |
|---|---|
| Industry | `industry` — set default value to `Civil` |
| UTM Source | `utm_source` |
| UTM Medium | `utm_medium` |
| UTM Campaign | `utm_campaign` |

### 3f — Configure settings

1. **Options** tab → thank you message:
   *"Enquiry received. We'll be in touch within one business day."*
2. Name it: `Pulse Plumbing — Civil RFQ`
3. Click **Publish**

### 3g — Get the Form ID

Same as Step 2g — copy the GUID from the URL.
This is your `HUBSPOT_CIVIL_FORM_ID`

---

## Step 4 — Set Up the Contact Pipeline (Optional but recommended)

This creates a deal pipeline so civil enquiries appear separately from
residential leads.

1. Go to **CRM → Deals** → **Manage pipelines** (top right)
2. Click **Create pipeline**
3. Name it: `Civil Projects`
4. Add stages:
   - New Enquiry
   - Qualified Lead
   - Proposal Sent
   - Negotiation
   - Won
   - Lost

---

## Step 5 — Create a Workflow for Civil Leads (Optional)

Automatically move civil form submissions into the Civil pipeline.

1. Go to **Automation → Workflows** → **Create workflow**
2. **Contact-based** → **Start from scratch**
3. Trigger: **Form submission** → select `Pulse Plumbing — Civil RFQ`
4. Action: **Create deal** → Pipeline: `Civil Projects` → Stage: `New Enquiry`
5. Name it: `Civil RFQ → Deal` → **Turn on**

---

## Step 6 — Add IDs to Vercel

1. Go to **vercel.com** → your project → **Settings → Environment Variables**
2. Add:

| Variable | Value |
|---|---|
| `HUBSPOT_API_BASE` | `https://api-ap1.hsforms.com` |
| `HUBSPOT_PORTAL_ID` | `443056537` |
| `HUBSPOT_FORM_ID` | `9d9a067f-b4f6-466a-b1bc-0efb495811a0` |
| `HUBSPOT_CIVIL_FORM_ID` | `6174dda2-026e-406e-a62b-0f65a410fd2b` |

3. Go to **Deployments** → latest deployment → **⋯ → Redeploy**

---

## Quick Reference

```
HUBSPOT_API_BASE=https://api-ap1.hsforms.com
HUBSPOT_PORTAL_ID=443056537
HUBSPOT_FORM_ID=9d9a067f-b4f6-466a-b1bc-0efb495811a0
HUBSPOT_CIVIL_FORM_ID=6174dda2-026e-406e-a62b-0f65a410fd2b
```

Emergency enquiries go direct to phone — no form needed.
