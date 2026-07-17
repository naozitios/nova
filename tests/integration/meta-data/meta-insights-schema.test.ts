import { describe, expect } from "vitest";
import {
  requireEnv,
  itDb,
  tableExists,
  getColumns,
  indexExists,
} from "../business-context/db-introspect-helpers";

describe("meta_insights_daily schema", () => {
  requireEnv();

  itDb("creates meta_insights_daily table", async () => {
    const exists = await tableExists("meta_insights_daily");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_insights_daily");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "workspace_id",
      "meta_ad_account_id",
      "meta_campaign_id",
      "meta_ad_set_id",
      "meta_ad_id",
      "date_start",
      "date_stop",
      "spend",
      "impressions",
      "reach",
      "clicks",
      "actions",
      "action_values",
      "attribution_setting",
      "currency",
      "account_timezone",
      "data_completeness_state",
      "meta_sync_run_id",
      "api_version",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has idx_meta_insights_daily_unique_provider index", async () => {
    const exists = await indexExists(
      "meta_insights_daily",
      "idx_meta_insights_daily_unique_provider",
    );
    expect(exists).toBe(true);
  });

  itDb("has idx_meta_insights_daily_account_date index", async () => {
    const exists = await indexExists(
      "meta_insights_daily",
      "idx_meta_insights_daily_account_date",
    );
    expect(exists).toBe(true);
  });

  itDb("has idx_meta_insights_daily_ad_date index", async () => {
    const exists = await indexExists(
      "meta_insights_daily",
      "idx_meta_insights_daily_ad_date",
    );
    expect(exists).toBe(true);
  });
});
