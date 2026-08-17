# Agent Performance Hub

OBJECTIVE

Build a web application to upload an Excel file containing contact-center agent session data and display aggregated operational metrics per agent.

The application is intended for Workforce Management / operational monitoring.

The main goal is to transform raw session-level Excel data into a clear, visual and configurable agent-level performance table similar to the provided reference screenshot.

Do not expose SLA metrics in the final UI.

CURRENT DATA SOURCE

The application receives an .xlsx Excel file.

The current Excel structure contains these columns:

Sesión

Agente

Pupitre

Inicio sesión

Fin sesión

(WS) Tiempo de sesión

TAUX-WS

(TC-S) Total llamadas sesión

(TT) Tiempo en conversación

(ACW) Tiempo gestión llamada

(TPT) Total tiempo productivo

(PO)% Ocupación

SLA sesión

The application must map the Excel columns robustly by column name rather than relying only on column position.

Ignore SLA sesión completely from the user-facing metrics.

CORE FUNCTIONALITY

1. Excel upload

Provide a clear Excel upload area.

Supported format:

.xlsx

After uploading:

Validate that the required columns exist.

Parse the Excel file.

Validate dates and time-duration fields.

Ignore irrelevant columns such as SLA.

Aggregate records by agent.

Display the resulting agent metrics.

Show clear validation errors when:

The file is not an Excel file.

Required columns are missing.

The Excel structure cannot be parsed.

Numeric or time values contain invalid data.

Do not crash when individual rows contain empty optional values.

AGENT-LEVEL AGGREGATION

The Excel contains multiple session rows per agent.

Do NOT display one row per session in the main dashboard.

Aggregate all records belonging to the same agent.

For each agent calculate:

Agent

Unique agent name.

Sessions

COUNT(Sesión)

Count every session record, including short sessions with zero calls.

Total Calls

SUM((TC-S) Total llamadas sesión)

Conversation Time

SUM((TT) Tiempo en conversación)

Display as:

HH:MM:SS

ACW Time

SUM((ACW) Tiempo gestión llamada)

Display as:

HH:MM:SS

Total Productive Time

SUM((TPT) Total tiempo productivo)

Display as:

HH:MM:SS

Occupancy

Calculate from aggregated values:

Total Productive Time / Total Session Time × 100

Do NOT calculate the agent's final occupancy by averaging the occupancy percentages of individual sessions.

This is critical.

The calculation must use the aggregated underlying durations.

Display occupancy with one decimal place.

Example:

53.3%

LOAD CATEGORY

Each agent must receive a load category based on their aggregated occupancy.

The categories must NOT be hardcoded.

Create a configuration system allowing the administrator/user to define the thresholds.

Default configuration:

Baja: occupancy < 30%

Equilibrada: occupancy >= 30% and <= 60%

Alta: occupancy > 60%

The category must update automatically when the thresholds are changed.

The configuration should support:

Category name

Minimum occupancy

Maximum occupancy

Visual status

Ordering

Prevent overlapping or invalid ranges.

The UI should make it obvious that these thresholds are configurable business rules.

SHIFT CONFIGURATION

Each agent works in a predefined shift.

Create a configuration section where agents can be assigned to a shift.

Default shifts:

ShiftStartEndMañana07:0015:00Tarde15:0023:00Noche23:0007:00

The application must support cross-midnight shifts, especially the Night shift.

The agent's assigned shift must be configurable independently from the uploaded Excel.

Do not make automatic time inference the authoritative source for the agent's shift.

If an agent does not have a configured shift, display:

Sin turno asignado

Allow filtering the dashboard by:

Todos

Mañana

Tarde

Noche

Sin turno

MAIN DASHBOARD

Create a professional WFM-oriented dashboard.

The primary component is an agent metrics table.

Columns:

Agente

Turno

Sesiones

Llamadas

T. Conversación

T. ACW

T. Productivo

% Ocupación

Categoría de Carga

Do NOT include SLA.

Use the same visual hierarchy as the reference image but improve readability and usability.

OCCUPANCY VISUALIZATION

The % Ocupación column should use a visual status indicator.

Use a continuous background/heatmap or progress-style visualization.

Recommended semantic states:

Low occupancy → green

Balanced occupancy → yellow/green

High occupancy → orange/red

The colors must derive from the configurable load categories rather than being hardcoded independently.

Show the exact percentage numerically.

Example:

53.3%

TABLE FEATURES

The table should support:

Sorting by every numeric metric

Sorting by agent name

Sorting by shift

Sorting by load category

Filtering by shift

Searching agents by name

Responsive horizontal scrolling on small screens

Default sorting:

Highest number of calls first.

Maintain clear visual hierarchy and avoid excessive UI decoration.

SUMMARY KPIs

Above the table display a compact summary section.

Show:

Total agents

Total sessions

Total calls

Total productive time

Average occupancy

Agents with Low Load

Agents with Balanced Load

Agents with High Load

Average occupancy must be calculated from the aggregated data according to a clearly defined methodology.

Prefer a weighted operational interpretation rather than averaging session percentages.

DATA PERIOD

Use Inicio sesión and Fin sesión to determine the operational date.

Provide a date filter when the uploaded Excel contains multiple operational dates.

The user should be able to select:

All dates

Specific date

If the file only contains one date, automatically select that date.

AGENT DETAIL

Allow the user to click an agent and open a detail panel/modal.

Display:

Agent name

Assigned shift

Number of sessions

Total calls

Total conversation time

Total ACW

Total productive time

Occupancy

Load category

Also display the underlying sessions for that agent:

Session ID

Start

End

Session duration

Calls

Conversation time

ACW

Productive time

Occupancy

Do not display SLA.

This detail view is intended for operational analysis, while the main table remains the primary visualization.

CONFIGURATION AREA

Create a dedicated Configuration section.

Load Categories

Allow editing:

Category name

Minimum %

Maximum %

Category status

Include the default categories:

Baja

Equilibrada

Alta

Shifts

Allow configuration of:

Shift name

Start time

End time

Preconfigure:

Mañana: 07:00–15:00

Tarde: 15:00–23:00

Noche: 23:00–07:00

Agent Assignment

Allow assigning each detected agent to one of the configured shifts.

The assignment should persist while working with the application.

DATA MODEL

Use a clean separation between:

Raw session data

Imported Excel records.

Agent configuration

Agent name

Assigned shift

Shift configuration

Name

Start time

End time

Load category configuration

Name

Minimum occupancy

Maximum occupancy

Display status

Do not modify the database architecture unnecessarily if the project already has an existing persistence layer.

If this is a new application, use a maintainable typed data model.

IMPORT BEHAVIOR

When a new Excel file is uploaded:

Parse the file.

Validate its structure.

Replace the current imported dataset.

Preserve existing agent shift assignments whenever the agent name matches.

Recalculate all metrics.

Refresh the dashboard.

Do not delete configuration settings when importing a new Excel file.

EDGE CASES

Handle:

Agents with multiple sessions.

Sessions with zero calls.

Sessions with zero productive time.

Missing occupancy values.

Sessions crossing midnight.

Night shift crossing midnight.

Empty optional values.

Duplicate session records.

Agents appearing in the Excel for the first time.

Agents no longer present in a new Excel file.

Invalid duration values.

Invalid dates.

Missing shift assignment.

Occupancy exactly on a category threshold.

Do not silently produce incorrect calculations.

UX STATES

Implement:

Empty state before uploading an Excel file.

Upload/loading state.

Import success state.

Import validation error.

Empty dataset.

No results after filtering.

Configuration state.

Agent without assigned shift.

Provide concise and actionable error messages.

RESPONSIVE DESIGN

Desktop:

Full dashboard

KPI cards

Complete data table

Configuration navigation

Tablet:

Maintain table usability

Allow horizontal scrolling where necessary

Mobile:

Responsive KPI cards

Horizontally scrollable metrics table

Agent detail accessible through a modal/drawer

Configuration screens optimized for touch

Do not sacrifice the readability of numerical metrics.

ARCHITECTURE

Use:

React

TypeScript

Reusable components

Strong typing

Separation between data processing, business logic and presentation

Reusable table components

Reusable configuration components

Create dedicated services/utilities for:

Excel parsing

Data validation

Agent aggregation

Occupancy calculation

Load categorization

Shift management

Do not put all business logic inside the main dashboard component.

Avoid unnecessary dependencies.

VISUAL DESIGN

The application should feel like an internal Workforce Management operational tool.

Prioritize:

Data density

Readability

Clear status indicators

Consistent spacing

Strong table hierarchy

Easy scanning of occupancy

Professional neutral UI

Accessible contrast

Avoid excessive cards, gradients, animations or decorative elements.

The metrics table is the most important component of the application.

CONSTRAINTS

Do not display SLA.

Do not expose SLA in the main table or agent detail.

Do not calculate occupancy by averaging individual session percentages.

Do not hardcode load-category thresholds.

Do not hardcode agent shifts.

Preserve configuration when importing a new Excel.

Do not modify unrelated functionality.

Do not introduce unnecessary dependencies.

Keep business logic separate from presentation.

Use the uploaded Excel structure as the source model.

Do not assume that one Excel row equals one final agent record.

ACCEPTANCE CRITERIA

The user can upload the provided Excel file successfully.

The application validates the Excel structure before processing it.

Multiple sessions belonging to the same agent are correctly aggregated.

Session count includes short/zero-call sessions.

Total calls are summed correctly.

Conversation time, ACW and productive time are summed correctly.

Occupancy is calculated from aggregated durations, not by averaging session percentages.

SLA is not displayed anywhere in the operational dashboard.

Load categories are configurable.

Changing category thresholds recalculates agent categories.

Shifts are configurable.

Agents can be assigned to Mañana, Tarde or Noche.

Night shift correctly supports 23:00–07:00.

Shift assignments survive Excel re-imports when the agent still exists.

The dashboard can filter agents by shift.

The dashboard supports search and sorting.

Agent details can be opened from the main table.

Empty, loading and error states are implemented.

The application works on desktop, tablet and mobile.

No unrelated functionality is introduced.

The provided Excel produces agent-level results consistent with the reference screenshot.

Before implementation, inspect the current project architecture and existing components/design system if this is being added to an existing Lovable project. Reuse existing patterns wherever possible.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/344bebb4-53d7-492e-858f-a43b3fddb3d8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
