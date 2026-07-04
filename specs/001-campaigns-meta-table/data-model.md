# Data Model: Campaigns Meta Table

## CampaignTableRow

Represents one visible row in the Campaigns table.

Fields:
- `id`: campaign id
- `name`: campaign name
- `status`: delivery/status value
- `objective`: campaign objective
- `platform`: primary platform
- `totalBudget`: campaign budget
- `startDate`: campaign start date
- `endDate`: campaign end date
- `createdAt`: campaign creation timestamp
- `updatedAt`: campaign update timestamp
- `adSetName`: first ad set name, if available
- `adSetId`: first ad set id, if available
- `bidAmount`: first ad set bid amount, if available
- `countries`: first ad set country targets, if available

Validation rules:
- Rows must be derived only from existing campaign data.
- Missing supported optional values render as empty or unavailable display states, not fake metrics.
- Unsupported metrics are not included in row values.

## ColumnDefinition

Represents one Meta-style column option.

Fields:
- `id`: stable column id
- `label`: user-facing label
- `category`: Meta-style category
- `supported`: whether current data can produce a real value
- `disabledReason`: reason shown for unsupported columns
- `defaultVisible`: whether the supported default view includes it
- `format`: display behavior for values

Validation rules:
- Unsupported columns cannot be added to the active table.
- Default visible columns must all be supported.
- Column ids must be stable for export and toggling.

## FilterState

Represents active table filters.

Fields:
- `search`: free-text search
- `statuses`: selected status/delivery values
- `objectives`: selected objectives
- `platforms`: selected platforms
- `dateRange`: optional date window
- `countries`: selected target countries

Validation rules:
- Filters apply only to supported fields.
- Unsupported filters are disabled or unavailable.
- Clearing filters restores the full campaign set.

## ExportRequest

Represents a frontend export action.

Fields:
- `format`: CSV, Excel disabled/optional, PDF disabled
- `columns`: currently visible supported columns
- `rows`: currently filtered rows
- `status`: idle, confirming, exporting, success, unavailable

Validation rules:
- Export uses only visible columns and filtered rows.
- Export is unavailable when there are no exportable rows or columns.
- Export does not call backend infrastructure.
