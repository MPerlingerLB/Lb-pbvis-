// Sample data for every visual. The same tables are exported to samples/*.csv for users to try the visuals,
// and turned into Power BI-shaped DataViews for the render test.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));
const addDays = (dt, n) => new Date(dt.getTime() + n * 864e5);

function dailyCalls() {
    const rows = [];
    for (let i = 0; i < 365; i++) {
        const d = addDays(day(2025, 11, 1), i);
        const dow = d.getUTCDay();
        const base = dow === 0 || dow === 6 ? 3 : 18;
        const season = 1 + 0.35 * Math.sin((i / 365) * 2 * Math.PI);
        rows.push([d, Math.round(base * season + rnd() * 8)]);
    }
    return rows;
}

function turnaround() {
    const rows = [];
    for (let i = 1; i <= 40; i++) {
        const shift = i === 23 ? 9 : i > 30 ? 2.5 : 0; // a spike and a sustained shift for the rules to find
        rows.push([addDays(day(2026, 1, 5), (i - 1) * 7), +(12 + shift + (rnd() - 0.5) * 5).toFixed(1)]);
    }
    return rows;
}

function durations() {
    const offices = { Denver: 14, Chicago: 18, Dallas: 11, Atlanta: 21, Seattle: 16 };
    const rows = [];
    let id = 1;
    for (const [o, mu] of Object.entries(offices)) {
        for (let k = 0; k < 28; k++) rows.push([o, `P-${String(id++).padStart(4, "0")}`, Math.max(2, Math.round(mu + (rnd() + rnd() + rnd() - 1.5) * mu * 0.6 + (k === 3 ? mu * 1.8 : 0)))]);
    }
    return rows;
}

export const fixtures = {
    "bullet-chart": {
        file: "bullet-chart_office-utilization.csv",
        columns: ["Office", "Utilization", "Target"],
        types: { Office: "text", Utilization: "number", Target: "number" },
        formats: { Utilization: "0.0%", Target: "0.0%" },
        rows: [["Denver", 0.82, 0.8], ["Chicago", 0.74, 0.8], ["Dallas", 0.61, 0.78], ["Atlanta", 0.79, 0.8], ["Seattle", 0.88, 0.82], ["New York", 0.7, 0.85]],
        roles: { category: "Office", actual: "Utilization", target: "Target" }
    },
    "calendar-heatmap": {
        file: "calendar-heatmap_daily-service-calls.csv",
        columns: ["Date", "Service Calls"],
        types: { Date: "date", "Service Calls": "number" },
        rows: dailyCalls(),
        roles: { date: "Date", value: "Service Calls" },
        width: 900, height: 260
    },
    "pareto-chart": {
        file: "pareto-chart_callback-causes.csv",
        columns: ["Root Cause", "Callbacks"],
        types: { "Root Cause": "text", Callbacks: "number" },
        rows: [["Door operator", 142], ["Leveling", 88], ["Controller fault", 61], ["Hall button", 37], ["Vandalism", 22], ["Hoistway debris", 18], ["Power loss", 14], ["Fixture lighting", 9], ["Other", 12]],
        roles: { category: "Root Cause", value: "Callbacks" }
    },
    "control-chart": {
        file: "control-chart_weekly-report-turnaround.csv",
        columns: ["Week", "Avg Turnaround (days)"],
        types: { Week: "date", "Avg Turnaround (days)": "number" },
        formats: { "Avg Turnaround (days)": "0.0" },
        rows: turnaround(),
        roles: { axis: "Week", value: "Avg Turnaround (days)" },
        width: 860
    },
    "box-plot": {
        file: "box-plot_project-duration-by-office.csv",
        columns: ["Office", "Project", "Duration (weeks)"],
        types: { Office: "text", Project: "text", "Duration (weeks)": "number" },
        rows: durations(),
        roles: { category: "Office", sample: "Project", value: "Duration (weeks)" }
    },
    "sankey-flow": {
        file: "sankey-flow_proposal-pipeline.csv",
        columns: ["From", "To", "Proposals"],
        types: { From: "text", To: "text", Proposals: "number" },
        rows: [
            ["Referral", "Proposal sent", 48], ["Website", "Proposal sent", 31], ["Repeat client", "Proposal sent", 64], ["RFP portal", "Proposal sent", 40],
            ["Proposal sent", "Won", 92], ["Proposal sent", "Lost", 61], ["Proposal sent", "No decision", 30],
            ["Won", "Modernization", 38], ["Won", "New construction", 29], ["Won", "Maintenance audit", 25]
        ],
        roles: { source: "From", target: "To", weight: "Proposals" },
        width: 860
    },
    "baseline-gantt": {
        file: "baseline-gantt_modernization-schedule.csv",
        columns: ["Phase", "Task", "Planned Start", "Planned Finish", "Actual Start", "Actual Finish", "% Complete"],
        types: { Phase: "text", Task: "text", "Planned Start": "date", "Planned Finish": "date", "Actual Start": "date", "Actual Finish": "date", "% Complete": "number" },
        formats: { "% Complete": "0%" },
        rows: [
            ["Design", "Site survey", day(2026, 6, 1), day(2026, 6, 12), day(2026, 6, 1), day(2026, 6, 15), 1],
            ["Design", "Specifications", day(2026, 6, 15), day(2026, 7, 10), day(2026, 6, 18), day(2026, 7, 17), 1],
            ["Procurement", "Bid & award", day(2026, 7, 13), day(2026, 8, 14), day(2026, 7, 20), day(2026, 8, 28), 1],
            ["Procurement", "Submittal review", day(2026, 8, 17), day(2026, 9, 4), day(2026, 8, 31), day(2026, 9, 18), 1],
            ["Construction", "Equipment lead time", day(2026, 9, 7), day(2026, 11, 27), day(2026, 9, 21), day(2026, 12, 11), 0.6],
            ["Construction", "Car 1 install", day(2026, 11, 30), day(2027, 1, 22), null, null, 0],
            ["Construction", "Car 2 install", day(2027, 1, 25), day(2027, 3, 19), null, null, 0],
            ["Closeout", "Acceptance testing", day(2027, 3, 22), day(2027, 4, 2), null, null, 0]
        ],
        roles: { group: "Phase", task: "Task", start: "Planned Start", end: "Planned Finish", actualStart: "Actual Start", actualEnd: "Actual Finish", progress: "% Complete" },
        width: 900, height: 360
    },
    "milestone-timeline": {
        file: "milestone-timeline_project-milestones.csv",
        columns: ["Project", "Milestone", "Date", "Status"],
        types: { Project: "text", Milestone: "text", Date: "date", Status: "text" },
        rows: [
            ["Tower A mod", "Kickoff", day(2026, 7, 6), "Complete"], ["Tower A mod", "Design 50%", day(2026, 8, 21), "Complete"],
            ["Tower A mod", "Permit", day(2026, 10, 9), "At risk"], ["Tower A mod", "Car 1 turnover", day(2027, 1, 15), "Planned"],
            ["Hospital audit", "Site visit", day(2026, 9, 2), "Complete"], ["Hospital audit", "Draft report", day(2026, 10, 1), "Late"],
            ["Hospital audit", "Final report", day(2026, 11, 13), "Planned"],
            ["Campus survey", "Fieldwork", day(2026, 8, 10), "Complete"], ["Campus survey", "Owner workshop", day(2026, 11, 4), "Planned"],
            ["Campus survey", "Capital plan", day(2026, 12, 18), "Planned"]
        ],
        roles: { lane: "Project", label: "Milestone", date: "Date", status: "Status" },
        width: 900, height: 320
    },
    "variance-chart": {
        file: "variance-chart_monthly-revenue-vs-plan.csv",
        columns: ["Month", "Actual Revenue", "Plan Revenue"],
        types: { Month: "text", "Actual Revenue": "number", "Plan Revenue": "number" },
        formats: { "Actual Revenue": "\\$#,0", "Plan Revenue": "\\$#,0" },
        rows: [["Jan", 410000, 400000], ["Feb", 385000, 405000], ["Mar", 452000, 420000], ["Apr", 431000, 425000], ["May", 398000, 430000], ["Jun", 470000, 440000], ["Jul", 455000, 445000], ["Aug", 418000, 450000], ["Sep", 489000, 455000]],
        roles: { category: "Month", actual: "Actual Revenue", plan: "Plan Revenue" },
        width: 860
    },
    "status-grid": {
        file: "status-grid_project-portfolio.csv",
        columns: ["Project", "Status", "Project Manager", "Budget Used"],
        types: { Project: "text", Status: "text", "Project Manager": "text", "Budget Used": "number" },
        formats: { "Budget Used": "0%" },
        rows: [
            ["Tower A modernization", "Green", "J. Rivera", 0.42], ["Hospital VT audit", "Amber", "K. Chen", 0.77], ["Campus survey", "Green", "A. Patel", 0.31],
            ["Airport escalators", "Red", "M. Okafor", 1.08], ["Office park due diligence", "Green", "S. Larsen", 0.55], ["Hotel retrofit", "Amber", "D. Novak", 0.83],
            ["Stadium new build", "Green", "R. Silva", 0.18], ["Residential tower", "Red", "T. Brooks", 0.96]
        ],
        roles: { item: "Project", status: "Status", subtitle: "Project Manager", metric: "Budget Used" },
        width: 860, height: 380
    }
};

/** Which roles are Grouping (vs Measure) in each visual's capabilities, and how data is mapped. */
export const roleKinds = {
    "bullet-chart": { mapping: "categorical", grouping: ["category"] },
    "calendar-heatmap": { mapping: "categorical", grouping: ["date"] },
    "pareto-chart": { mapping: "categorical", grouping: ["category"] },
    "control-chart": { mapping: "categorical", grouping: ["axis"] },
    "box-plot": { mapping: "categorical", grouping: ["category", "sample"] },
    "sankey-flow": { mapping: "categorical", grouping: ["source", "target"] },
    "baseline-gantt": { mapping: "table", grouping: ["group", "task", "start", "end", "actualStart", "actualEnd"] },
    "milestone-timeline": { mapping: "table", grouping: ["lane", "label", "date", "status"] },
    "variance-chart": { mapping: "categorical", grouping: ["category"] },
    "status-grid": { mapping: "categorical", grouping: ["item", "status", "subtitle"] }
};

const typeOf = t => t === "date" ? { dateTime: true } : t === "number" ? { numeric: true } : { text: true };

export function toDataView(fx) {
    const dir = Object.keys(fixtures).find(k => fixtures[k] === fx);
    const kind = roleKinds[dir];
    const col = name => fx.columns.indexOf(name);
    const roleEntries = Object.entries(fx.roles);
    const meta = (role, name, idx) => ({ displayName: name, queryName: `T.${name}`, roles: { [role]: true }, type: typeOf(fx.types[name]), format: fx.formats?.[name], isMeasure: !kind.grouping.includes(role), index: idx });

    if (kind.mapping === "table") {
        const columns = roleEntries.map(([role, name], i) => meta(role, name, i));
        const rows = fx.rows.map(r => roleEntries.map(([, name]) => r[col(name)]));
        return { metadata: { columns }, table: { columns, rows } };
    }
    const groupRoles = roleEntries.filter(([role]) => kind.grouping.includes(role));
    const measureRoles = roleEntries.filter(([role]) => !kind.grouping.includes(role));
    const groups = new Map();
    for (const r of fx.rows) {
        const key = groupRoles.map(([, n]) => String(r[col(n)])).join("\u0001");
        if (!groups.has(key)) groups.set(key, { keys: groupRoles.map(([, n]) => r[col(n)]), sums: measureRoles.map(() => 0) });
        measureRoles.forEach(([, n], i) => { groups.get(key).sums[i] += r[col(n)] ?? 0; });
    }
    const list = [...groups.values()];
    const categories = groupRoles.map(([role, name], gi) => ({ source: meta(role, name, gi), values: list.map(g => g.keys[gi]) }));
    const values = measureRoles.map(([role, name], mi) => ({ source: meta(role, name, groupRoles.length + mi), values: list.map(g => g.sums[mi]) }));
    return { metadata: { columns: [...categories.map(c => c.source), ...values.map(v => v.source)] }, categorical: { categories, values } };
}
