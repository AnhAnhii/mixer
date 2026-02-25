# Mixer — Hệ thống Quản lý Bán hàng & CRM

> Vietnamese e-commerce management SaaS for online sellers.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite 6 |
| **Styling** | Tailwind CSS (CDN) + CSS Variables (Theme Engine) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **Hosting** | Vercel (Static + Serverless Functions) |
| **AI** | Google Gemini (`@google/genai`) |
| **Messaging** | Facebook Messenger API (Webhook + Send) |
| **Shipping** | ViettelPost API |
| **Payment** | VnPay + VietQR |
| **Data Sync** | Google Sheets (Apps Script) |

---

## 📁 Project Structure

```
mixer/
├── index.html          # Entry point (Tailwind CDN + Theme Engine CSS)
├── index.tsx            # React root
├── App.tsx              # Main app (~1000 lines, client-side routing, all business logic)
├── types.ts             # All TypeScript interfaces & enums
├── config.ts            # Environment variable management
│
├── components/          # ~50 React components
│   ├── Dashboard.tsx
│   ├── FacebookInbox.tsx        # Largest component (~76KB), Facebook Messenger CRM
│   ├── OrderListPage.tsx
│   ├── OrderForm.tsx
│   ├── OrderDetailModal.tsx
│   ├── CustomerListPage.tsx
│   ├── InventoryList.tsx
│   ├── ProductForm.tsx
│   ├── ReportsPage.tsx
│   ├── SocialPage.tsx           # Facebook post automation
│   ├── StaffManagement.tsx
│   ├── SettingsPage.tsx
│   ├── ProfilePage.tsx
│   ├── VoucherListPage.tsx
│   ├── ReturnsPage.tsx
│   ├── AutomationPage.tsx
│   ├── KanbanBoardPage.tsx
│   ├── AiBusinessCoPilot.tsx    # AI chat assistant
│   ├── ConversationParser.tsx   # AI order parsing
│   ├── InvoicePage.tsx
│   ├── LoginPage.tsx
│   ├── CommandPalette.tsx       # Ctrl+K command palette
│   ├── icons.tsx                # Custom SVG icons
│   ├── skeletons/               # Loading skeletons
│   └── charts/                  # Chart components
│
├── services/            # Business logic / API calls
│   ├── supabaseService.ts       # Main CRUD service (~27KB)
│   ├── facebookService.ts       # Facebook Graph API
│   ├── aiChatService.ts         # Gemini AI integration
│   ├── cartService.ts           # Cart/order logic
│   └── googleSheetsService.ts   # Google Sheets sync
│
├── hooks/               # Custom React hooks
│   ├── useSupabase.ts           # Supabase data fetching
│   ├── useSupabaseAuth.ts       # Auth state management
│   ├── useData.ts               # Local data management
│   ├── useAuth.ts
│   ├── useLocalStorage.ts
│   └── useSessionStorage.ts
│
├── api/                 # Vercel Serverless Functions
│   ├── facebook/                # Facebook API proxy
│   │   ├── conversations.ts
│   │   ├── messages.ts
│   │   ├── send.ts
│   │   └── mark-seen.ts
│   ├── webhook/
│   │   └── facebook.ts          # Incoming webhook handler
│   ├── ai/                      # AI proxy endpoints
│   └── sheets/                  # Google Sheets proxy
│
├── lib/
│   └── supabase.ts              # Supabase client init
│
├── utils/
│   ├── validation.ts
│   └── retry.ts
│
├── data/
│   ├── sampleData.ts            # Demo/seed data
│   └── banks.ts                 # Vietnamese bank codes
│
├── docs/
│   ├── google_sheets_script.js  # Google Apps Script source
│   ├── social_configs_schema.sql
│   └── virtual_cart_schema.sql
│
└── vercel.json          # Vercel routing config
```

---

## 🎨 Theme Engine

4 palettes defined via CSS variables in `index.html`:
- **Modern** (default) — Indigo primary
- **Elegant** (dark) — Slate/Indigo
- **Classic** — Blue/Green
- **Glass** — Glassmorphism with blur

Additional settings: `density` (comfortable/compact), `style` (rounded/sharp).

---

## 🔑 Key Patterns

| Pattern | Description |
|---|---|
| **SPA Routing** | Client-side via `currentPage` state in `App.tsx` |
| **State Management** | React `useState` + `useLocalStorage` (no Redux/Zustand) |
| **Data Layer** | Dual: Supabase (production) + localStorage (fallback/demo) |
| **API Proxy** | Serverless functions in `/api/` to hide secrets from client |
| **AI Integration** | Gemini for order parsing, chat copilot, content generation |
| **Messaging** | Facebook Messenger webhooks for customer communication |
| **i18n** | Vietnamese-first UI, English code |

---

## 📊 Data Models (types.ts)

Core entities: `Product`, `Order`, `Customer`, `Voucher`, `User`, `Role`, `ReturnRequest`, `AutomationRule`, `ActivityLog`.

Order flow: `Pending → Processing → Shipped → Delivered` (or `Cancelled`).

---

## ⚙️ Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_GEMINI_API_KEY` | Google Gemini AI |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_GOOGLE_SCRIPT_URL` | Google Apps Script endpoint |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Facebook Page token (server-side only) |

---

## 🚀 Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Build for production
npm run preview  # Preview production build
```

---

## 📌 Important Notes

- `App.tsx` is the monolithic entry point containing all routing and business logic (~1000 lines). Consider refactoring for large changes.
- `FacebookInbox.tsx` is the largest component (~76KB). It handles the entire Messenger CRM flow.
- Tailwind is loaded via CDN (not installed locally). Custom theme uses CSS variables.
- No test framework is currently set up.
- Vietnamese language is used for all user-facing strings and enum values.
