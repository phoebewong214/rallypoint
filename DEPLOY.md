# Deploying RallyPoint to the cloud

Goal: real users can sign up, receive a verification email, and sign in.

**Stack:** Frontend on **Vercel**, Backend + Postgres on **Render**, email via **Resend**.

> 🔑 Put the frontend and backend on **subdomains of the same domain**
> (`app.yourdomain.com` + `api.yourdomain.com`). The login cookie is
> `SameSite=Lax`, which is only sent between same-site origins. Using two
> different platform domains (`*.vercel.app` + `*.onrender.com`) would break
> login because they are cross-site.

Replace `yourdomain.com` below with your real domain everywhere.

---

## Phase 1 — Email (Resend)  ⏱ do this first; DNS takes time

1. Create an account at https://resend.com
2. **Add your domain**: Resend → Domains → Add Domain → `yourdomain.com`.
3. Resend shows a few **DNS records** (SPF + DKIM, sometimes DMARC). Add them at
   your domain registrar (where you bought the domain). Wait until Resend marks
   the domain **Verified** (minutes to a few hours).
4. **Get an API key**: Resend → API Keys → Create. Copy it (`re_...`).
5. You'll use these as SMTP settings later:
   - `SMTP_HOST = smtp.resend.com`
   - `SMTP_PORT = 587`
   - `SMTP_USER = resend`
   - `SMTP_PASSWORD = <your re_... API key>`
   - `SMTP_FROM = RallyPoint <no-reply@yourdomain.com>`  (must be on the verified domain)

---

## Phase 2 — Push code to GitHub

The repo is already at `github.com/phoebewong214/rallypoint`. Merge this auth
branch into `main` (or deploy from the branch). Both platforms auto-deploy on
push.

---

## Phase 3 — Backend + Database (Render)

1. https://render.com → New → **Blueprint** → pick the `rallypoint` repo.
   Render reads [`render.yaml`](render.yaml) and creates the API + a Postgres DB.
2. When prompted (or in the service's **Environment** tab) fill the `sync:false`
   vars:
   - `APP_BASE_URL = https://app.yourdomain.com`
   - `CORS_ORIGINS = https://app.yourdomain.com`
   - `COOKIE_DOMAIN = .yourdomain.com`
   - `SMTP_HOST = smtp.resend.com`, `SMTP_USER = resend`,
     `SMTP_PASSWORD = <re_... key>`, `SMTP_FROM = RallyPoint <no-reply@yourdomain.com>`
   (`SECRET_KEY` and `DATABASE_URL` are set automatically.)
3. After the first deploy, **create the tables**: Render → your service →
   **Shell** tab → run:
   ```
   python manage.py init-db
   ```
4. Confirm it's up: open `https://<your-render-url>/api/health` → `{"status":"ok"}`.

---

## Phase 4 — Frontend (Vercel)

1. https://vercel.com → New Project → import the `rallypoint` repo.
2. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (Build `npm run build`, Output `build`)
   - **Environment Variable:** `VITE_API_URL = https://api.yourdomain.com/api`
3. Deploy.

---

## Phase 5 — Custom domains

1. **Vercel** → your project → Settings → Domains → add `app.yourdomain.com`.
   Add the CNAME it shows at your registrar.
2. **Render** → your service → Settings → Custom Domain → add
   `api.yourdomain.com`. Add the CNAME it shows.
3. Wait for both to go green (HTTPS is automatic).

---

## Phase 6 — Final wiring & test

1. Make sure these point at the real domains, then redeploy if you changed them:
   - Render: `APP_BASE_URL=https://app.yourdomain.com`,
     `CORS_ORIGINS=https://app.yourdomain.com`, `COOKIE_DOMAIN=.yourdomain.com`
   - Vercel: `VITE_API_URL=https://api.yourdomain.com/api`
2. Open `https://app.yourdomain.com`, sign up with a **real email you own**.
3. You should receive the verification email → click the link → it returns to
   the app verified → you can use it / sign in.

---

## Gotchas / checklist

- **Login fails after deploy?** Almost always the same-site cookie issue: confirm
  frontend = `app.yourdomain.com`, backend = `api.yourdomain.com`, and
  `COOKIE_DOMAIN=.yourdomain.com`, `COOKIE_SECURE=true`.
- **CORS error in console?** `CORS_ORIGINS` must exactly equal the frontend URL
  (scheme + host, no trailing slash).
- **Emails go to spam / not sent?** Resend domain must be *Verified*; `SMTP_FROM`
  must use that domain.
- **First request very slow?** Render free tier sleeps; upgrade the plan to keep
  it warm. Free Postgres also expires (~30 days) — upgrade for real users.
- **Never commit secrets.** `.env` is gitignored; real secrets live only in the
  Render/Vercel dashboards.
