# Research notes: which visuals, and why

*Researched October 30, 2026. Network access from the build environment was limited: web search worked, but Microsoft Learn, the Fabric community, SQLBI, lerchbates.com and most vendor sites couldn't be fetched directly. Findings below come from search-result summaries and should be spot-checked.*

## Method

1. Looked for evidence of demand: community idea threads, "best custom visuals" roundups, Microsoft's own sample-visual list, and which commercial visual vendors build businesses around.
2. Removed anything Power BI now does natively, or nearly does: decomposition tree, key influencers, smart narrative, the new card visual, table sparklines, funnel, waterfall, gauge, ribbon chart.
3. Kept chart types that are **generic** (they work with any data of the right shape) and that serve **operations and management** decisions at a consulting firm.

## Evidence

| Signal | What it suggests |
|---|---|
| Microsoft's sample-visuals page lists **Bullet chart** and **Sankey** as separate downloadable visuals, not built in | Common needs Microsoft leaves to custom visuals |
| SQLBI article "Building bullet charts in Power BI reports" recommends AppSource visuals or Deneb for bullet charts | No native bullet chart |
| Custom Visuals Ideas board: Sankey requests (conditional colouring, layout) and Gantt requests (dependencies, dark-theme support) | Active demand for flow and schedule visuals |
| Third-party roundups (2026) repeatedly name Deneb, Sankey (MAQ), Gantt (MAQ), and calendar/heatmap templates; one notes many AppSource visuals are "abandoned, watermarked, or thin wrappers" | Demand exists, but available options are uneven in quality and licensing |
| Commercial suites (Zebra BI, Inforiver, ChartExpo) sell variance/IBCS charts, box plots, bullet charts and Sankey | Strong enough demand to pay for. Building in-house avoids per-user licences and keeps data in the tenant |
| One community answer: a custom summary/distribution plot "is not possible natively"; suggested Charticulator, R or Python | Distribution charts (box plots) are a gap |
| Power BI October 2026 feature summary: **native Gantt chart (preview)** | Gantt is now partly covered (see below) |

## Native Gantt preview (October 2026)

Microsoft's October 2026 release added a native **Gantt chart in preview**. Third-party write-ups describe tasks, % complete, milestones, parent-group rows and a zoomable time axis. I couldn't confirm whether it supports **baseline vs. actual dates and slip**, so LB Baseline Gantt focuses on that. Once the native visual is generally available, compare the two. If the native one gains baseline support, retire LB Baseline Gantt rather than maintain both.

## The 10 chosen (and the decision each supports)

| # | Visual | Decision it supports | Native alternative and why it falls short |
|---|---|---|---|
| 1 | Bullet Chart | Are we on target? | Gauge/KPI card: one value, no bands, uses a lot of space |
| 2 | Calendar Heatmap | When should we staff up? | Matrix + conditional formatting: no calendar layout |
| 3 | Pareto | What should we fix first? | Combo chart + DAX running total: no 80/20 highlighting |
| 4 | Control Chart (XmR) | Should we react to this change? | Line chart: no calculated limits or rule detection |
| 5 | Box & Whisker | How predictable are we? | None |
| 6 | Sankey | Where does it flow? | None |
| 7 | Baseline Gantt | Which tasks are slipping? | Native Gantt (preview): baseline/slip unconfirmed |
| 8 | Milestone Timeline | What's due, and what's at risk? | None |
| 9 | Plan vs Actual Variance | How far off plan, and is it good or bad? | Clustered column: no variance panels or good/bad colouring |
| 10 | Portfolio Status Grid | Which projects need attention? | Multi-row card / table: no RAG tiles or worst-first sort |

## Runners-up (not built, possible next round)

- **Dumbbell / slope chart:** before/after or year-over-year per category. Simple, generic and useful; the strongest candidate for #11.
- **Radar chart:** vendor or bid evaluation scoring across criteria. Often discouraged because the shapes are hard to compare.
- **Gantt with dependencies:** frequently requested, but it needs predecessor data that most LB systems don't keep in Power BI.
- **Hierarchical org / tree chart:** partly covered by the native decomposition tree.
- **Deneb:** a free, very capable "build any chart" visual that uses Vega-Lite code. Good for analysts who are comfortable with JSON; not suited to report consumers.

## Sources

- [Microsoft Learn: Examples of Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/samples)
- [SQLBI: Building bullet charts in Power BI reports](https://www.sqlbi.com/articles/building-bullet-charts-in-power-bi-reports/)
- [Fabric community: Custom Visuals Ideas board](https://community.fabric.microsoft.com/t5/Custom-Visuals-Ideas/idb-p/CustomVisualsIdeas/label-name/visuals)
- [Fabric community: "Need to replicate this chart from Tableau"](https://community.fabric.microsoft.com/t5/Desktop/Need-to-replicate-this-chart-from-tableau/m-p/2940574)
- [Fabric community: Creating a custom summary plot without Python](https://community.fabric.microsoft.com/t5/Custom-Visuals-Development/Creating-Custom-Summary-plot-without-using-Python/td-p/1359495)
- [Power BI October 2026 feature summary](https://community.fabric.microsoft.com/blog/fbc_pbiupdatesblog/power-bi-october-2026-feature-summary/5374650)
- [Power BI October 2026 update: native Gantt (third-party write-up)](https://ecclesieagazzi.com/insights/power-bi-october-2026-update.html)
- [VizForge: The 12 best Power BI custom visuals in 2026](https://vizforge.ai/blog/best-power-bi-custom-visuals)
- [Beyond the Analytics: 26 custom Power BI visuals](https://beyondtheanalytics.com/powerbi-visuals)
- [Inforiver: Analytics+ visual suite](https://inforiver.com/analytics-plus/)
- [DataChant: Power BI visuals AppSource changelog](https://github.com/DataChant/PowerBI-Visuals-AppSource/discussions/56)
- [Microsoft Learn: Import a Power BI visual from a file](https://learn.microsoft.com/power-bi/developer/visuals/import-visual)
- [Microsoft Learn: Manage Power BI visuals admin settings](https://learn.microsoft.com/power-bi/admin/organizational-visuals)
- [PR Newswire: Lerch Bates unveils new brand identity (2022)](https://www.prnewswire.com/news-releases/lerch-bates-expands-offerings-unveils-new-brand-identity-to-kick-off-75th-anniversary-celebration-301461499.html)
- [Oysterlink: Lerch Bates company profile ("LB Bright Green")](https://oysterlink.com/company-profile/lerch-bates/)
