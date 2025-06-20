// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  type CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  type DbContext,
  type ErrorContextInterface,
  type Event,
  type EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  type ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  type SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";

export type ClearCharacters = {};

/**
 * A namespace for generated helper functions.
 */
export namespace ClearCharacters {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
    ]);
  }

  export function serialize(writer: BinaryWriter, value: ClearCharacters): void {
    ClearCharacters.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): ClearCharacters {
    return ClearCharacters.getTypeScriptAlgebraicType().deserialize(reader);
  }

}

