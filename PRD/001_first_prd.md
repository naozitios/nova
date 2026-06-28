# PRD Update: Hidden Configuration Architecture & AI Roadmap

## Updated Product Goals

1. Allow agencies to manage campaigns through an intuitive visual interface that represents the desired state of their marketing infrastructure.
2. Persist every campaign internally as a declarative JSON configuration, which acts as the system's single source of truth.
3. Hide the underlying JSON completely during MVP 1—users never edit or even see configuration files.
4. Automatically generate execution plans, version history, rollback, and drift detection from the internal JSON state.
5. Build the platform so future interaction methods (AI, API, CLI) all operate on the same underlying configuration model.
6. Launch with Meta Ads while keeping the architecture platform-agnostic for future Google, TikTok, and Instagram support.

---

# Core Product Philosophy

> **Users should never have to think in JSON.**
>
> The JSON exists purely as the internal representation of campaign state. Every interaction—whether through forms today or AI tomorrow—ultimately reads from and writes to the same underlying configuration.

The product should feel much closer to **AWS Console** than **Terraform**.

Terraform remains the implementation model under the hood, while the user experience remains approachable for marketers.

---

# Layered Architecture

```text
                 Future AI Assistant
                        │
                        ▼
             Natural Language Layer
                        │
                        ▼
          Form-Based Campaign Builder (MVP)
                        │
                        ▼
          Campaign Configuration Engine
              (Internal JSON Only)
                        │
                        ▼
           Planner / Versioning / State
                        │
                        ▼
             Platform Connectors
     Meta → Google → TikTok → Instagram
```

Unlike Terraform, there is **no public configuration layer** exposed to users.

All interfaces—forms today and AI tomorrow—interact with the same underlying configuration engine.

---

# Updated System Architecture

## 1. User Interaction Layer

This is the only layer users interact with during MVP.

Rather than editing JSON or configuration files, users manage campaigns through guided forms similar to the AWS Management Console.

Typical inputs include:

* Campaign Name
* Campaign Objective
* Budget
* Target Audience
* Placements
* Creative Assets
* Scheduling

These forms represent the **desired state** of the campaign.

When users save changes, the platform automatically updates the underlying campaign configuration.

The JSON remains completely hidden.

---

## 2. Campaign Configuration Engine

This is the heart of the platform.

Every campaign is stored internally as a declarative JSON document.

```text
Campaign
    └── Ad Sets
            └── Ads
```

The Configuration Engine is responsible for:

* Generating JSON from user input
* Validating campaign configuration
* Versioning every change
* Computing diffs
* Supporting rollback
* Producing the Internal Representation (IR) consumed by downstream services

Users never directly interact with this layer.

---

## Why Hide the JSON?

This follows the same philosophy as AWS:

* Beginners interact with forms.
* Advanced functionality comes from the underlying declarative model.
* Future interfaces can reuse the exact same engine.

The product gains all the benefits of Infrastructure as Code without requiring marketers to become developers.

---

# Updated Data Flow

## MVP 1

```text
Campaign Builder Forms
          │
          ▼
Internal Campaign Configuration
      (Hidden JSON)
          │
          ▼
Planner
          │
          ▼
State Store
          │
          ▼
Connector Layer
          │
          ▼
Meta Marketing API
```

The hidden JSON becomes the single source of truth for the entire system.

---

## Future AI Workflow

```text
AI Assistant
      │
      ▼
"Increase all Singapore campaign budgets by 20%"
      │
      ▼
Campaign Configuration Engine
      │
      ▼
Update Internal JSON
      │
      ▼
Generate Execution Plan
      │
      ▼
Apply Changes
```

The AI never communicates directly with Meta or other ad platforms.

Instead, it modifies the same internal configuration used by every other interface, ensuring:

* Version history
* Rollback
* Audit logging
* Approval workflows
* Drift detection

remain consistent regardless of how a change was initiated.

---

# Product Roadmap

## MVP 1 — Visual Campaign Builder

Users interact exclusively through guided forms.

The platform automatically:

* Generates internal JSON
* Maintains campaign state
* Tracks versions
* Computes execution plans
* Detects configuration drift
* Synchronizes with Meta Ads

The configuration layer is completely hidden.

Think:

> **AWS Console backed by CloudFormation.**

---

## MVP 2 — AI Campaign Assistant

Introduce a natural-language interface on top of the Campaign Builder.

Example prompts:

* "Increase budgets for all Singapore campaigns by 15%."
* "Duplicate this campaign for Australia."
* "Pause campaigns spending below target ROAS."
* "Create a lookalike audience from my best-performing campaign."

The AI never bypasses the platform.

Instead, it updates the internal configuration, allowing the existing Planner and Apply Engine to generate an execution plan before deploying changes.

```text
AI Prompt
      │
      ▼
Configuration Engine
      │
      ▼
Execution Plan
      │
      ▼
Apply
```

This ensures the AI becomes another interface—not another source of truth.

---

# Long-Term Vision

The platform should support multiple ways of interacting with the exact same campaign infrastructure.

```text
            Forms (MVP)
                │
                │
          AI Assistant
                │
                │
        Future Public API
                │
                │
          Future CLI / SDK
                │
                ▼
      Campaign Configuration Engine
           (Hidden JSON)
                ▼
        Planner / Versioning / State
                ▼
         Platform Connectors
                ▼
      Meta / Google / TikTok / etc.
```

Regardless of whether changes originate from forms, AI, APIs, or automation, every action flows through the same configuration engine. This creates a single source of truth for campaign infrastructure while preserving versioning, approvals, rollback, and auditability across the platform.
