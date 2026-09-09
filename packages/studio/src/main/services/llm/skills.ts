export type AgentSkillId =
  | 'requirement-discovery'
  | 'requirement-clarification'
  | 'function-decomposition'
  | 'data-modeling'
  | 'constraint-discovery'
  | 'specification-review'

export const AGENT_SKILLS: Array<{ id: AgentSkillId; name: string; prompt: string }> = [
  {
    id: 'requirement-discovery',
    name: 'Requirement Discovery',
    prompt:
      'Discover Functions, Data Resources, and Constraints from the user\'s natural language. Do not dump a full specification. Summarize candidates, then ask clarifying questions, then propose a structured patch.'
  },
  {
    id: 'requirement-clarification',
    name: 'Requirement Clarification',
    prompt:
      'Find vague, missing, or ambiguous information. Ask focused questions (options + optional custom input). Do not invent details the user did not confirm.'
  },
  {
    id: 'function-decomposition',
    name: 'Function Decomposition',
    prompt:
      'Decompose a selected function into sub-steps. Propose child function nodes, not free-form markdown.'
  },
  {
    id: 'data-modeling',
    name: 'Data Modeling',
    prompt:
      'Identify data resources and fields. Propose data-resource / data-field nodes with clear titles and short descriptions.'
  },
  {
    id: 'constraint-discovery',
    name: 'Constraint Discovery',
    prompt:
      'Turn business rules into Constraint nodes with precise natural-language statements (limits, locking, non-negativity, uniqueness).'
  },
  {
    id: 'specification-review',
    name: 'Specification Review',
    prompt:
      'Review Completeness, Precision, Consistency, and Traceability. Call review_specification and list concrete issues tied to node ids when possible.'
  }
]

export function skillById(id?: string) {
  return AGENT_SKILLS.find((s) => s.id === id) ?? AGENT_SKILLS[0]!
}

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'ask_clarification',
      description:
        'Ask the user a structured clarification question. The UI will render options the user can click, plus optional custom input. Use this instead of listing questions only in prose when a decision is needed.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, label: { type: 'string' } },
              required: ['id', 'label']
            }
          },
          allowCustom: { type: 'boolean' },
          multiSelect: { type: 'boolean' }
        },
        required: ['question']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_changes',
      description:
        'Propose a structured Informal Specification patch against the CURRENT spec (see inventory ids). Never write raw markdown. The editor shows a preview for Apply / Reject. You MAY add new nodes, AND update or remove existing ones. Prefer update/remove on existing ids over adding duplicates.',
      parameters: {
        type: 'object',
        properties: {
          explanation: { type: 'string' },
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                op: { type: 'string', enum: ['add', 'update', 'remove', 'move'] },
                target: {
                  type: 'string',
                  description:
                    'add only: functions | data-resources | constraints, or a parent node id (for nested fields).'
                },
                id: {
                  type: 'string',
                  description: 'update / remove / move: existing node id from the inventory (or unique title).'
                },
                parentId: { type: 'string' },
                afterId: { type: 'string' },
                title: { type: 'string', description: 'update: new title' },
                description: { type: 'string', description: 'update: new body text' },
                node: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['function', 'data-resource', 'data-field', 'constraint', 'text']
                    },
                    title: { type: 'string' },
                    description: { type: 'string' }
                  }
                }
              },
              required: ['op']
            }
          }
        },
        required: ['operations']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_specification',
      description:
        'Return the current Informal Specification inventory: every node id, type, title, and description. Call this before propose_changes when you need to edit or delete existing items.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'review_specification',
      description: 'Record a structured review of the current informal specification.',
      parameters: {
        type: 'object',
        properties: {
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dimension: {
                  type: 'string',
                  enum: ['completeness', 'precision', 'consistency', 'traceability']
                },
                message: { type: 'string' },
                nodeId: { type: 'string' }
              },
              required: ['dimension', 'message']
            }
          }
        },
        required: ['issues']
      }
    }
  }
]
