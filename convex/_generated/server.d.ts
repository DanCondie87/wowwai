/* eslint-disable */
/**
 * Generated server utilities — stub until `npx convex dev` generates real types.
 */
import type {
  GenericQueryCtx,
  GenericMutationCtx,
  RegisteredQuery,
  RegisteredMutation,
  RegisteredAction,
  FunctionReference,
} from "convex/server";
import type { DataModel } from "./dataModel";

type QueryBuilder = typeof import("convex/server").queryGeneric;
type MutationBuilder = typeof import("convex/server").mutationGeneric;
type InternalMutationBuilder = typeof import("convex/server").internalMutationGeneric;
type InternalQueryBuilder = typeof import("convex/server").internalQueryGeneric;
type ActionBuilder = typeof import("convex/server").actionGeneric;
type InternalActionBuilder = typeof import("convex/server").internalActionGeneric;
type HttpActionBuilder = typeof import("convex/server").httpActionGeneric;

export declare const query: QueryBuilder;
export declare const internalQuery: InternalQueryBuilder;
export declare const mutation: MutationBuilder;
export declare const internalMutation: InternalMutationBuilder;
export declare const action: ActionBuilder;
export declare const internalAction: InternalActionBuilder;
export declare const httpAction: HttpActionBuilder;
