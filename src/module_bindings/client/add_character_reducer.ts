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

import { AddCharacterInput as __AddCharacterInput } from "./add_character_input_type";

export type AddCharacter = {
  inputCharacter: __AddCharacterInput,
};

/**
 * A namespace for generated helper functions.
 */
export namespace AddCharacter {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
      new ProductTypeElement("inputCharacter", __AddCharacterInput.getTypeScriptAlgebraicType()),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: AddCharacter): void {
    AddCharacter.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): AddCharacter {
    return AddCharacter.getTypeScriptAlgebraicType().deserialize(reader);
  }

}

