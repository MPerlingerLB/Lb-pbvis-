# Visual catalogue

For each visual: the problem it solves, who uses it, example Lerch Bates use cases, the fields it needs, and its Format-pane options. Every visual also has the shared **Brand colors** and **Text & labels** cards, a **Tooltips** well, cross-filtering, keyboard support and high-contrast support.

---

## 1. LB Bullet Chart
![](img/bullet-chart.png)

**Why it's needed:** Power BI's built-in options for "actual vs. target" are the gauge, which uses a lot of space and only shows one number, and the KPI card, which has no performance bands. Stephen Few designed the bullet chart as the compact replacement for gauges. Power BI has no native bullet chart; SQLBI's guidance is to use an AppSource visual or build one in Deneb.

**Users:** office/regional leaders, department managers, executives on scorecards.

**Use cases**
- Billable utilization by consultant or office vs. target
- Proposals submitted this quarter vs. goal
- Average report turnaround vs. SLA (turn off *Higher is better*)
- Revenue vs. budget by service line

**Fields:** Category (optional) · **Actual** · Target · optional band limits (Poor / Satisfactory upper limits, Axis maximum)

**Format → Bullet:** Higher is better · Color actual bar by performance (green ≥ target, amber, red below the poor band) · band limits as % of target (default 70 / 90 / 120) · Same scale for every row · label width.

---

## 2. LB Calendar Heatmap
![](img/calendar-heatmap.png)

**Why it's needed:** day-of-week and seasonal patterns are hidden in a line chart and awkward in a matrix. A calendar layout (GitHub-contribution style) shows them at a glance. There's no native equivalent.

**Users:** operations managers, dispatch and scheduling, resource planners.

**Use cases**
- Service calls / entrapments per day (spot Monday spikes, holiday dips)
- Hours logged per day by team (find under-reported days)
- Site visits or inspections scheduled per day
- Days with permit approvals or code violations

**Fields:** **Date** (the real date, not *Date Hierarchy*) · **Value**

**Format → Calendar:** Week starts Monday · low/high colours · show zero as empty · legend · cell gap. Long ranges wrap automatically into several strips. Click a day to filter the page to that date.

---

## 3. LB Pareto Chart
![](img/pareto-chart.png)

**Why it's needed:** the 80/20 view is a standard quality tool, but native Power BI needs DAX running-total measures plus a combo chart to fake it, and it still can't highlight the "vital few".

**Users:** QA/QC, service/maintenance managers, account managers, finance.

**Use cases**
- Callback / entrapment root causes (which 3 causes produce 80% of callbacks?)
- Deficiencies from inspections by code section
- Revenue concentration by client
- Unbilled hours by reason

**Fields:** **Category** · **Value**

**Format → Pareto:** cut-off % (default 80) · show cut-off line · highlight the vital few · max bars (the rest are grouped into "All others") · cumulative line colour. A header sentence states the result, e.g. "4 of 9 categories make up 81% of the total".

---

## 4. LB Control Chart (XmR)
![](img/control-chart.png)

**Why it's needed:** managers often react to every up-or-down week. A statistical process control chart separates **signal** from **noise**. Power BI has no SPC chart; the native line chart can draw constant lines, but it can't calculate moving-range limits or detect rule violations.

**Users:** operations directors, quality/process owners, PMO.

**Use cases**
- Weekly average report turnaround (did the new template actually help?)
- Monthly callbacks per 100 units under maintenance contracts
- Days from site visit to proposal
- Invoice cycle time

**Fields:** **Axis** (date or sequence, one row per period) · **Value**

**Method:** individuals chart. Mean ± 2.66 × average moving range (UCL/LCL), with optional ±1σ / ±2σ zones.
**Signals:** a point outside the limits (red); a run of N points on one side of the mean (amber, default 8); optionally 2 of 3 points beyond 2σ.
**Format → Control chart:** points used for limits (freeze the limits on a baseline period to see whether a change moved the process) · rule toggles · run length · zones · floor the LCL at zero.

---

## 5. LB Box & Whisker
![](img/box-plot.png)

**Why it's needed:** averages hide variability. Two offices can both average 15 weeks per project, one consistently and one wildly. Power BI has no native box plot.

**Users:** managers, estimators, analysts, business development (pricing).

**Use cases**
- Project duration by office or project type (for better schedule estimates)
- Fee per car / per floor by building type (pricing consistency)
- Response time by technician or contractor
- Inspection deficiency counts by building age band

**Fields:** **Category** · **Sample** (the individual record, e.g. Project ID; without it Power BI would pre-aggregate) · **Value**

**Format → Box plot:** whiskers (1.5 × IQR / min-max) · sort by data order, name or median · show mean (×) · show all points (jittered). Outliers are drawn in red.

---

## 6. LB Sankey Flow
![](img/sankey-flow.png)

**Why it's needed:** flows between stages (pipeline, budget, hours) are hard to read as stacked bars. Sankey is one of the most-requested non-native visuals, and Microsoft's own Sankey is a separate download.

**Users:** business development, finance, leadership, operations.

**Use cases**
- Lead source → proposal → won / lost → service line
- Budget → department → cost category
- Consultant hours: office → client sector → project phase
- Equipment inventory: manufacturer → condition → recommended action

**Fields:** **Source** · **Destination** · **Weight**. For multi-stage flows, add rows where a destination is also a source (A→B, B→C). Loops (A→B→A) can't be drawn, and the visual tells you if it finds one.

**Format → Sankey:** node alignment · link colour (by source / destination / neutral) · node width and spacing · link opacity. Hover over a node to emphasise its links.

---

## 7. LB Baseline Gantt
![](img/baseline-gantt.png)

**Why it's needed:** PMs need to see **schedule slip against the baseline**, not just a bar chart of dates. Microsoft added a native Gantt chart in preview in October 2026 (see [RESEARCH.md](RESEARCH.md#native-gantt-preview-october-2026)); this visual focuses on what PMs report on: planned vs. actual/forecast, slip in days, and % complete.

**Users:** project managers, PMO, principals, client progress meetings.

**Use cases**
- Modernization project schedules (design → bid → submittals → install → acceptance)
- New-construction VT installation tracking against the GC schedule
- Internal programmes (software rollout, office moves)

**Fields:** Group/phase (optional) · **Task** · **Planned start** · **Planned finish** · Actual/forecast start · Actual/forecast finish · % complete

**How it reads:** grey bar = baseline. The coloured bar is actual/forecast: green = on time or early, amber = late by up to N days, red = later than that. A light bar with a solid part shows progress. A dashed outline is a forecast: the task has started but has no finish date, so the planned duration is projected forward, never earlier than today. The right column shows slip (+14d), and groups show their worst slip. Equal start and finish draws a milestone diamond. The red dashed line is today. The body scrolls vertically.

**Format → Gantt:** today line · show slip · amber threshold (days) · group summary bars · row height · label width.

---

## 8. LB Milestone Timeline
![](img/milestone-timeline.png)

**Why it's needed:** leadership wants "what's due across all projects" on one page, which native Power BI can't draw.

**Users:** PMs, principals, account managers, client-facing status reports.

**Use cases**
- Key dates across the active project portfolio (permits, turnovers, reports)
- Contract renewals and maintenance-audit due dates by client
- Code-compliance deadlines by building

**Fields:** Swimlane (optional) · **Milestone** · **Date** · Status (optional)

**Status colours are automatic** from common words: *complete / done / on track* → green · *at risk / delayed / amber* → amber · *late / overdue / missed / red* → red · *planned / scheduled / upcoming* → hollow primary-colour marker. Other values get theme colours. Labels are stacked automatically so they don't overlap.

**Format → Timeline:** today line · status legend · swimlane label width · marker size.

---

## 9. LB Plan vs Actual Variance
![](img/variance-chart.png)

**Why it's needed:** a column chart of actual next to plan makes readers do the subtraction in their heads. This visual follows IBCS notation (solid = actual, outline = plan) and adds **absolute (Δ) and % variance** panels, coloured by whether the variance is good or bad. Commercial visuals such as Zebra BI sell this layout.

**Users:** finance, office and regional leaders, executive monthly reviews.

**Use cases**
- Monthly revenue vs. plan or vs. prior year
- Expenses vs. budget by cost centre (turn off *Higher is better*)
- Billable hours vs. forecast by office
- Proposal value vs. target by quarter

**Fields:** **Category** · **Actual** · **Plan / budget / prior year**

**Format → Variance:** higher is better · show Δ bars / Δ% pins · total column · labels (AC / PL / PY). The total is shown as text in the main panel so it doesn't dwarf the monthly bars. In the Δ panel, an axis-break mark shows when a bar runs past the scale.

---

## 10. LB Portfolio Status Grid
![](img/status-grid.png)

**Why it's needed:** project health reviews need a scannable "traffic-light board". Native cards and tables can approximate it, but not as a responsive tile grid sorted worst-first.

**Users:** PMO, executives, weekly operations meetings, regional directors.

**Use cases**
- Project portfolio health by PM (RAG + % budget used)
- Building portfolio condition (equipment status per building)
- Contract / SLA compliance per client
- Office scorecard (utilization score → RAG via thresholds)

**Fields:** **Item** · Status (text) **or** Score (number with thresholds) · Subtitle (optional) · Key metric (optional)

**Status text recognised:** R/A/G, Red/Amber/Yellow/Green, On track / At risk / Off track, Late, Blocked, Complete, OK…
**Format → Status:** sort worst first · summary bar (counts by status) · minimum tile width (responsive columns) · score thresholds and direction.
