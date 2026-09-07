// GENERATED — `npm run gen:component-color-fields`. Do not hand-edit.
// See scripts/gen-component-color-fields.ts for what this is and why.

import type { PreviewColorField } from './previewColorFields'

/** Component catalogue key → the PreviewTokens color fields its own
 *  specimen (docs/specimens.tsx) actually reads, transitively through
 *  any shared helper it calls. A key absent from this map has no scoped
 *  color data yet — its agent context falls back to the full palette. */
export const COMPONENT_COLOR_FIELDS: Record<string, PreviewColorField[]> = {
  "Accordion": ['surface', 'neutralFill', 'neutralText', 'borderDefault', 'fgMuted'],
  "AlertBanner": ['brandSolid', 'neutralText', 'errorColor', 'fgMuted', 'successColor', 'warningColor', 'infoColor'],
  "AppStoreBadge": ['neutralText'],
  "AspectRatio": ['brandSolid', 'brandText', 'neutralText', 'borderDefault'],
  "Avatar": ['brandSolid', 'brandText', 'neutralText'],
  "Badge": ['brandSolid', 'brandText', 'onBrand', 'neutralFill', 'neutralText', 'errorColor', 'fgMuted', 'successColor', 'warningColor', 'infoColor'],
  "Breadcrumb": ['neutralText', 'fgMuted', 'placeholderText'],
  "Button": ['brandSolid', 'brandText', 'onBrand', 'neutralText', 'errorColor', 'disabledBg', 'disabledText', 'successColor', 'warningColor', 'infoColor', 'ghostBrandHover', 'ghostBrandPressed'],
  "ButtonGroup": ['neutralFill', 'neutralText', 'border'],
  "Card": ['brandText', 'neutralText', 'borderDefault', 'fgMuted'],
  "Checkbox": ['brandSolid', 'onBrand', 'neutralText', 'disabledBg', 'disabledText', 'border', 'inputSurface'],
  "CheckboxGroup": ['brandSolid', 'onBrand', 'neutralText', 'border', 'fgMuted', 'inputSurface'],
  "Chip": ['brandSolid', 'brandText', 'neutralText', 'border', 'selectedSurface'],
  "CloseButton": ['brandSolid', 'neutralText', 'fgMuted', 'ghostNeutralHover', 'ghostNeutralPressed'],
  "Combobox": ['brandSolid', 'brandText', 'neutralText', 'border', 'borderDefault', 'fgMuted', 'placeholderText', 'inputSurface'],
  "Command": ['neutralFill', 'neutralText', 'borderDefault', 'fgMuted', 'placeholderText'],
  "ContextMenu": ['neutralText', 'errorColor', 'borderDefault', 'placeholderText', 'ghostNeutralHover'],
  "Divider": ['borderDefault'],
  "DropdownMenu": ['surface', 'neutralFill', 'neutralText', 'errorColor', 'border', 'borderDefault', 'fgMuted', 'placeholderText', 'ghostNeutralHover'],
  "Dropzone": ['brandSolid', 'brandText', 'neutralText', 'errorColor', 'border', 'fgMuted'],
  "FABButton": ['brandSolid', 'onBrand'],
  "Field": ['neutralText', 'errorColor', 'border', 'fgMuted', 'inputSurface'],
  "FileFormat": ['surface', 'neutralFill', 'border'],
  "FileUpload": ['surface', 'brandSolid', 'brandText', 'neutralFill', 'neutralText', 'border', 'borderDefault', 'fgMuted'],
  "InfoTooltip": ['surface', 'neutralText', 'fgMuted'],
  "InlineAlert": ['brandSolid', 'neutralText', 'errorColor', 'fgMuted', 'successColor', 'warningColor', 'infoColor'],
  "Input": ['brandSolid', 'neutralText', 'errorColor', 'disabledBg', 'disabledText', 'border', 'fgMuted', 'placeholderText', 'inputSurface', 'borderHover', 'borderCritical'],
  "InputGroup": ['brandText', 'neutralFill', 'neutralText', 'border', 'fgMuted', 'inputSurface'],
  "InputOTP": ['brandSolid', 'neutralText', 'border', 'inputSurface', 'borderCritical'],
  "InputStepper": ['neutralText', 'border', 'fgMuted', 'inputSurface'],
  "InputTag": ['brandSolid', 'brandText', 'neutralText', 'border', 'placeholderText', 'inputSurface'],
  "Label": ['neutralText', 'errorColor'],
  "Modal": ['onBrand', 'neutralText', 'errorColor', 'border', 'borderDefault', 'fgMuted'],
  "Navbar": ['surface', 'brandSolid', 'brandText', 'neutralFill', 'neutralText', 'borderDefault', 'fgMuted'],
  "Pagination": ['surface', 'brandSolid', 'onBrand', 'neutralFill', 'neutralText', 'borderDefault', 'placeholderText'],
  "PasswordStrength": ['neutralFill', 'neutralText', 'errorColor', 'border', 'fgMuted', 'successColor', 'warningColor', 'inputSurface'],
  "Popover": ['surface', 'brandSolid', 'onBrand', 'neutralFill', 'neutralText', 'border', 'borderDefault', 'fgMuted'],
  "Progress": ['brandSolid', 'neutralFill', 'neutralText', 'fgMuted'],
  "Radio": ['brandSolid', 'neutralText', 'disabledBg', 'disabledText', 'border', 'inputSurface'],
  "RadioGroup": ['brandSolid', 'neutralText', 'disabledBg', 'disabledText', 'border', 'fgMuted', 'inputSurface'],
  "Rating": ['neutralFill', 'neutralText', 'fgMuted', 'warningColor'],
  "ScrollArea": ['surface', 'neutralFill', 'neutralText', 'borderDefault'],
  "SegmentedControl": ['neutralText', 'fgMuted', 'inputSurface'],
  "Select": ['neutralText', 'disabledBg', 'disabledText', 'border', 'fgMuted', 'placeholderText', 'inputSurface', 'borderHover', 'borderCritical'],
  "Sidebar": ['surface', 'brandSolid', 'brandText', 'neutralFill', 'neutralText', 'borderDefault'],
  "Slider": ['brandSolid', 'neutralFill', 'neutralText', 'fgMuted'],
  "SocialLoginButton": ['surface', 'neutralFill', 'neutralText', 'border'],
  "Spinner": ['brandSolid', 'neutralFill'],
  "StatusBadge": ['surface', 'neutralFill', 'neutralText', 'borderDefault'],
  "Stepper": ['brandSolid', 'onBrand', 'neutralFill', 'neutralText', 'fgMuted'],
  "SwitchGroup": ['brandSolid', 'onBrand', 'neutralFill', 'neutralText', 'fgMuted', 'inputSurface'],
  "TabMenu": ['brandText', 'neutralText', 'fgMuted', 'selectedSurface'],
  "Tabs": ['brandSolid', 'brandText', 'neutralText', 'borderDefault', 'fgMuted'],
  "Textarea": ['neutralText', 'errorColor', 'disabledBg', 'disabledText', 'border', 'fgMuted', 'placeholderText', 'inputSurface', 'borderHover', 'borderCritical'],
  "TextLink": ['disabledText', 'linkText', 'linkHover'],
  "Toast": ['surface', 'brandSolid', 'neutralText', 'errorColor', 'successColor', 'warningColor', 'infoColor'],
  "Toggle": ['brandSolid', 'onBrand', 'neutralFill', 'neutralText', 'disabledBg', 'disabledText', 'inputSurface'],
  "Tooltip": ['surface', 'neutralText'],
}

/** Component catalogue key → Categorical role ids its specimen resolves BY
 *  NAME rather than through a `PreviewTokens` field — `archTokenOf(t,
 *  'surface.inverse')` and the `previewTokens` helpers (`overlaySurfaceOf`,
 *  `focusBorderOf`, `statusSoftFillOf`…).
 *
 *  `COMPONENT_COLOR_FIELDS` alone can't express these: it is a list of
 *  FIELDS, and a role reached by id never touches one. Inspect tokens
 *  filters measured colours against the roles a component is allowed to
 *  own, so a role missing from both maps is silently dropped from the
 *  badge even though the component visibly paints it. */
export const COMPONENT_ARCH_ROLES: Record<string, string[]> = {
  "Badge": ['status.critical.surface', 'status.info.surface', 'status.success.surface', 'status.warning.surface'],
  "Button": ['action.ghost.brand.hover', 'action.ghost.brand.pressed'],
  "Card": ['surface.layer-1'],
  "Checkbox": ['surface.input'],
  "CheckboxGroup": ['surface.input'],
  "Chip": ['surface.selected'],
  "CloseButton": ['action.ghost.neutral.hover', 'action.ghost.neutral.pressed'],
  "Combobox": ['surface.input', 'surface.layer-1', 'surface.layer-2'],
  "Command": ['surface.layer-1', 'surface.layer-2'],
  "ContextMenu": ['action.ghost.neutral.hover', 'status.critical.content', 'surface.layer-1', 'surface.layer-2'],
  "DropdownMenu": ['action.ghost.neutral.hover', 'status.critical.content', 'surface.layer-1', 'surface.layer-2'],
  "Dropzone": ['status.critical.content'],
  "Field": ['status.critical.content', 'surface.input'],
  "Input": ['border.control-hover', 'border.focus', 'status.critical.border-strong', 'status.critical.content', 'surface.input'],
  "InputGroup": ['surface.input'],
  "InputOTP": ['status.critical.border-strong', 'surface.input'],
  "InputStepper": ['surface.input'],
  "InputTag": ['surface.input'],
  "Label": ['status.critical.content'],
  "Modal": ['surface.layer-1', 'surface.layer-2'],
  "PasswordStrength": ['status.critical.content', 'status.success.content', 'status.warning.content', 'surface.input'],
  "Popover": ['surface.layer-1', 'surface.layer-2'],
  "Radio": ['surface.input'],
  "RadioGroup": ['surface.input'],
  "SegmentedControl": ['surface.input', 'surface.layer-1', 'surface.layer-2'],
  "Select": ['border.control-hover', 'border.focus', 'status.critical.border-strong', 'surface.input'],
  "SwitchGroup": ['surface.input'],
  "TabMenu": ['surface.selected'],
  "Textarea": ['border.control-hover', 'border.focus', 'status.critical.border-strong', 'status.critical.content', 'surface.input'],
  "TextLink": ['content.link.default', 'content.link.hover'],
  "Toast": ['content.inverse', 'surface.inverse'],
  "Toggle": ['action.primary.hover', 'surface.input'],
}
