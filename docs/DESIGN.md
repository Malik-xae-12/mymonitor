# Design System

**Last Updated:** 2026-09-23

The UI **must follow the Microsoft Fabric UI kit** (Fluent 2 design language). Every page
must be self-explanatory and Fabric-native — a user opening a page should immediately
understand what it is and where the controls are. Pages must not look “AI-generated”.
Styling via Tailwind CSS 4 mapped to Fabric/Fluent tokens.

## 0. Design Source: Figma MCP + Fabric UI Kit
- **Source of truth**: Microsoft Fabric UI kit (Figma Community file).
- **Tooling**: Figma MCP (Framelink `figma-developer-mcp`) configured in `.agents/mcp_config.json`.
  Set `FIGMA_API_KEY` (Figma personal access token) to enable it.
- **Workflow**: pull frame specs/tokens from the Fabric UI kit via Figma MCP → map to Tailwind
  tokens → build components (`components/ui`, `components/layout`) that match Fluent 2 exactly.
- **Fluent 2 principles**: clear information hierarchy, consistent 4px spacing rhythm,
  purposeful use of the Fabric command bar / nav rail / side pane patterns, accessible
  contrast, and status semantics conveyed by both color and icon/label (never color alone).

## 1. Color Tokens (Status-Driven)
| Purpose | Color | Usage |
| :-- | :-- | :-- |
| Success / Succeeded | Emerald | Completed runs, recorded past-run dots |
| Failure / Breach | Red | Failed runs, SLA breaches, error badges |
| Warning | Amber | Near-SLA warnings, degraded states |
| Running / InProgress | Blue | Active runs, live polling indicator |
| Forecast / Scheduled | Purple | Upcoming schedule windows |
| Cancelled / Idle | Slate / Gray | Cancelled runs, muted metadata |

## 2. Typography
- System UI sans-serif stack via Tailwind defaults.
- Dense tabular data uses smaller sizes (`text-xs` / `text-sm`) for row density.
- Headings use medium/semibold weights; numeric metrics emphasized.

## 3. Spacing & Layout
- 4px base spacing scale (Tailwind default).
- Fabric-style nav rail + suite/command bars; side pane for run detail.
- Tree table for parent-child pipeline hierarchy.

## 4. Core Components
`FabricNavRail`, `FabricSuiteBar`, `FabricCommandBar`, `FabricMetricCards`,
`DateFilterBar`, `PipelineTreeTable` / `PipelineRow`, `ActivityList`,
`RunHistoryModal`, `ErrorDetailModal`, `SlaConfigModal`, `PipelineScheduleModal`,
`SchedulesDrawer`, `TableLog*` (config/dashboard/page), `WorkspaceSelector`.

## 6. Page Meaning & Fabric UX Principles (must-follow)
Every screen must communicate its purpose at a glance, following how real Microsoft Fabric
pages are laid out:

| Page | Purpose (what the user must instantly understand) | Fabric pattern |
| :-- | :-- | :-- |
| **Sign-in** | “Authenticate with your organization account” | Centered Entra ID sign-in card |
| **Workspace picker** | “Choose the workspace you own/monitor” | Fabric workspace list w/ search + roles |
| **Admin → Assignment** | “Assign L1/L2 responsibility, set per-parent-pipeline SLA1/SLA2, table config” | Command bar + form sections + parent-pipeline SLA table |
| **Monitoring** | “Live health of parent pipelines; drill into sub-pipelines” | Tree table, metric cards, side pane |
| **Run history** | “Every past run of this pipeline with status + diagnostics” | Modal/list with status pills |
| **Diagnostics** | “Why it failed + how to fix” | Side pane / modal, AI section clearly labeled |
| **Schedules** | “All schedules for this pipeline” | Drawer/list with frequency + next run |
| **Table logs** | “Batch lineage Header → Bronze → Silver + AI” | Table config wizard + dashboard |

Rules: primary action right-aligned in the command bar; destructive actions confirmed;
empty states explain the next step; loading uses Fluent skeletons/spinners; role is always
visible in the shell (Admin / L1 / L2 badge).

The global suite bar is kept lean: it shows branding, search, role badge, user + sign-out,
and (for admins) the "Admin setup" entry. The workspace selector and table-log-config controls
were removed from the suite bar — workspace selection happens in-context (admin list / scoped
monitoring), and table-log config lives inside the admin flow.

## 7. Responsive Matrix
Verify at **375px** (mobile), **768px** (tablet), **1440px** (desktop). Primary target is the
desktop operations console; mobile must remain readable without horizontal overflow.
