# Setup guide: from zero to a working LB visual

Written for someone who has never used Power BI. Allow about 20 minutes the first time.

**Analogy:** Power BI is like Excel with a separate charting layer. You load tables (the **data model**), then build a page of charts (the **report**) on top of them. A `.pbiviz` file is a plug-in chart type, like adding a new chart style to Excel's chart gallery. You import it once per report, and afterwards it behaves like any built-in chart.

---

## 1. Install Power BI Desktop

- Windows only. Install **Power BI Desktop** from the Microsoft Store (it updates itself) or from microsoft.com/power-bi.
- Mac users: there's no Desktop app. Use the **Power BI service** in a browser (app.powerbi.com) with your Lerch Bates Microsoft 365 login. The steps are almost the same; see [section 6](#6-power-bi-service-browser).
- Sign in with your Lerch Bates account (top right) so you can publish later.

## 2. Load the sample data

1. Open Power BI Desktop → **Blank report**.
2. **Home → Get data → Text/CSV**.
3. Open, for example, `samples/pareto-chart_callback-causes.csv` → **Load**.
4. The table appears in the **Data** pane on the right.

Load as many sample files as you like; each becomes its own table.

**Tip:** values like `0.82` in the bullet-chart sample are fractions. To show them as %: select the column in the **Data** pane → **Column tools** ribbon → **Format → Percentage**.

## 3. Import the visual

1. In the **Visualizations** pane, click the **…** (More options) at the bottom of the icon gallery.
2. Choose **Import a visual from a file**.
3. Confirm the security prompt, which appears for any visual not downloaded from Microsoft AppSource.
4. Pick the matching file from `dist/`, e.g. `LB-Pareto-Chart-1.0.0.0.pbiviz`.
5. A new icon appears at the end of the Visualizations gallery. Hover over it to see its name.

> Some Microsoft Learn pages say Power BI Desktop needs **developer mode** turned on before importing from a file, and that it resets each session. If you don't see the import option, look under **File → Options and settings → Options → Report settings / Preview features**. (Not checked against the latest Desktop build; menu names change often.)

Imported visuals are saved **inside the .pbix report file**, so anyone you send the report to sees them without importing anything.

## 4. Build your first chart

1. Click an empty spot on the canvas, then click the LB visual's icon. A placeholder appears with a **checklist of the fields it needs**.
2. With the placeholder selected, drag fields from the **Data** pane into the wells under the Visualizations icons.

   For the Pareto sample: **Root Cause** → *Category*, **Callbacks** → *Value*.
3. Resize the visual by dragging its corners.
4. Hover for tooltips, and click a bar to filter other visuals on the page. Ctrl+click selects several bars; click empty space to clear.

### Field mapping for every sample

| Visual | Sample file | Drag these fields → wells |
|---|---|---|
| Bullet Chart | `bullet-chart_office-utilization.csv` | Office → Category · Utilization → Actual · Target → Target |
| Calendar Heatmap | `calendar-heatmap_daily-service-calls.csv` | Date → Date · Service Calls → Value |
| Pareto Chart | `pareto-chart_callback-causes.csv` | Root Cause → Category · Callbacks → Value |
| Control Chart | `control-chart_weekly-report-turnaround.csv` | Week → Axis · Avg Turnaround (days) → Value |
| Box & Whisker | `box-plot_project-duration-by-office.csv` | Office → Category · Project → Sample · Duration (weeks) → Value |
| Sankey Flow | `sankey-flow_proposal-pipeline.csv` | From → Source · To → Destination · Proposals → Weight |
| Baseline Gantt | `baseline-gantt_modernization-schedule.csv` | Phase → Group · Task → Task · Planned Start/Finish → Planned start/finish · Actual Start/Finish → Actual start/finish · % Complete → % complete |
| Milestone Timeline | `milestone-timeline_project-milestones.csv` | Project → Swimlane · Milestone → Milestone · Date → Date · Status → Status |
| Variance Chart | `variance-chart_monthly-revenue-vs-plan.csv` | Month → Category · Actual Revenue → Actual · Plan Revenue → Plan |
| Status Grid | `status-grid_project-portfolio.csv` | Project → Item · Status → Status · Project Manager → Subtitle · Budget Used → Key metric |

**Note:** the variance sample's months are text, so Power BI sorts them alphabetically (Apr, Aug, Feb…). In real reports, use a proper date or month-number column, or set **Sort by column** on the month name.

### ⚠️ The #1 beginner gotcha: "Date Hierarchy"

When you drag a date into a well, Power BI often swaps it for **Date Hierarchy** (Year → Quarter → Month → Day). The Calendar Heatmap, Control Chart, Gantt and Timeline need the **actual date**:

- In the well, click the **⌄** next to the field name and choose the field's own name (e.g. **Date**) instead of *Date Hierarchy*.
- If you forget, the visual displays a message telling you to do this.
- To turn the behaviour off for good: **File → Options and settings → Options → Current file → Data Load → uncheck Auto date/time**.

### Aggregation

Power BI sums numbers by default. For averages (e.g. average turnaround), click **⌄** next to the field in the well → **Average**. Better still, write a DAX measure. Ask your BI lead for help with that.

## 5. Formatting

Select the visual → **Visualizations pane → Format visual (paintbrush)**. Every LB visual has:

- A card named after the visual (**Bullet**, **Pareto**, **Gantt**…) with chart-specific options, for example the Pareto cut-off %, the Gantt amber threshold, or *Higher is better* for cost measures.
- **Brand colors**: primary, secondary, neutral, good / warning / bad.
- **Text & labels**: font size, font colour, data labels on/off.
- The standard Power BI title, background, border and so on under **General**.

## 6. Power BI service (browser)

1. Go to app.powerbi.com → your workspace → **New → Report** (or open an existing report → **Edit**).
2. In the **Visualizations** pane, click **…** → **Import a visual from a file** → pick the `.pbiviz`.
3. Uploading a `.pbiviz` in the service can be **blocked by your tenant settings** (see section 7a).

To publish a Desktop report: **Home → Publish** → choose a workspace.

## 7. Rolling out to the whole company (Power BI admin needed)

### 7a. Tenant settings

A **Fabric/Power BI administrator** controls these under **Admin portal → Tenant settings → Power BI visuals**:

| Setting | What it means for these visuals |
|---|---|
| **Allow visuals created using the Power BI SDK** | Must be enabled, for everyone or a security group, or the visuals won't load in the service. Admin-portal changes affect the **service** only; Desktop is governed by Group Policy. |
| **Add and use certified visuals only** | If enabled, uncertified visuals (including these) are blocked **unless** they're added as organizational visuals (below). |

### 7b. Organizational visuals (recommended)

An admin uploads each `.pbiviz` once under **Admin portal → Organizational visuals → Add visual → From a file**. Benefits:

- Everyone sees the visuals under **Get more visuals → My organization**, with no file handling.
- **One place to update:** upload a new version and every report picks it up.
- They work even when "certified visuals only" is on.

Send your admin this repo's `dist/` folder and point them to Microsoft's article "Manage Power BI visuals admin settings" (learn.microsoft.com/power-bi/admin/organizational-visuals).

### 7c. Updating a visual

Bump `tools/version.json` (e.g. `1.0.0.0` → `1.0.1.0`), run `npm run build`, and re-import or re-upload. Power BI ignores a re-import that has the **same** version number.

<a id="7-branding"></a>
### 7d. Branding

- `theme/LerchBates.theme.json`: in Desktop, **View → Themes (⌄) → Browse for themes**. It sets built-in chart colours, fonts and good/neutral/bad colours. It also includes `visualStyles` entries meant to set the LB visuals' **Brand colors** card, but whether Power BI applies theme styles to custom visuals hasn't been verified. Check after applying it.
- **The colour values are placeholders** (see README). When Marketing provides the official palette:
  1. Edit `shared/brand.ts` (the defaults compiled into the visuals).
  2. Edit `theme/LerchBates.theme.json`.
  3. Run `npm run build`, bump the version, and re-distribute.
- Logos: Power BI reports usually place the logo as an **Insert → Image** on the report page or in a page template, not inside a chart. No logo is embedded in these visuals.

## 8. Acceptance checklist

These visuals pass automated build, lint and render tests, but nobody has tested them by hand in Power BI yet. Before using them in client-facing reports, check each one with real data:

- [ ] Imports in Desktop without errors; the icon shows in the gallery
- [ ] Landing checklist shows when no fields are present
- [ ] Renders correctly with the sample CSV
- [ ] Renders correctly with a real LB dataset (blank values, long names, 1 row, 500+ rows)
- [ ] Tooltip shows the right values and number formats
- [ ] Clicking a mark cross-filters another visual; clicking blank space clears it
- [ ] Right-click opens the Power BI context menu
- [ ] Format pane changes apply and are saved when you close and reopen the .pbix
- [ ] Works after publishing to the service, including on the Power BI mobile app if you use it
- [ ] Export to PDF / PowerPoint looks right
- [ ] Windows high-contrast mode (Settings → Accessibility → Contrast themes) stays readable

Report issues with a screenshot and, if possible, an anonymised CSV.

## 9. For developers

```bash
npm install
npm run build                 # lint + package all visuals -> dist/
npm run test:render           # headless render test -> docs/img/
node tools/build-all.mjs sankey-flow   # one visual
```

Live reload against the Power BI service:

1. `cd visuals/<name> && npx pbiviz start` (serves the visual at https://localhost:8080).
2. In the service, enable **Settings → Developer → Power BI developer mode**, then add the **Developer visual** from the Visualizations pane.
3. The first time, trust the local certificate: `npx pbiviz install-cert`.

Notes:

- `shared/` is **copied** into each visual's `src/shared/` at build time (not imported across folders). pbiviz's webpack config uses `symlinks: false`, which would otherwise bundle two copies of the formatting library and break the Format pane.
- Format-pane objects for the shared **Brand colors** and **Text & labels** cards are injected into each `capabilities.json` by `tools/build-all.mjs`. Keep them in sync with `shared/settings.ts`.
- `powerbi-visuals-utils-formattingutils` is pinned to 6.1.2. Version 7.0.0 ships ES modules that the localisation loader in pbiviz 7.2.1 can't parse.
