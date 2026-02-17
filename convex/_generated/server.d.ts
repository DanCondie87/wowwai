/* eslint-disable */
/**
 * Generated server utilities — stub until `npx convex dev` generates real types.
 */
import type {
  QueryBuilder,
  MutationBuilder,
  ActionBuilder,
  InternalQueryBuilder,
  InternalMutationBuilder,
  InternalActionBuilder,
  HttpActionBuilder,
} from "convex/server";
import type { DataModel } from "./dataModel";

export declare const query: QueryBuilder<DataModel, "public">;
export declare const internalQuery: InternalQueryBuilder<DataModel>;
export declare const mutation: MutationBuilder<DataModel, "public">;
export declare const internalMutation: InternalMutationBuilder<DataModel>;
export declare const action: ActionBuilder<DataModel, "public">;
export declare const internalAction: InternalActionBuilder<DataModel>;
export declare const httpAction: HttpActionBuilder;
