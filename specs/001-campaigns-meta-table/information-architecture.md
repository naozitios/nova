# Nova — Information Architecture

## 1. Navigation

Three top-level pages only.

```
Overview
Campaigns
Settings
```

## 2. Site Map

```
Nova
├── Overview
│   ├── Time range selector (1D, 1W, 1M, YTD, Custom)
│   ├── Main metric cards (Spend, ROAS, CPA, Pacing)
│   ├── AI performance summary
│   ├── Insight / Action cards
│   └── Recent changes
│
├── Campaigns
│   ├── Campaign list
│   ├── Saved views
│   ├── Export current view
│   ├── Schedule report
│   ├── Create Campaign flow
│   └── Campaign Detail
│       ├── Overview
│       ├── Ad Sets
│       ├── Ads
│       ├── Creatives
│       ├── Tracking Health
│       ├── UTMs
│       └── Change History
│
└── Settings
    ├── Connections
    ├── Tracking Diagnostics
    ├── Naming Rules
    ├── UTM Rules
    ├── Approval Rules
    ├── Report Schedules
    ├── Team Access
    └── Billing
```

---

## 3. Page Specifications

## 3.1 Overview

**Answers:**

How are my ads doing, what changed, what matters, and what should I do next?

| Section | What it shows |
| --- | --- |
| Time Range Selector | Today, Yesterday, Last 7 days, This week, Last week, Month to date, Custom. Default: Last 7 days |
| Main Metric Cards | Spend, Revenue, ROAS, CPA/CPL, Purchases/Leads, CTR, CVR, Frequency, Pacing |
| AI Performance Summary | Plain-English summary of what happened in the selected time period |
| Insight / Action cards | 1 Card showing the call out, evidence, impact, and recommended next step |
| Recent Changes | Budget changes, new ads, paused ads, tracking issues, UTM changes |

### Insight / Action cards

| Field | Purpose | Example |
| --- | --- | --- |
| Title | The main issue or opportunity | CPA increased on Prospecting Campaign |
| Category | Type of insight/action | Performance, Budget, Creative, Tracking, Setup, Scaling |
| Severity | How urgent or important it is | Critical, Warning, Opportunity, Informational |
| Affected Object | The campaign object involved | Campaign, Ad Set, Ad, Creative, Tracking Event, URL |
| What Happened | Plain-English explanation of the movement | CPA increased from $22 to $31 over the last 7 days |
| Why It Matters | Business or media-buying implication | Spend increased but purchases dropped, so efficiency is worsening |
| Evidence | Supporting metrics and visual proof | Spend +18%, Purchases -12%, CPA $22 → $31, small trend chart |
| Recommended Action | What Nova suggests doing next | Review ad-level performance or pause weak ads |
| CTA | What the user can do | Approve, Dismiss, Edit, Deep Dive |

---

## 3.2 Campaigns

**Answers:**

What is happening inside each campaign, ad set, ad, and creative?

How do I save, export, or schedule the report view I am looking at?

---

### 3.2.1 Campaign List

Campaigns should work like a clean database UI for paid media.

| Area | Content |
| --- | --- |
| Fields | Campaign name, status, objective, budget, spend, results, CPA/ROAS, CTR, CVR, health status, recommendations, last changed |
| Filters | Time range, status, objective, market, platform, health status, has recommendations, has tracking issues |
| Controls | Customize columns, save view, export view, schedule report |
| Main CTA | Create Campaign |
| Row CTA | Open Campaign Detail |

---

### 3.2.2 Saved Views / Reports

Reports should not be a separate tab.

A report is simply a saved campaign table view.

A saved view stores:

```
Selected columns
Column order
Filters
Sort order
Time range
Breakdown level
View name
Owner
```

Users can:

```
Save current view
Export current view
Schedule current view
```

Export formats:

```
CSV
Excel
PDF later
```

Scheduled report settings:

```
Saved view
Recipients
Frequency
Delivery time
Timezone
Format
Email subject
```

---

### 3.2.3 Create Campaign Flow

**Answers:**

How do I turn a simple brief and assets into a clean campaign ready for review?

Create Campaign lives inside Campaigns.

```
Campaigns → Create Campaign
```

Flow:

```
Brief
↓
Assets
↓
AI Plan
↓
Naming & UTMs
↓
Validation
↓
Review
↓
Deploy Paused
```

| Step | Content |
| --- | --- |
| Brief | Brand/account, objective, market, budget, landing page, pixel event, targeting direction, notes |
| Assets | Uploaded files or folder/Drive source, preview, validation |
| AI Plan | Campaign structure, ad set structure, ad copy, asset mapping, budget allocation |
| Naming & UTMs | Campaign/ad set/ad names, UTM source/medium/campaign/content, destination URLs |
| Validation | Required fields, budget, objective, pixel event, assets, UTMs, naming rules, paused status |
| Review | Object counts, warnings/errors, final approval |
| Deploy Paused | Upload assets → create campaign → create ad sets → create creatives → create ads → save Meta IDs |

Execution model: AI plans and recommends, backend validates, user approves, backend executes, and Meta remains the system of record.

---

### 3.2.4 Campaign Detail

**Answers:**

Why is this campaign performing this way?

| Section | Content |
| --- | --- |
| Campaign Summary | Name, status, objective, budget, spend, results, CPA/ROAS, pacing, conversion event |
| AI Campaign Readout | Plain-English explanation of what is driving performance |
| Key Issues / Opportunities | Ranked list of campaign-specific issues or opportunities |
| Recommended Action Cards | Campaign-specific recommendations only |
| Trend Charts | Spend, results/revenue, CPA/ROAS, CTR/CVR, frequency |
| Detail Tabs | Overview, Ad Sets, Ads, Creatives, Tracking, UTMs, Change History |

### Campaign Detail Tabs

| Tab | Answers | Contains |
| --- | --- | --- |
| Overview | How is this campaign doing overall? | Summary metrics, AI readout, callouts, actions, trend charts |
| Ad Sets | Which ad set is helping or hurting? | Budget, spend, results, CPA/ROAS, CTR, CVR, frequency, health, recommendations |
| Ads | Which ads should we keep, pause, or investigate? | Creative preview, spend, results, CPA/ROAS, CTR, CVR, frequency, status |
| Creatives | Which creatives are working? | Preview, asset type, spend, results, CPA/ROAS, CTR, fatigue signals |
| Tracking | Can we trust the conversion data? | Pixel event, event volume, consistency, missing event warnings |
| UTMs | Are links and reporting parameters clean? | Destination URL, UTM fields, missing UTM warnings, naming mismatches |
| Change History | What changed recently? | Budget changes, status changes, new/paused ads, tracking changes, Nova/manual actions |

---

## 3.3 Settings

**Answers:**

What accounts, tracking, naming, UTM, approval, report schedule, and team rules power Nova?

| Section | Content |
| --- | --- |
| Connections | Meta account, ad account, Business Manager, connection/permission status |
| Tracking Diagnostics | Pixel, conversion event, event health |
| Naming Rules | Campaign/ad set/ad naming format, required fields, validation rules |
| UTM Rules | UTM source, medium, campaign, content, term, required fields |
| Approval Rules | What Nova can recommend, what it can execute, what always needs approval, budget/risk thresholds |
| Report Schedules | Saved view, recipients, frequency, delivery time, format, status, last/next send |
| Team Access | Users, roles, permissions, approval rights |
| Billing | Plan and payment management |

---

## 4. Object Model

### Account / Platform

```
Brand
Platform
Ad Account
Market
Currency
```

### Campaign Structure

```
Campaign
↓
Ad Set
↓
Ad
↓
Creative / Asset
```

### Performance

```
Metric
Performance Snapshot
Trend
Anomaly
Benchmark
Pacing Status
Breakdown
```

### AI / Action

```
Insight
Callout
Recommendation
Action
Approval
Validation Check
Deployment
Change Log
```

### Tracking / Governance

```
Pixel Event
Conversion Event
UTM
Naming Convention
Destination URL
Tracking Issue
CAPI Status
```

### Reporting

```
Saved View
Column Set
Filter Set
Report Schedule
Export
Recipient
Report Format
```

---

## 5. Object → Page Mapping

| Object | Overview | Campaigns | Settings |
| --- | --- | --- | --- |
| Brand | Yes | Yes | Yes |
| Platform | Yes | Yes | Yes |
| Ad Account | Yes | Yes | Yes |
| Campaign | Yes | Yes | No |
| Ad Set | Limited | Yes | No |
| Ad | Limited | Yes | No |
| Creative | Limited | Yes | No |
| Metric | Yes | Yes | No |
| Trend | Yes | Yes | No |
| Anomaly | Yes | Yes | No |
| Insight | Yes | Yes | No |
| Recommendation | Yes | Yes | Limited |
| Action | Yes | Yes | Limited |
| Approval | Limited | Limited | Yes |
| Pixel Event | Yes | Yes | Yes |
| UTM | Limited | Yes | Yes |
| Saved View | No | Yes | Yes |
| Report Schedule | No | Yes | Yes |

---

## 6. Key User Flows

### Overview Check-In

```
Open Overview
↓
Select time range
↓
Review metric cards
↓
Read AI summary
↓
Review callouts
↓
Open evidence
↓
Approve, dismiss, or deep dive
```

### Campaign Deep Dive

```
Open callout from Overview
↓
Land on Campaign Detail
↓
Review AI campaign readout
↓
Inspect tabs: Ad Sets / Ads / Creatives / Tracking
↓
Take action or dismiss recommendation
```

### Create Campaign

```
Open Campaigns
↓
Click Create Campaign
↓
Enter brief
↓
Upload/select assets
↓
Review AI plan
↓
Review naming and UTMs
↓
Pass validation
↓
Deploy paused
```

### Save / Export / Schedule Report

```
Open Campaigns
↓
Select columns and filters
↓
Save view
↓
Export current view
or
Schedule saved view
```

---

## 7. V1 Scope

| Area | Include in V1 |
| --- | --- |
| Navigation | Overview, Campaigns, Settings |
| Overview | Metric cards, AI summary, callouts, evidence cards, action cards |
| Campaigns | Campaign list, filters, column customization, saved views, export, schedule |
| Campaign Detail | Overview, Ad Sets, Ads, Creatives, Tracking, UTMs, Change History |
| Create | Campaign creation flow inside Campaigns |
| Settings | Connections, tracking, naming, UTM rules, approval rules, report schedules, team access |
| Actions | Contextual cards only |
| Reports | Saved/exported/scheduled views only |

---

## 8. Later Scope

```
Google Ads
TikTok Ads
PDF reports
AI-written report summaries
Creative fatigue detection
Hook / angle analysis
Video metrics
CAPI diagnostics
Budget reallocation recommendations
Approval chains
Client workspaces
Advanced audit logs
```

---

## 9. Key Principle

Nova should not be:

```
Dashboard + AI chatbot + campaign table + separate reports tab
```

Nova should be:

```
Overview surfaces what matters.
Campaigns provides the evidence, creation flow, saved views, exports, and scheduled reports.
Settings controls the system rules.
```