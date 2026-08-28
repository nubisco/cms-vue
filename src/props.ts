/**
 * Prop helpers: the getSliceComponentProps equivalent.
 *
 * A product's block component declares what every block component gets, without
 * restating the contract in each file and without drifting from it:
 *
 *   const props = defineProps(getBlockComponentProps())
 *   // or, typed to this block's own fields:
 *   const props = defineProps(getBlockComponentProps<HeroFields>())
 *
 * `block` is required and is the only prop CmsZone passes today. `index`,
 * `blocks` and `context` are optional and arrive only from a zone rendered with
 * `provide-block-props`, so adding this helper to an existing component changes
 * nothing about what it renders.
 */
import type { PropType } from 'vue'
import type { BlockInstance, FieldValue } from '@nubisco/cms-core'

/** A block instance narrowed to the fields one block type declares. */
export interface TypedBlock<TFields extends Record<string, FieldValue> = Record<string, FieldValue>>
  extends BlockInstance {
  fields: TFields
}

export interface BlockComponentProps<
  TFields extends Record<string, FieldValue> = Record<string, FieldValue>,
  TContext = unknown,
> {
  block: TypedBlock<TFields>
  /** Position within the zone, for a block whose look depends on where it sits. */
  index?: number
  /** Every block in the zone, for a block that must know its neighbours. */
  blocks?: BlockInstance[]
  /** Whatever the host passed to the zone: a locale, a feature-flag bag, a route. */
  context?: TContext
}

/**
 * The runtime props definition matching BlockComponentProps. Returned fresh on
 * every call, because Vue mutates the object it is handed.
 */
export function getBlockComponentProps<
  TFields extends Record<string, FieldValue> = Record<string, FieldValue>,
  TContext = unknown,
>() {
  return {
    block: {
      type: Object as PropType<TypedBlock<TFields>>,
      required: true as const,
    },
    index: {
      type: Number as PropType<number>,
      required: false as const,
      default: 0,
    },
    blocks: {
      type: Array as PropType<BlockInstance[]>,
      required: false as const,
      default: () => [] as BlockInstance[],
    },
    context: {
      type: null as unknown as PropType<TContext>,
      required: false as const,
      default: undefined as TContext | undefined,
    },
  }
}

/**
 * Declare a block's fields once and get both the runtime props and the type.
 * `defineBlock<HeroFields>()` is the shorthand a product block uses when it also
 * wants the field type exported for its schema.
 */
export function defineBlock<TFields extends Record<string, FieldValue>>() {
  return getBlockComponentProps<TFields>()
}
