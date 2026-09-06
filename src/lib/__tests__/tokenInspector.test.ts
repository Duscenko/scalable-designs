import { describe, expect, it } from 'vitest'
import { inspectPage, normalizeColor, pairButtonScopes, pairSolidRoles, pairTabMenuScopes, resolveVariantRoles, rolesForPaints } from '../tokenInspector'
import { parseRef, pickRampCell } from '../../components/configurator/Step3_SemanticTokens'

describe('resolveVariantRoles', () => {
  const arch = {
    'action.primary.default': '#22c55e',
    'content.on-action': '#e1e7dc',
    'action.secondary.default': '#1a1a1f',
    'action.secondary.accent': '#14532d',
    'content.primary': '#f5f5f5',
    'content.inverse': '#e1e7dc',
    'content.accent': '#86efac',
    'status.critical.surface-solid': '#b94136',
    'status.critical.on-solid': '#fafafa',
    'status.success.surface-solid': '#1f8340',
    'status.success.on-solid': '#fafafa',
    'status.critical.surface': '#b941361a',
    'status.critical.content': '#9f2b20',
    'status.success.surface': '#1f83401a',
  }
  const t = { archTokens: arch } as never

  it('a Solid Danger button names the status solid pair', () => {
    const paints = [
      { css: '#c0392b', where: 'fill' as const },
      { css: '#ffffff', where: 'ink' as const },
    ]
    expect(resolveVariantRoles(t, 'Button', { Style: 'Solid', Color: 'Danger' }, paints)?.map((r) => r.id)).toEqual([
      'status.critical.surface-solid',
      'status.critical.on-solid',
    ])
    expect(resolveVariantRoles(t, 'Button', { Style: 'Solid', Color: 'Danger' }, paints)?.[0]?.css).toBe('#c0392b')
  })

  it('a Solid Success button names the status solid pair', () => {
    const paints = [
      { css: '#15803d', where: 'fill' as const },
      { css: '#ffffff', where: 'ink' as const },
    ]
    expect(resolveVariantRoles(t, 'Button', { Style: 'Solid', Color: 'Success' }, paints)?.map((r) => r.id)).toEqual([
      'status.success.surface-solid',
      'status.success.on-solid',
    ])
  })

  it('a Solid Brand button names the primary pair', () => {
    const paints = [
      { css: '#22c55e', where: 'fill' as const },
      { css: '#e1e7dc', where: 'ink' as const },
    ]
    expect(resolveVariantRoles(t, 'Button', { Style: 'Solid' }, paints)?.map((r) => r.id)).toEqual([
      'action.primary.default',
      'content.on-action',
    ])
  })

  it('a Solid Error badge names the critical solid pair', () => {
    const paints = [
      { css: '#b94136', where: 'fill' as const },
      { css: '#fafafa', where: 'ink' as const },
    ]
    expect(resolveVariantRoles(t, 'Badge', { Style: 'Solid', Color: 'Error' }, paints)?.map((r) => r.id)).toEqual([
      'status.critical.surface-solid',
      'status.critical.on-solid',
    ])
  })

  it('a Soft Error badge names the critical tint, content ink, and solid dot', () => {
    const paints = [
      { css: 'rgba(185, 65, 54, 0.11)', where: 'fill' as const },
      { css: '#9f2b20', where: 'ink' as const },
      { css: '#b94136', where: 'fill' as const },
    ]
    const roles = resolveVariantRoles(t, 'Badge', { Style: 'Soft', Color: 'Error' }, paints)
    expect(roles?.map((r) => r.id)).toEqual([
      'status.critical.surface',
      'status.critical.content',
      'status.critical.surface-solid',
    ])
    expect(roles?.find((r) => r.id === 'status.critical.surface-solid')?.css).toBe('#b94136')
  })

  it('a Success toast names the inverse chip and status solid dot', () => {
    const archWithInverse = {
      ...arch,
      'surface.inverse': '#171717',
      'status.success.surface-solid': '#1f8340',
    }
    const toastT = { archTokens: archWithInverse } as never
    const paints = [
      { css: '#171717', where: 'fill' as const },
      { css: '#e1e7dc', where: 'ink' as const },
      { css: '#15803d', where: 'fill' as const },
    ]
    expect(resolveVariantRoles(toastT, 'Toast', { Status: 'Success' }, paints)?.map((r) => r.id)).toEqual([
      'surface.inverse',
      'content.inverse',
      'status.success.surface-solid',
    ])
  })
})

describe('rolesForPaints field index', () => {
  it('maps a primitive fill to its categorical role when arch hex differs', () => {
    const arch = {
      'status.critical.surface-solid': '#c73a2f',
      'status.critical.on-solid': '#fafafa',
    }
    const fieldIndex = new Map([['201,57,43,1.00', ['status.critical.surface-solid']]])
    const roles = rolesForPaints(
      arch,
      ['status.critical.surface-solid', 'status.critical.on-solid'],
      [{ css: 'rgb(201, 57, 43)', where: 'fill' }],
      fieldIndex,
    )
    expect(roles.map((r) => r.id)).toEqual(['status.critical.surface-solid'])
  })
})

describe('normalizeColor', () => {
  it('equates hex and rgb of the same pixel', () => {
    expect(normalizeColor('#1a1a1f')).toBe(normalizeColor('rgb(26, 26, 31)'))
  })
})

describe('rolesForPaints', () => {
  const arch = {
    'surface.layer-1': '#1a1a1f',
    'content.primary': '#f5f5f5',
    'action.primary.default': '#22c55e',
    'content.accent': '#22c55e',
  }

  it('does not attribute undeclared roles that share a hex', () => {
    const roles = rolesForPaints(
      arch,
      ['action.primary.default', 'content.on-action'],
      [{ css: '#22c55e', where: 'fill' }],
    )
    expect(roles.map((r) => r.id)).toEqual(['action.primary.default'])
  })

  it('names surface.input when that fill is in the declared union', () => {
    const roles = rolesForPaints(
      {
        'surface.input': '#1a1a1f',
        'surface.page': '#0c0e12',
        'content.primary': '#f5f5f5',
        'border.control': '#3a3a3f',
      },
      ['surface.input', 'content.primary', 'border.control'],
      [{ css: '#1a1a1f', where: 'fill' }],
    )
    expect(roles.map((r) => r.id)).toEqual(['surface.input'])
  })

  it('keeps the measured css on the swatch, not arch[id]', () => {
    const roles = rolesForPaints(
      arch,
      ['surface.layer-1'],
      [{ css: 'rgb(26, 26, 31)', where: 'fill' }],
    )
    expect(roles[0]?.css).toBe('rgb(26, 26, 31)')
    expect(roles[0]?.id).toBe('surface.layer-1')
  })
})

describe('pairSolidRoles', () => {
  const arch = {
    'status.critical.surface-solid': '#b94136',
    'status.critical.on-solid': '#e1e7dc',
    'action.primary.default': '#22c55e',
    'content.on-action': '#e1e7dc',
    'content.primary': '#e1e7dc',
  }
  const declared = [
    'action.primary.default',
    'content.on-action',
    'status.critical.surface-solid',
  ]

  it('a Danger solid lists only the status pair', () => {
    const paints = [
      { css: '#b94136', where: 'fill' as const },
      { css: '#e1e7dc', where: 'ink' as const },
    ]
    const matched = rolesForPaints(arch, declared, paints)
    expect(matched.map((r) => r.id)).toEqual([
      'status.critical.surface-solid',
      'content.on-action',
    ])
    expect(pairSolidRoles(arch, matched, paints).map((r) => r.id)).toEqual([
      'status.critical.surface-solid',
      'status.critical.on-solid',
    ])
  })

  it('a Brand solid lists the action pair', () => {
    const paints = [
      { css: '#22c55e', where: 'fill' as const },
      { css: '#e1e7dc', where: 'ink' as const },
    ]
    const matched = rolesForPaints(arch, declared, paints)
    expect(pairSolidRoles(arch, matched, paints).map((r) => r.id)).toEqual([
      'action.primary.default',
      'content.on-action',
    ])
  })
})

describe('pairButtonScopes', () => {
  const arch = {
    'action.primary.default': '#22c55e',
    'action.primary.hover': '#16a34a',
    'action.primary.pressed': '#15803d',
    'action.secondary.accent': '#14532d',
    'action.ghost.brand.hover': '#22c55e1a',
    'action.ghost.brand.pressed': '#22c55e33',
    'content.on-action': '#e1e7dc',
    'content.accent': '#86efac',
    'content.primary': '#f5f5f5',
    'border.control': '#3a3a3f',
    'status.critical.surface-solid': '#b94136',
    'status.critical.on-solid': '#e1e7dc',
  }

  it('keeps only the solid surface and its label — drops a stroke', () => {
    const paints = [
      { css: '#22c55e', where: 'fill' as const },
      { css: '#e1e7dc', where: 'ink' as const },
      { css: '#3a3a3f', where: 'stroke' as const },
    ]
    const matched = pairSolidRoles(
      arch,
      rolesForPaints(arch, ['action.primary.default', 'content.on-action', 'border.control'], paints),
      paints,
    )
    expect(pairButtonScopes(arch, matched, paints).map((r) => `${r.id}:${r.where}`)).toEqual([
      'action.primary.default:fill',
      'content.on-action:ink',
    ])
  })

  it('names a soft wash as the ghost hover surface, not the whole union', () => {
    const paints = [
      { css: 'rgba(34, 197, 94, 0.10)', where: 'fill' as const },
      { css: '#86efac', where: 'ink' as const },
    ]
    const matched = rolesForPaints(arch, ['content.accent', 'content.primary', 'action.primary.default'], paints)
    expect(pairButtonScopes(arch, matched, paints).map((r) => r.id)).toEqual([
      'action.ghost.brand.hover',
      'content.accent',
    ])
  })

  it('a pressed wash deeper than 15% is the ghost pressed surface', () => {
    const paints = [
      { css: 'rgba(34, 197, 94, 0.20)', where: 'fill' as const },
      { css: '#86efac', where: 'ink' as const },
    ]
    expect(pairButtonScopes(arch, rolesForPaints(arch, ['content.accent'], paints), paints).map((r) => r.id)).toEqual([
      'action.ghost.brand.pressed',
      'content.accent',
    ])
  })

  it('a darkened solid still reports the primary pair, not every severity', () => {
    const paints = [
      { css: '#0f3d24', where: 'fill' as const },
      { css: '#e1e7dc', where: 'ink' as const },
    ]
    const matched = rolesForPaints(arch, ['action.primary.default', 'content.on-action', 'status.critical.surface-solid'], paints)
    expect(pairButtonScopes(arch, matched, paints).map((r) => r.id)).toEqual([
      'action.primary.default',
      'content.on-action',
    ])
  })
})

describe('pairTabMenuScopes', () => {
  const arch = {
    'surface.selected': '#22c55e1f',
    'content.accent': '#86efac',
    'content.secondary': '#717680',
    'action.primary.default': '#22c55e',
  }

  it('names the selected pill as surface.selected, not the brand solid', () => {
    const paints = [
      { css: '#22c55e1f', where: 'fill' as const },
      { css: '#86efac', where: 'ink' as const },
      { css: '#717680', where: 'ink' as const },
    ]
    const matched = rolesForPaints(
      arch,
      ['action.primary.default', 'content.accent', 'content.secondary'],
      paints,
    )
    expect(pairTabMenuScopes(arch, matched, paints).map((r) => `${r.id}:${r.where}`)).toEqual([
      'surface.selected:fill',
      'content.accent:ink',
      'content.secondary:ink',
    ])
  })

  it('infers surface.selected when the pill wash matches no declared role', () => {
    const paints = [
      { css: 'rgba(34, 197, 94, 0.12)', where: 'fill' as const },
      { css: '#717680', where: 'ink' as const },
    ]
    expect(pairTabMenuScopes(arch, rolesForPaints(arch, ['content.secondary'], paints), paints).map((r) => r.id)).toEqual([
      'surface.selected',
      'content.secondary',
    ])
  })
})

describe('inspectPage', () => {
  it('names surface.page as the canvas fill', () => {
    const { roles, measured } = inspectPage({
      archTokens: { 'surface.page': '#0c0e12', 'surface.layer-1': '#1a1a1f' },
      pageBackground: '#0c0e12',
      surface: '#0c0e12',
    } as never)
    expect(measured).toBe(true)
    expect(roles).toEqual([{ id: 'surface.page', css: '#0c0e12', where: 'fill' }])
  })

  it('falls back to the previewed page when the projection is absent', () => {
    const { roles, measured } = inspectPage({
      pageBackground: '#fafafa',
      surface: '#ffffff',
    } as never)
    expect(measured).toBe(true)
    expect(roles).toEqual([{ id: 'surface.page', css: '#fafafa', where: 'fill' }])
  })
})

describe('parseRef', () => {
  it('accepts braces and bare labels', () => {
    expect(parseRef('{neutral-dark.2}')).toEqual(['neutral-dark', 2])
    expect(parseRef('neutral-dark.2')).toEqual(['neutral-dark', 2])
  })

  it('does not parse a token id as a primitive', () => {
    expect(parseRef('surface.layer-1')).toBeNull()
  })
})

describe('pickRampCell', () => {
  const ramps = {
    accent: { 7: '#48ffe0', 9: '#00c8d0' },
    'neutral-dark': { 1: '#0c0e12', 2: '#1a1a1f', 12: '#f5f5f5' },
  }

  it('rings the stored ref even when a collided inspect hex points at accent', () => {
    const cell = pickRampCell(
      { css: '#1a1a1f', label: '{neutral-dark.2}' },
      ramps,
      '#48ffe0',
    )
    expect(cell).toEqual({ family: 'neutral-dark', tone: 2 })
  })

  it('rings the parsed ref when it still matches the value', () => {
    const cell = pickRampCell(
      { css: '#1a1a1f', label: 'neutral-dark.2' },
      ramps,
    )
    expect(cell).toEqual({ family: 'neutral-dark', tone: 2 })
  })

  it('does not default to accent when the label is unparseable', () => {
    expect(pickRampCell({ css: 'transparent', label: '{accent.solid}' }, ramps)).toBeNull()
  })
})
