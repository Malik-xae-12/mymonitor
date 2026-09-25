# Microsoft Fabric Real-Time Monitoring Hub — UI/UX Design System

**Document Version:** 4.0  
**Updated:** 2026-09-26  
**Status:** Approved & Implemented  
**Aesthetic Framework:** Microsoft Fabric Fluent 2 Light Design System (Pure Light Theme — No Dark Mode)

---

## 1. Design System Philosophy & Identity

The **Microsoft Fabric Real-Time Monitoring Hub** is built with an authentic **Microsoft Fabric Fluent 2 Light** design language. It mirrors the exact visual identity, color tokens, layout hierarchy, and micro-interactions of the native Microsoft Fabric web portal (`app.fabric.microsoft.com`).

> [!IMPORTANT]
> **Theme Specification**: The application operates **exclusively in Microsoft Fabric Light Mode**. There is **no dark mode**. Every surface, card, command bar, modal, and badge adheres strictly to the Microsoft Fluent 2 enterprise light palette: `#faf9f8` canvas, `#ffffff` card/table containers, `#f3f2f1` subheader/table header surfaces, `#edebe9`/`#e1dfdd` borders, and `#0f6cbd` Fabric brand blue.

### Key Visual Principles
1. **Microsoft Fabric Native Cohesion**: Users transitioning between the Microsoft Fabric portal and this monitoring hub experience zero cognitive friction; typography, icon weights, padding scales, and button states match Fabric 1-to-1.
2. **Hierarchical Activity Trees**: Nested pipeline executions (`ExecutePipeline` invoking child pipelines) render as intuitive, indented tree rows with vertical lineage guidelines rather than disjointed tabular lists.
3. **Sub-Second Operational Feedback**: Actively running pipelines display a live ticking stopwatch duration counter (`Xm Ys`), accompanied by a spinning Fabric blue SVG loader (`#0f6cbd`) and subtle indeterminate progress bars.
4. **Instant Semantic Status Recognition**: High-contrast, soft-tinted status badges (`#dff6dd` for succeeded, `#fde7e9` for failed, `#eff6fc` for running, `#f3f2f1` for cancelled/not run) allow operators to triage workloads in milliseconds.
5. **Monospace Metric Precision**: Execution GUIDs, row counts, run durations, and timestamp values use clean tabular figures for effortless vertical scanning.

---

## 2. Color Palette & Fluent 2 Design Tokens

All CSS variables are declared in `frontend/src/index.css` under the `:root` scope and leveraged consistently across all React components:

```css
:root {
  --fabric-bg-canvas: #faf9f8;
  --fabric-bg-subtle: #f3f2f1;
  --fabric-bg-card: #ffffff;
  --fabric-bg-hover: #ebebeb;
  --fabric-border: #edebe9;
  --fabric-border-subtle: #e1dfdd;
  --fabric-brand: #0f6cbd;
  --fabric-brand-hover: #115ea3;
  --fabric-text-primary: #242424;
  --fabric-text-secondary: #605e5c;
  --fabric-text-subtle: #a19f9d;
}
```

### 2.1 Surfaces, Backgrounds & Borders
| Token | Hex Value | Semantic Usage |
|---|---|---|
| `--fabric-bg-canvas` | `#faf9f8` | Primary page viewport canvas background. Soft off-white typical of Microsoft 365 / Fabric. |
| `--fabric-bg-card` | `#ffffff` | Elevated containers, metric cards, table body, dropdown menus, and modal dialogs. |
| `--fabric-bg-subtle` | `#f3f2f1` | Table column headers, command bar background, search input backgrounds, and inactive pills. |
| `--fabric-bg-hover` | `#ebebeb` | Table row hover, menu item hover, and subtle button hover states. |
| `--fabric-border` | `#edebe9` | Standard container borders, card outlines, and grid separators. |
| `--fabric-border-subtle` | `#e1dfdd` | Secondary divider lines, inner table row borders, and subtle separators. |
| `border-hover` | `#d1d1d1` | Interactive elements on hover or keyboard focus. |
| `--fabric-brand` | `#0f6cbd` | Microsoft Fabric primary brand blue; used for active tabs, primary buttons, and link anchors. |
| `--fabric-brand-hover` | `#115ea3` | Brand blue button hover and active press states. |

### 2.2 Typography & Text Colors
| Token | Hex Value | Usage |
|---|---|---|
| `--fabric-text-primary` | `#242424` | Primary page headers, pipeline names, metric numbers, and modal titles. |
| `--fabric-text-secondary` | `#605e5c` | Secondary labels, table column titles, breadcrumbs, and timestamp captions. |
| `--fabric-text-subtle` | `#a19f9d` | Disabled text, placeholder text, and subtle metadata guidelines. |

---

## 3. Microsoft Fabric Semantic Status Badges

In accordance with Microsoft Fluent Design, status badges utilize a soft-tint background, a 1px matching border at 30% opacity, a bold icon, and high-contrast text:

| Status | Text Color | Background Tint | Border | Icon & Animation |
|---|---|---|---|---|
| **Completed / Succeeded** | `#107c41` (Emerald) | `#dff6dd` | `#107c41`/30 | `<CheckCircle2 />` (Green checkmark) |
| **In Progress / Running** | `#0f6cbd` (Fabric Blue) | `#eff6fc` | `#0f6cbd`/30 | `<Loader2 className="animate-spin" />` + Live stopwatch |
| **Failed** | `#c42b1c` (Crimson) | `#fde7e9` | `#c42b1c`/30 | `<XCircle />` (Red X) + "View error" action pill |
| **Cancelled** | `#605e5c` (Neutral) | `#f3f2f1` | `#edebe9` | `<Ban />` (Muted gray slash) |
| **Not Run / Queued** | `#605e5c` (Neutral) | `#f3f2f1` | `#edebe9` | `<Clock />` (Muted gray clock) |
| **Scheduled (Forecast)** | `#773adc` (Fabric Purple) | `#f3e8ff` | `#773adc`/30 | `<Sparkles />` (Purple sparkles) |

### SLA Breach Badges
| SLA State | Text Color | Background Tint | Border | Description |
|---|---|---|---|---|
| **`ACTIVE`** (L1 SLA Breach) | `#c42b1c` | `#fde7e9` | `#c42b1c`/40 | Failure recorded; L1 team notified; SLA countdown ticking. |
| **`ESCALATED_L2`** (L2 Escalation) | `#c42b1c` | `#fde7e9` | `#c42b1c` (Solid) | SLA1 breached; escalated to L2 lead; critical intervention banner. |
| **`RESOLVED`** | `#107c41` | `#dff6dd` | `#107c41`/30 | Incident acknowledged and marked resolved by engineer. |

---

## 4. Fabric Activity Type Color-Coding & Icons

Each activity in the execution tree displays its distinct Microsoft Fabric category icon and brand color:

| Activity Type | Fabric Brand Color | Hex Code | Lucide Icon | Typical Workload |
|---|---|---|---|---|
| `ExecutePipeline` / `InvokePipeline` | Fabric Purple | `#773adc` | `<Layers />` | Parent orchestrator invoking a child pipeline |
| `Lookup` | Teal | `#008272` | `<Search />` | Metadata lookup, config parameter queries |
| `Filter` | Fabric Blue | `#0f6cbd` | `<Filter />` | Array filtering, conditional dataset routing |
| `ForEach` | Forest Green | `#107c41` | `<Repeat />` | Iterative execution over table lists or partitions |
| `Switch` | Orange | `#d83b01` | `<GitBranch />` | Conditional branching |
| `SetVariable` | Fabric Blue | `#0078d4` | `<Variable />` | Execution runtime variable assignments |
| `AppendVariable` | Cyan | `#00b7c3` | `<ListPlus />` | Array appending for batch tracking |
| `Fail` | Crimson | `#c42b1c` | `<AlertOctagon />` | Explicit pipeline validation assertions |
| `Notebook` / `SynapseNotebook` | Orange | `#d83b01` | `<Code2 />` | PySpark / Scala Lakehouse transformation jobs |
| `Copy` | Fabric Blue | `#0f6cbd` | `<Database />` | High-throughput data ingestion into Delta tables |
| `Sql` / `Script` / `StoredProcedure` | Fabric Blue | `#0f6cbd` | `<Cpu />` | Fabric Warehouse T-SQL queries & procedures |
| `Web` / `WebHook` | Fabric Purple | `#773adc` | `<ArrowRightCircle />` | REST API webhooks & external event triggers |

---

## 5. Typography Specification

The font stack prioritizes Microsoft's official Windows 11 and Microsoft 365 typography:

```css
body {
  font-family: "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif;
  background-color: #faf9f8;
  color: #242424;
  -webkit-font-smoothing: antialiased;
}
```

### Type Scale
| Style | Size | Weight | Line Height | Color | Usage |
|---|---|---|---|---|---|
| **Page Title** | 20px | 600 (Semi-bold) | 28px | `#242424` | Main top navigation title & workspace header |
| **Section Header** | 16px | 600 (Semi-bold) | 22px | `#242424` | Metric section title, modal headers |
| **Metric Value** | 24px | 700 (Bold) | 28px | `#242424` | Metric summary cards (font-mono) |
| **Body Regular** | 13px | 400 (Regular) | 18px | `#242424` | Pipeline names, activity names, table cell content |
| **Body Subtle** | 12px | 400 (Regular) | 16px | `#605e5c` | Secondary descriptions, timestamps, assignee emails |
| **Badge Label** | 11px | 500 (Medium) | 14px | Status specific | Succeeded, In Progress, Failed, SLA badges |
| **Monospace / GUID** | 11px | 500 (Medium) | 16px | `#605e5c` | Run IDs, Job IDs, timestamps, row counts |

---

## 6. Microsoft Fluent Light Scrollbars

To preserve the clean light aesthetic and eliminate harsh OS scrollbars, custom light scrollbars are implemented across all scrollable viewports:

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #f3f2f1;
}
::-webkit-scrollbar-thumb {
  background: #c8c6c4;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #a19f9d;
}
```

---

## 7. Component Layout & Interaction Specifications

### 7.1 Top Command Bar (`FabricCommandBar.jsx`)
- **Background**: `#ffffff` with a bottom Fluent border `#edebe9`.
- **Workspace Selector**: Dropdown showing current workspace name, item count, and fast fuzzy-search filter.
- **View Mode Switcher**:
  - `Past 24h & Active Runs`: Live monitoring of running, completed, and failed pipelines.
  - `Future Schedules`: Multi-trigger calendar forecasts showing next execution times.
- **Search & Filter Input**: Light input (`#f3f2f1` background, `#242424` text, placeholder `#a19f9d`) with instantaneous search across pipeline names, prefixes, and assignees.
- **Refresh Control**: Manual refresh button with spinning icon state, paired with a live countdown timer showing seconds until the next polling cycle (30s default).

### 7.2 Metric Summary Rail (`FabricMetricCards.jsx`)
A responsive 6-card interactive filter rail:
1. **Total Pipelines**: `#242424` count with `<Layers />` icon.
2. **In Progress**: `#0f6cbd` count with spinning `<Loader2 />` and light blue tint (`#eff6fc`).
3. **Completed**: `#107c41` count with `<CheckCircle2 />` and light green tint (`#dff6dd`).
4. **Failed**: `#c42b1c` count with `<XCircle />` and light red tint (`#fde7e9`).
5. **Cancelled**: Muted count with `<Ban />` and `#f3f2f1` neutral container.
6. **Not Run**: Muted count with `<Clock />` and `#f3f2f1` neutral container.

*Interaction*: Clicking any metric card instantly filters the table below to that status (e.g. clicking "Failed" isolates all failing pipelines).

### 7.3 Hierarchical Pipeline Tree Table (`PipelineTreeTable.jsx` & `PipelineRow.jsx`)
- **Container**: Elevated `#ffffff` card with `#edebe9` rounded border and subtle `shadow-[0_1px_2px_rgba(0,0,0,0.02)]`.
- **Table Header**: `#f3f2f1` background, `#605e5c` uppercase 11px font with crisp column alignment:
  `Pipeline Name | Status | Duration | Started | Next Run | L1 Support | Actions`.
- **Master Pipeline Row**:
  - Chevron expander (`<ChevronRight />` / `<ChevronDown />`).
  - Prefix badge: Pill badge indicating pipeline folder or domain category.
  - Status badge: Soft Fluent tint badge.
  - Duration: If running, renders a ticking stopwatch counter (`12m 45s`); if completed, renders static formatted duration.
  - Quick Actions:
    - `History` (`<History />`): Opens run history modal.
    - `Schedules` (`<Calendar />`): Opens schedule trigger forecast modal.
    - `SLA Config` (`<Bell />`): Opens L1/L2 SLA configuration dialog.
- **Activity Tree Expansion**:
  - Indented tree panel (`bg-[#faf9f8]` surface) with vertical lineage connecting lines (`border-l-2 border-[#e1dfdd]`).
  - Displays activity name, type icon, status badge, duration, and error callout.
  - If activity is an `ExecutePipeline` invoking a child pipeline, the child pipeline renders as a nested card with its own expander and internal activity breakdown.

### 7.4 Modals & Flyouts
All modals use `#ffffff` container backgrounds, `#242424` headers, and a semi-transparent light backdrop (`bg-black/30 backdrop-blur-[2px]`):
1. **AI Error Diagnostics Modal**:
   - Header with failure reason and error code.
   - Root-cause analysis generated by Gemini 1.5 Pro.
   - Recommended resolution steps formatted as a clean checklist.
   - Monospace error traceback viewer with quick copy-to-clipboard button.
2. **Run History Modal**:
   - Historical list of past executions with duration trend bars, trigger types (Scheduled vs. On-Demand), and activity run counts.
3. **Schedule Forecast Modal**:
   - Lists all triggers associated with the pipeline: recurrence frequency (Daily, Weekly, Hourly, Cron), active days, timezone, and countdown to next scheduled execution.
4. **SLA Configuration Modal**:
   - Configures L1 and L2 support engineer assignments and threshold minutes.
   - Integrates with Entra ID user directory search for instant autocomplete.
   - Features a "Send Test Email" button to verify SMTP/Graph API alert deliverability.
5. **Table Log Mapping Modal**:
   - Lakehouse / Warehouse audit column mapper for Batch Header, Bronze, and Silver Delta tables.

---

## 8. Responsive Viewport Breakpoints

| Breakpoint | Target Range | Layout Behavior |
|---|---|---|
| **Mobile (`< 768px`)** | 375px – 430px | Metric cards stack in a 2-column grid; table switches to scrollable card view; command bar controls collapse into a mobile drawer. |
| **Tablet (`768px – 1024px`)** | 768px – 1024px | Metric cards render in a 3-column layout; table includes horizontal scroll with sticky left pipeline name column. |
| **Desktop (`> 1024px`)** | 1440px – 1920px | Full 6-column metric card grid; multi-column hierarchical tree table with inline expandable activities and flyouts. |

---

## 9. Accessibility (WCAG 2.1 AA)

- **Contrast Ratios**: All text tokens (`#242424` on `#ffffff`, `#605e5c` on `#f3f2f1`, `#107c41` on `#dff6dd`, `#c42b1c` on `#fde7e9`) exceed the WCAG AA minimum contrast ratio of 4.5:1.
- **Keyboard Navigation**: All interactive elements (tree chevrons, metric cards, action buttons) support standard Tab navigation and Enter/Space activation with distinct `#0f6cbd` focus rings.
- **Screen Reader Support**: Semantic status badges include explicit `aria-label` tags (e.g. `aria-label="Status: Completed in 4 minutes"`).
