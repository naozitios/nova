/** Meta data contract registry — read contracts for Meta Marketing API objects. */

export type MetaContractObjectType = "campaign" | "ad_set" | "ad" | "creative" | "insight";

export interface MetaDataContract {
  contractId: string;
  version: string;
  objectType: MetaContractObjectType;
  endpoint: string;
  fields: string[];
  requiredPermissions: string[];
  grain: string;
  validationKeys: string[];
  level?: string;
  cadence?: { initial_backfill: string; incremental: string };
}

export const META_DATA_CONTRACTS: MetaDataContract[] = [
  {
    contractId: "account.campaigns",
    version: "1.0",
    objectType: "campaign",
    endpoint: "/act_{account_id}/campaigns",
    fields: [
      "id",
      "name",
      "objective",
      "effective_status",
      "configured_status",
      "buying_type",
      "start_time",
      "stop_time",
      "created_time",
      "updated_time",
    ],
    requiredPermissions: ["ads_read"],
    grain: "account",
    validationKeys: ["id", "name", "objective"],
  },
  {
    contractId: "account.adsets",
    version: "1.0",
    objectType: "ad_set",
    endpoint: "/act_{account_id}/adsets",
    fields: [
      "id",
      "campaign_id",
      "name",
      "optimization_goal",
      "billing_event",
      "effective_status",
      "configured_status",
      "daily_budget",
      "lifetime_budget",
      "start_time",
      "end_time",
      "created_time",
      "updated_time",
    ],
    requiredPermissions: ["ads_read"],
    grain: "account",
    validationKeys: ["id", "campaign_id", "name"],
  },
  {
    contractId: "account.ads",
    version: "1.0",
    objectType: "ad",
    endpoint: "/act_{account_id}/ads",
    fields: [
      "id",
      "campaign_id",
      "adset_id",
      "name",
      "effective_status",
      "configured_status",
      "creative{id}",
      "created_time",
      "updated_time",
    ],
    requiredPermissions: ["ads_read"],
    grain: "account",
    validationKeys: ["id", "campaign_id", "adset_id", "name"],
  },
  {
    contractId: "account.creatives",
    version: "1.0",
    objectType: "creative",
    endpoint: "/act_{account_id}/adcreatives",
    fields: [
      "id",
      "name",
      "title",
      "body",
      "object_story_spec",
      "asset_feed_spec",
      "thumbnail_url",
      "image_url",
      "video_id",
      "effective_object_story_id",
    ],
    requiredPermissions: ["ads_read"],
    grain: "account",
    validationKeys: ["id", "name"],
  },
  {
    contractId: "insights.ad_daily.v1",
    version: "1.0",
    objectType: "insight",
    endpoint: "/{ad_account_id}/insights",
    fields: [
      "date_start",
      "date_stop",
      "campaign_id",
      "adset_id",
      "ad_id",
      "spend",
      "impressions",
      "reach",
      "clicks",
      "actions",
      "action_values",
    ],
    requiredPermissions: ["ads_read"],
    grain: "ad_daily",
    validationKeys: ["date_start", "date_stop", "campaign_id", "ad_id"],
    level: "ad",
    cadence: {
      initial_backfill: "37d",
      incremental: "1d",
    },
  },
];

export function getMetaContractsForObject(
  objectType: MetaContractObjectType,
): MetaDataContract[] {
  return META_DATA_CONTRACTS.filter((c) => c.objectType === objectType);
}
