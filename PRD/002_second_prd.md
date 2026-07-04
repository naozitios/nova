# Product Requirements Document (PRD)

# Optimization Workspace

**Version:** 1.0
**Status:** Draft
**Owner:** Product

---

# Overview

Add these sections to the top bar 

1. Account Health & Tracking Auditor
2. Optimization Copilot
3. Action Center

These sections serves as the operational hub for media buyers, allowing them to monitor account health, identify optimization opportunities, and safely execute improvements through a human approval workflow.

---

# Problem Statement

Media buyers currently spend significant time switching between dashboards, manually identifying performance issues, validating tracking configurations, and executing repetitive optimization tasks.

Problems include:

* Tracking issues are discovered too late.
* Performance opportunities are missed.
* Recommendations live across multiple dashboards.
* Execution requires many manual steps.
* No centralized workflow for AI-generated recommendations.

---

# Goals

### Primary Goals

* Surface account issues proactively.
* Generate explainable optimization recommendations.
* Centralize optimization actions.
* Keep humans in control of execution.

### Success Metrics

* Reduced time spent auditing accounts.
* Increased adoption of AI recommendations.
* Faster optimization turnaround.
* Reduction in account configuration issues.
* Percentage of AI recommendations approved.

---

# Navigation

Add a new top-level navigation item:

```
Home

Campaigns

Optimization Workspace   ← New

Settings
```

---

# Information Architecture

```

├── Account Health
├── Optimization Copilot
└── Action Center
```

Each module should be accessible via tabs within the workspace.

---

# Module 1 — Account Health & Tracking Auditor

## Purpose

Ensure advertising accounts are configured correctly before optimization decisions are made.

Many performance issues originate from tracking problems rather than campaign performance.

---

## Dashboard Layout

### Account Health Score

Displayed prominently at the top.

Example

```
81 / 100

Healthy
```

Color Coding

* Green
* Yellow
* Red

---

## Health Summary

Display

* Total Critical Issues
* Total Warnings
* Total Passed Checks

Example

```
Critical Issues

2

Warnings

5

Passed Checks

41
```

---

## Audit Categories

### Tracking

Checks

* Meta Pixel status
* Conversion API status
* Event coverage
* Event duplication
* Missing events
* Event Match Quality

---

### Attribution

Checks

* Attribution settings
* Event prioritization
* Domain verification

---

### UTM Governance

Checks

* Missing UTMs
* Invalid UTMs
* Naming inconsistencies

---

### Naming Conventions

Checks

* Campaign naming
* Ad Set naming
* Ad naming

---

## Issue Card

Each issue contains

```
Severity

Category

Finding

Evidence

Recommendation

Status
```

Example

```
Critical

Tracking

Conversion API not configured.

Recommendation

Configure CAPI to improve attribution accuracy.

Status

Open
```

---

## Outputs

Example findings

* Missing Purchase event detected
* Conversion API not configured
* Event duplication detected
* Missing UTM parameters
* Invalid UTM naming
* Campaign naming violation

---

# Module 2 — Optimization Copilot

## Purpose

Continuously monitor campaign performance and recommend optimization opportunities.

The Copilot should explain both *what* happened and *why*, enabling media buyers to make confident decisions.

---

## Performance Monitoring

Continuously monitor

* Spend
* CPA
* ROAS
* CTR
* CPC
* CPM
* Frequency
* Conversion Rate

Metrics should support selectable time windows.

Examples

* Today
* Yesterday
* Last 7 Days
* Last 30 Days

---

## Opportunity Detection

### Creative Fatigue

Signals

* Increasing Frequency
* Falling CTR
* Falling Conversion Rate

Recommendation

* Refresh creatives
* Launch new creative variants

---

### Scaling Opportunities

Signals

* CPA below target
* Stable ROAS
* Positive trend

Recommendation

* Increase campaign budget
* Increase spend cap

---

### Budget Waste

Signals

* High spend
* Low conversions
* CPA above target

Recommendation

* Reduce budget
* Pause campaigns
* Pause ad sets

---

### Performance Decline

Signals

* Sudden CPA increase
* ROAS decline
* CTR deterioration

Recommendation

Investigate

* Creative
* Audience
* Landing page
* Tracking

---

## Recommendation Card

Each recommendation contains

```
Finding

Evidence

Likely Cause

Recommended Action

Expected Impact

Confidence
```

Example

```
Finding

CPA increased 34% over the last 7 days.

Evidence

CTR decreased from 2.3% to 1.4%.

Likely Cause

Creative fatigue.

Recommended Action

Reduce budget by 20%.

Rotate creatives.

Expected Impact

Estimated CPA reduction of 18%.

Confidence

High
```

---

## Recommendation States

* New
* Reviewed
* Approved
* Dismissed
* Executed

---

# Module 3 — Action Center

## Purpose

Provide a centralized workspace where users review, approve, reject, and execute AI-generated optimization actions.

This becomes the primary operational interface for media buyers.

---

## Action Queue

Each action includes

```
Action

Source

Priority

Risk

Estimated Impact

Status
```

---

## Action Categories

### Scale

Examples

* Increase budget
* Increase spend cap

---

### Reduce

Examples

* Reduce budget
* Pause campaigns
* Pause ad sets
* Pause ads

---

### Fix

Examples

* Configure Conversion API
* Add missing UTMs
* Correct naming issues
* Resolve tracking issues

---

### Launch

Examples

* Create campaign
* Create ad set
* Create ad
* Publish draft campaign

---

## Approval Workflow

```
AI Recommendation

↓

User Review

↓

Approve / Reject

↓

Execute

↓

Completed
```

Version 1

* No automatic execution.
* All actions require explicit human approval.

---

## Action Details

Each action should display

* Description
* Why it was recommended
* Evidence
* Expected impact
* Estimated risk
* Affected campaigns
* Approval history

---

## Bulk Actions

Support

* Bulk approve
* Bulk reject
* Bulk dismiss

---

# User Flow

```
Optimization Workspace

↓

Account Health

↓

Issues detected

↓

Optimization Copilot

↓

Recommendations generated

↓

Action Center

↓

Human approval

↓

Execution

↓

Status updated
```

---

# Permissions

### Admin

* Full access
* Approve actions
* Execute actions

### Media Buyer

* View recommendations
* Approve actions
* Execute actions

### Viewer

* Read-only access

---

# Non-Functional Requirements

* Near real-time metric refresh.
* Responsive UI for desktop and tablet.
* Support multiple ad accounts.
* Maintain audit logs for every recommendation and action.
* Display loading and error states gracefully.
* Modular architecture to support future integrations (e.g., Google Ads, TikTok Ads, LinkedIn Ads).

---

# Future Enhancements (Post V1)

* Automatic execution with configurable approval rules.
* AI prioritization of recommendations.
* Recommendation feedback loop ("Helpful"/"Not Helpful") to improve suggestion quality.
* Cross-account optimization insights.
* Slack and email notifications.
* Custom optimization rules and thresholds.
* Integration with CRM and analytics platforms.

---

# Acceptance Criteria

### Account Health

* Health score is displayed and calculated.
* Audit checks are grouped by category.
* Issues include severity, evidence, and recommendations.
* Users can filter issues by severity and category.

### Optimization Copilot

* Performance metrics refresh successfully.
* Opportunity detection generates recommendations based on defined rules.
* Every recommendation includes finding, evidence, likely cause, recommended action, expected impact, and confidence.
* Recommendation status updates correctly throughout its lifecycle.

### Action Center

* AI-generated recommendations populate the action queue.
* Users can approve, reject, or dismiss recommendations.
* Executed actions update their status and retain an audit history.
* Bulk actions function correctly.
* No action is executed automatically in V1.
