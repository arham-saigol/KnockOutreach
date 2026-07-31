/* eslint-disable */
import type { AnyDataModel, GenericId } from "convex/server";
export type DataModel = AnyDataModel;
export type Id<TableName extends string> = GenericId<TableName>;
export type Doc<TableName extends string> = Record<string, any> & {
  _id: Id<TableName>;
  _creationTime: number;
};
