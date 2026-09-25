# Microsoft Fabric Real-Time Monitoring Hub — UI/UX Design System

**Document Version:** 3.0  
**Updated:** 2026-09-26  
**Status:** Approved & Implemented  

---

## 1. Design System Philosophy

The **Microsoft Fabric Real-Time Monitoring Hub** delivers an ultra-premium, dark-mode-first mission control aesthetic engineered specifically for enterprise data operations engineers.

Key visual principles:
1. **Clarity Over Clutter**: Complex hierarchical relationships (orchestrators invoking child pipelines) are rendered as clean, expandable trees rather than disjointed tabular rows.
2. **Immediate Status Recognition**: Status badges use high-contrast semantic colors, glowing borders, and micro-animations to instantly distinguish active, failed, and healthy workloads.
3. **Sub-Second Feedback**: Running pipelines feature live ticking stopwatch duration counters and animated pulse indicators that provide immediate visual confirmation of execution progress.
4. **Monospace Precision**: GUIDs, timestamps, row counts, and error codes are formatted in monospace typography for error-free scanning.

---

## 2. Color Palette & Semantic Design Tokens

### 2.1 Surfaces & Backgrounds
| Token | Hex Value | Usage |
|---|---|---|
| `bg-primary` | `#090d16` | Main viewport background |
| `bg-card` | `#0f172a` | Primary card and table container background |
| `bg-surface` | `#1e293b` | Secondary surface, table header, and modal background |
| `border-subtle` | `#1e293b` | Divider lines and subtle borders |
| `border-card` | `#334155` | Card borders and table grid lines |
| `border-active` | `#3b82f6` | Focused inputs and selected tabs |

### 2.2 Execution Status Semantic Tokens
| Status | Badge Color | Background Tint | Border Color | Visual Indicator |
|---|---|---|---|---|
| **Completed / Succeeded** | `#10b981` (Emerald) | `rgba(16, 185, 129, 0.12)` | `rgba(16, 185, 129, 0.3)` | Solid green dot |
| **InProgress / Running** | `#3b82f6` (Blue) | `rgba(59, 130, 246, 0.15)` | `rgba(59, 130, 246, 0.4)` | Spinning SVG loader + Ticking timer |
| **Failed** | `#ef4444` (Rose) | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.4)` | Glowing red dot + Pulsing alert ring |
| **Cancelled** | `#f59e0b` (Amber) | `rgba(245, 158, 11, 0.12)` | `rgba(245, 158, 11, 0.3)` | Amber slash icon |
| **Not Run / Idle** | `#64748b` (Slate) | `rgba(100, 116, 139, 0.12)` | `rgba(100, 116, 139, 0.3)` | Gray circle icon |

### 2.3 SLA Incident Status Tokens
| Incident State | Badge Color | Description |
|---|---|---|
| **`ACTIVE`** | `#f97316` (Orange) | Failure recorded; L1 notified; countdown ticking toward SLA1. |
| **`ESCALATED_L2`** | `#dc2626` (Red) | SLA1 breached; escalated to L2; urgent intervention required. |
| **`RESOLVED`** | `#10b981` (Green) | Incident acknowledged and resolved by operator. |

---

## 3. Typography & Font Hierarchy

- **Primary Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
- **Code & Numeric Font**: `JetBrains Mono`, `Fira Code`, `Consolas`, monospace.

| Element | Size | Weight | Line Height | Tracking | Color |
|---|---|---|---|---|---|
| Page Header | 24px | 700 (Bold) | 32px | -0.02em | `#ffffff` |
| Section Title | 18px | 600 (Semi-bold) | 24px | -0.01em | `#f1f5f9` |
| Metric Value | 28px | 800 (Extra-bold)| 36px | -0.03em | `#ffffff` |
| Body Text | 14px | 400 (Regular) | 20px | 0 | `#cbd5e1` |
| Caption / Label | 12px | 500 (Medium) | 16px | +0.02em | `#94a3b8` |
| Monospace ID | 13px | 500 (Medium) | 18px | 0 | `#93c5fd` |

---

## 4. Key Component Specifications

### 4.1 Metric Summary Cards (Top Rail)
A responsive 6-card grid displaying:
1. **Total Pipelines**: High-contrast white count with folder icon.
2. **In Progress**: Glowing blue pulse with spinning loader icon.
3. **Completed**: Emerald green checkmark icon.
4. **Failed**: Rose red warning triangle with alert indicator.
5. **Cancelled**: Amber ban icon.
6. **Not Run**: Neutral slate clock icon.

*Interaction*: Clicking a summary card toggles a quick-filter on the pipeline table below.

### 4.2 Hierarchical Pipeline Tree Table
- **Root Rows (Master Pipelines)**:
  - Left column features an expandable chevron icon (`ChevronRight` when collapsed, `ChevronDown` when expanded).
  - Displays Pipeline Name, Prefix tag, Status badge, Live Stopwatch / Total Duration, Start Time, Next Scheduled Run, and SLA Assignee badges.
  - Action buttons: History (`Clock`), Schedules (`Calendar`), SLA Config (`Shield`), AI Diagnostics (`Sparkles`).
- **Inner Expansion Panel (Activity Tree)**:
  - Indented with a vertical connecting tree guide line.
  - Lists sequential and parallel activities: Copy, Web, Notebook, StoredProcedure, Dataflow, ExecutePipeline.
  - If an activity is an `ExecutePipeline` that invoked a child pipeline, the child pipeline renders as a nested card showing the child's status, duration, and its own inner activities.

### 4.3 Live Duration Stopwatch
For pipelines with status `InProgress`, the UI does not display a static duration. Instead:
- Computes `elapsed = now - startTime`.
- Ticks upwards every second in format `Xm Ys` (or `Xh Ym Zs`).
- Paired with a subtle animated pulsing blue border around the row.

### 4.4 Modals & Flyouts
1. **Run History Modal**:
   - Tabular view of past executions with duration bar charts, invocation types (Scheduled vs. Manual), and activity breakdown per run.
2. **AI Diagnostics Modal**:
   - Glassmorphic modal displaying Gemini 1.5 Pro root-cause analysis, failure error code callout, step-by-step remediation commands, and confidence meter.
3. **Multi-Schedule Forecast Modal**:
   - Displays all active triggers with recurrence badges (Daily, Weekly, Cron), active days, timezone, and countdown to next execution.
4. **SLA Configuration Modal**:
   - Form for setting SLA1 (L1 window in minutes), SLA2 (L2 escalation window), and assigning engineer emails with autocomplete directory search.
   - Includes a "Send Test Email" action button to verify deliverability.
5. **Table Log Mapping Modal**:
   - Allows administrators to select Fabric Lakehouse/Warehouse artifacts and map audit columns for Batch Header, Bronze, and Silver Delta tables.

---

## 5. Responsive Layout Breakpoints

| Breakpoint | Target Viewport | Layout Adjustments |
|---|---|---|
| **Mobile (`< 768px`)** | 375px – 430px | Single-column metric card stack; table switches to stacked card view; modals render full-screen. |
| **Tablet (`768px – 1024px`)** | 768px – 1024px | 2-column or 3-column metric cards; table horizontally scrollable with sticky left pipeline name column. |
| **Desktop (`> 1024px`)** | 1440px – 1920px | Full 6-column metric card bar; rich multi-column hierarchical tree table; side-by-side modal panels. |

---

## 6. UI States (Loading, Empty, Error)

- **Loading State**: Shimmering skeleton placeholders matching the exact card and table row heights, preventing layout shifts.
- **Empty State**: Custom SVG illustration with helpful copy: *"No pipelines found matching the selected filter"* and an action button to reset filters.
- **Error State**: Non-blocking toast alerts for background synchronization warnings, and a centered error card with retry button if initial workspace discovery fails.
