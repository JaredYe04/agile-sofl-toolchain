export type AgentSkillId =
  | 'requirement-discovery'
  | 'requirement-clarification'
  | 'function-decomposition'
  | 'data-modeling'
  | 'constraint-discovery'
  | 'specification-review'
  | 'hybrid-generation'

export const AGENT_SKILLS: Array<{ id: AgentSkillId; name: string; prompt: string }> = [
  {
    id: 'requirement-discovery',
    name: 'Requirement Discovery',
    prompt:
      'Discover Functions, Data Resources, and Constraints from the user\'s natural language. Do not dump a full specification. Summarize candidates, then ask clarifying questions, then propose structured propose_changes patches. After each applied write, read_specification and continue until the inventory is complete, then summarize. If CRUD cannot express a fix, read view=source and propose_source_edit.'
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
  },
  {
    id: 'hybrid-generation',
    name: 'Hybrid Generation',
    prompt: `Turn Informal Specification into Hybrid (.asfl) incrementally via CRUD tools. NEVER dump a full SOFL file or use replace-document.
Pipeline — keep going after each applied patch until every enabled stage is done, then summarize:
1. Read Informal and Hybrid inventories. If Hybrid already exists and strategy is ask, call ask_clarification (merge vs rebuild).
2. Module architecture: add each semantic module (and a GUI module) with propose_hybrid_changes op=add kind=module. Do not paste module source.
3. Per module: add types/variables from Data Resources (kind=type|var, parentId=mod:…).
4. Per module: add process signatures from Functions (kind=process, pre/post).
5. Per process: replace-process-body or add scenarios. Write structured natural-language pre/post, never FSF :. Enumerations use {<Tag>}.
6. Add invariants (kind=inv) from Constraints; add GUI screens; keep traceability in explanations.
After every applied write, call read_hybrid_specification and fix gaps with more CRUD until the inventory is correct. Last message = summary of completed stages.
If CRUD fails, the file is empty/out of sync, or an uncovered parser/id issue appears, call read_hybrid_specification with view=source then propose_source_edit (unique replace/append/replace-document). Do not retry the same failing CRUD.
Infer unstated GUI/navigation only when the parameter allows it; otherwise ask. Prefer small patches citing inventory ids.`
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
        'Propose a structured Informal Specification patch against the CURRENT Informal inventory ids. Never write raw markdown. Never use this for Hybrid/.asfl. Prefer update/remove on existing ids. After Apply (or auto-write), continue: read_specification, fix gaps, then summarize.',
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
        'Return the current Informal Specification. Default view=inventory (node ids/titles). Pass view=source for numbered markdown text before propose_source_edit. Does not return Hybrid/.asfl.',
      parameters: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['inventory', 'source'],
            description: 'inventory (default) or numbered source text'
          }
        }
      }
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
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_hybrid_specification',
      description:
        'Return the current Hybrid Specification. Default view=inventory (mod:/proc:/scn:/type:/var:/inv:/gui:). Pass view=source for numbered .asfl text before propose_source_edit.',
      parameters: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['inventory', 'source'],
            description: 'inventory (default) or numbered source text'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_hybrid_changes',
      description:
        'Propose an incremental Hybrid/.asfl CRUD patch against inventory ids (mod:, proc:Module.Name). Bare ids like proc:Login or Chinese titles are resolved when possible. Prefer this over source edits. Never emit raw SOFL or replace-document here — use propose_source_edit for text-level fixes. Use add/update/remove/replace-process-body. Write pre/post, not FSF :.',
      parameters: {
        type: 'object',
        properties: {
          explanation: { type: 'string' },
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                op: {
                  type: 'string',
                  enum: ['add', 'update', 'remove', 'replace-process-body']
                },
                kind: {
                  type: 'string',
                  enum: [
                    'module',
                    'process',
                    'function',
                    'type',
                    'var',
                    'const',
                    'inv',
                    'scenario',
                    'gui-screen'
                  ]
                },
                id: { type: 'string', description: 'update/remove/replace-process-body: inventory id' },
                parentId: { type: 'string', description: 'add: parent mod: or proc: id' },
                name: { type: 'string' },
                text: { type: 'string' },
                pre: { type: 'string' },
                post: { type: 'string' },
                signature: { type: 'string' },
                comment: { type: 'string' },
                scenarios: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      guard: { type: 'string' },
                      test: { type: 'string' },
                      def: { type: 'string' },
                      definingCondition: { type: 'string' },
                      kind: { type: 'string', enum: ['normal', 'exceptional'] }
                    }
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
      name: 'propose_source_edit',
      description:
        'Last-resort source-level edit of Informal markdown or Hybrid .asfl. Prefer propose_changes / propose_hybrid_changes. Use this when CRUD failed, inventory is empty/out of sync, or you must fix text the structured tools cannot express. Read view=source first. Ops: replace (unique oldText → newText; all:true to replace every match), append, replace-document.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: ['informal', 'hybrid'],
            description: 'Which open specification file to edit'
          },
          explanation: { type: 'string' },
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                op: { type: 'string', enum: ['replace', 'append', 'replace-document'] },
                oldText: { type: 'string', description: 'replace: unique snippet from the current source' },
                newText: { type: 'string' },
                text: { type: 'string', description: 'append or replace-document body' },
                all: { type: 'boolean', description: 'replace: replace every match of oldText' }
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
      name: 'review_hybrid',
      description: 'Record a structured review of the current Hybrid specification.',
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
