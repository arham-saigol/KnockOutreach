/* eslint-disable */
// This bootstrap mirrors Convex codegen so the Next.js build can run before a
// deployment is attached. `npx convex deploy` regenerates it from cloud state.
import { anyApi, componentsGeneric } from "convex/server";
export const api = anyApi;
export const internal = anyApi;
export const components = componentsGeneric();
