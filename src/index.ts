// The framework-agnostic core, re-exported WHOLESALE and on purpose. A site
// installs @nubisco/cms-vue and gets the contract, field resolution, the logic
// graph and the link/image/richtext models with it, so it never has to name
// @nubisco/cms-core in its own package.json or import from two places to render
// one block. The same will hold for a future @nubisco/cms-react.
export * from '@nubisco/cms-core'

// Vue bindings: the half of this library that cannot live in the core.
export * from './context'
export * from './useField'

// The client: configure a site once, then read documents from delivery.
export * from './client'
export * from './usePage'
export * from './usePartial'

// Prop helpers for product block components.
export * from './props'

export { default as CmsText } from './CmsText.vue'
export { default as CmsZone } from './CmsZone.vue'
export { default as CmsRichText } from './CmsRichText.vue'
export { default as CmsLink } from './CmsLink.vue'
export { default as CmsImage } from './CmsImage.vue'
