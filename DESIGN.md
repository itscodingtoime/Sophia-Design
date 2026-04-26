# Sophia Design Playground

A clean-slate copy of the SOPHIA frontend, set up so you can redesign freely without worrying about the backend, auth, or breaking the original codebase.

**Live at:** http://localhost:5174/

```bash
cd /Users/michaelferraris/Desktop/Sophia-Design
npm run dev
```

Hot reload is on — save any file and the browser refreshes.

---

## What's been built

### Pages
| Route | File | Purpose |
|-------|------|---------|
| `/home` | `src/pages/Home.tsx` | Landing page — calendar, latest insight banner, meeting reflections, team-health graph, glowing orb, team switcher |
| `/chat` | `src/pages/SophiaChat.tsx` | Pure chat with the glowing orb + collapsible right rail (goals, working on, recent insights) |
| `/calendar` | `src/pages/CalendarView.tsx` | Calendar |
| `/studio` | `src/pages/RecordStudio.tsx` | Upload + recording |
| `/profile` | `src/pages/ProfilePage.tsx` | Profile (legacy, still routed) |

`Culture Health` is gone — `/culture-health` redirects to `/home`. The sidebar nav now reads: Home · SOPHIA · Calendar · Studio.

### Components
- **`SophiaGlowOrb`** (`src/components/SophiaGlowOrb.tsx`) — pastel rainbow glowing orb with the white "sophia" wordmark. Pure CSS, animated.
- **`MotivationRadar`** (`src/components/MotivationRadar.tsx`) — 7-axis radar chart (Achievement, Influence, Connection, Autonomy, Recognition, Purpose, Growth) with optional team-avg overlay.
- **`MotivationPanel`** (`src/components/MotivationPanel.tsx`) — slide-over panel showing radar + dominant/lowest drivers + blind spots. Triggered by clicking your sidebar avatar, any participant name on the Home page, or "View overall team motivation".

### Brand
- Fonts copied from `Innersystems - Brand Identity/Typography/` to `public/fonts/`. Tomorrow (body) + Futura (headings, replaces the old Josefin Sans) + Roboto + Wide + Agrandir.
- Wordmark uses existing `sophia-wordmark-white.png`.
- Colour palette unchanged from the original `theme.ts` — edit there for global colour tweaks.

### Mock data (`src/mock-data.ts`)
- **You** = Mikey Ferraris, Founder & CEO. To use your real photo, drop a file at `public/mikey.jpg` — the avatar picks it up automatically. No code change needed.
- **Teams**: InnerSystems, Product, Engineering.
- **Members**: Mikey, Ben Carter, Sara Williams, Leo Park, Priya Shah, Tom Davis (with motivational profiles).
- **5 sample meetings** with `what_was_good`, `blind_spots`, and a coaching `insight`.
- **Latest insight summary** rolling across unread meetings (the "Check latest insight" banner).
- **Trending data** — 12 weeks of team health.
- **Calendar events** for the next 7 days.
- **3 auto-derived goals** shown in the chat right rail.

To change anything in the UI: edit `mock-data.ts` and the screens update.

### What's NOT real
- No backend (FastAPI + Supabase) — all data canned.
- No real Clerk auth — you're always "signed in" as Mikey.
- No real Anthropic streaming — typing in the chat returns a stub coaching response.

---

## Where to make design changes

| Want to change... | Edit... |
|---|---|
| Colours (global) | `src/theme.ts` — the `C.*` tokens |
| Fonts | `src/theme/fonts.css` — `--font-body`, `--font-heading`, `--font-display` |
| Tailwind tokens | `tailwind.config.js` |
| Sidebar layout / nav items | `src/layouts/AppSidebar.tsx` |
| Home page layout / sections | `src/pages/Home.tsx` |
| Meeting reflection card style | `src/pages/Home.tsx` (`ReflectionBlock`) |
| Trending graph style | `src/pages/Home.tsx` ("Team health" section) |
| Glowing orb (gradient, glow strength) | `src/components/SophiaGlowOrb.tsx` |
| Radar chart axes, colours | `src/components/MotivationRadar.tsx` |
| Mikey's drivers / blind spots | `src/mock-data.ts` |

---

## Insights pile-up logic

Currently the latest insight banner shows a rolling summary across all unread meetings (`mock-data.ts → latestInsight`). Unread meetings have a green dot on the card. When you "check" an insight in real life, it'd flip `unread: false` — for now you can dismiss the banner with the X.

Want richer pile-up condensation logic (e.g. group by week, fold older into "11 more from this month")? That'd live in `src/pages/Home.tsx` where the banner is rendered.

---

## To swap in your photo

1. Save your photo (jpg/png) as `Sophia-Design/public/mikey.jpg`
2. Reload http://localhost:5174/
3. The avatar in the bottom-left and any participant `Mikey Ferraris` shows the photo. If the file isn't there, the initials block "MF" is the fallback.
