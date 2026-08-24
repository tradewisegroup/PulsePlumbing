CREATE TABLE leads (
  lead_ref            TEXT PRIMARY KEY,
  created_at          TEXT NOT NULL,
  name                TEXT NOT NULL,
  company             TEXT,
  email               TEXT NOT NULL,
  phone_e164          TEXT NOT NULL,
  suburb              TEXT,
  service_type        TEXT,
  industry            TEXT,
  message             TEXT,
  source_form         TEXT NOT NULL,
  first_source        TEXT,
  first_medium        TEXT,
  first_campaign      TEXT,
  first_landing_page  TEXT,
  first_seen_at       TEXT,
  last_source         TEXT,
  last_medium         TEXT,
  last_campaign       TEXT,
  gclid               TEXT,
  converted_on        TEXT,
  ga_client_id        TEXT
);

CREATE INDEX idx_leads_email   ON leads(email);
CREATE INDEX idx_leads_phone   ON leads(phone_e164);
CREATE INDEX idx_leads_created ON leads(created_at);
