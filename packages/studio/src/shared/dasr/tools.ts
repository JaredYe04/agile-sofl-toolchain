export const DASR_PROMPT_APPENDIX = `Decision-aware refinement is on (condition C2).
Tracked requirement decisions are separate from the refinement digest. The digest counts open refinement obligations. It does not record requirement decisions, and a finished digest is not stakeholder confirmation.
Do not claim every underspecified requirement has been found.
On every propose_* call, name impactElementIds for the inventory ids you will change. If you cannot name them, omit the field. An omitted or empty list is not "no impact": the gate refuses the write.
propose_source_edit, propose_gui_changes, propose_refinement_step, and auto-write use the same gate. Auto-write only skips the human Apply click.
If a write depends on an unresolved decision, ask the user to confirm it or set commitment to "provisional". Provisional text is not a confirmed specification.
You cannot confirm, reject, or supersede a decision yourself.`

const IMPACT_PROPERTIES = {
  impactElementIds: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Inventory ids this write commits. Omit the field when you cannot tell. An empty array is not treated as no impact.'
  },
  commitment: {
    type: 'string',
    enum: ['confirmed', 'provisional'],
    description:
      'confirmed is refused when a target is linked to an unresolved decision. provisional is stored as provisional and is not a confirmed specification.'
  }
}

export const DASR_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_decisions',
      description:
        'List tracked requirement decisions, their statuses, and impact links. An empty ledger means no decisions are registered. This is not the refinement-obligation digest and not a claim that every underspecified requirement was found.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'register_decision',
      description:
        'Register an unresolved requirement decision and optional impact links. Links are proposed until a human accepts them. This tool cannot confirm or reject a decision.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          sourceRequirementIds: { type: 'array', items: { type: 'string' } },
          affectedElementIds: { type: 'array', items: { type: 'string' } },
          alternatives: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, label: { type: 'string' } },
              required: ['id', 'label']
            }
          }
        },
        required: ['question']
      }
    }
  }
]

interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: { type?: string; properties?: Record<string, unknown>; required?: string[] }
  }
}

export function applyDasrToolSurface<T extends ToolDef>(tools: T[], enabled: boolean): T[] {
  if (!enabled) return tools
  const withImpact = tools.map((tool) => {
    if (!tool.function.name.startsWith('propose_')) return tool
    const params = tool.function.parameters
    return {
      ...tool,
      function: {
        ...tool.function,
        parameters: {
          ...params,
          properties: { ...(params.properties ?? {}), ...IMPACT_PROPERTIES }
        }
      }
    }
  })
  return [...withImpact, ...(DASR_TOOLS as unknown as T[])]
}
