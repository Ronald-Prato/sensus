/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as lib_profileAuth from "../lib/profileAuth.js";
import type * as lib_profileValidation from "../lib/profileValidation.js";
import type * as lib_wordTypes from "../lib/wordTypes.js";
import type * as profileActions from "../profileActions.js";
import type * as profiles from "../profiles.js";
import type * as wordProcessing from "../wordProcessing.js";
import type * as wordProcessingCallbacks from "../wordProcessingCallbacks.js";
import type * as wordProcessingData from "../wordProcessingData.js";
import type * as words from "../words.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "lib/profileAuth": typeof lib_profileAuth;
  "lib/profileValidation": typeof lib_profileValidation;
  "lib/wordTypes": typeof lib_wordTypes;
  profileActions: typeof profileActions;
  profiles: typeof profiles;
  wordProcessing: typeof wordProcessing;
  wordProcessingCallbacks: typeof wordProcessingCallbacks;
  wordProcessingData: typeof wordProcessingData;
  words: typeof words;
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

export declare const components: {
  wordProcessing: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"wordProcessing">;
};
