/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentActivity from "../agentActivity.js";
import type * as analytics from "../analytics.js";
import type * as auditLogs from "../auditLogs.js";
import type * as export_ from "../export.js";
import type * as fileSyncQueue from "../fileSyncQueue.js";
import type * as fileVersions from "../fileVersions.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as projects from "../projects.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as recommend from "../recommend.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as tasks from "../tasks.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentActivity: typeof agentActivity;
  analytics: typeof analytics;
  auditLogs: typeof auditLogs;
  export: typeof export_;
  fileSyncQueue: typeof fileSyncQueue;
  fileVersions: typeof fileVersions;
  http: typeof http;
  notifications: typeof notifications;
  projects: typeof projects;
  rateLimiter: typeof rateLimiter;
  recommend: typeof recommend;
  search: typeof search;
  seed: typeof seed;
  tasks: typeof tasks;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
