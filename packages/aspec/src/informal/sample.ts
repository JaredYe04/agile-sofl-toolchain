import { serializeInformalSpec } from './serializer.js'
import { treeToSpec, type InformalTreeSpec } from './model.js'

export const SAMPLE_INFORMAL_TREE: InformalTreeSpec = {
  id: 'spec-atm-sample',
  moduleId: 'ATM',
  version: 1,
  metadata: {
    title: 'ATM Informal Specification',
    hybridTarget: './hybrid.asfl',
    sourceFormat: 'markdown'
  },
  sections: [
    {
      id: 'sec-fn',
      type: 'functions',
      title: 'Functions',
      children: [
        {
          id: 'fn-register-a-customer',
          type: 'function',
          title: 'Register a customer',
          description: 'The system shall allow a customer to register a bank account.',
          children: [
            {
              id: 'fn-register-input',
              type: 'function',
              title: 'Input',
              description: '- Customer name\n- Account number\n- Password',
              children: []
            },
            {
              id: 'fn-register-result',
              type: 'function',
              title: 'Result',
              description: 'A new bank account is created.',
              children: []
            }
          ]
        },
        {
          id: 'fn-withdraw-from-the-bank-account',
          type: 'function',
          title: 'Withdraw from the bank account',
          description: 'The system shall allow a customer to withdraw money.',
          children: [
            {
              id: 'fn-check-the-card-id-and-password',
              type: 'function',
              title: 'Check the card ID and password',
              description: 'The system shall verify the card ID and password.',
              children: []
            },
            {
              id: 'fn-check-the-amount-for-withdrawal',
              type: 'function',
              title: 'Check the amount for withdrawal',
              description: 'The system shall verify that the withdrawal amount is valid.',
              children: []
            },
            {
              id: 'fn-update-the-account-balance',
              type: 'function',
              title: 'Update the account balance',
              description:
                'The system shall subtract the withdrawal amount\nfrom the account balance.',
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 'sec-dr',
      type: 'data-resources',
      title: 'Data Resources',
      children: [
        {
          id: 'dr-bank-account',
          type: 'data-resource',
          title: 'Bank Account',
          children: [
            {
              id: 'df-account-name',
              type: 'data-field',
              title: 'Account Name',
              description: 'The name of the account owner.',
              children: []
            },
            {
              id: 'df-account-number',
              type: 'data-field',
              title: 'Account Number',
              description: 'The unique number of the bank account.',
              children: []
            },
            {
              id: 'df-account-password',
              type: 'data-field',
              title: 'Account Password',
              description: 'The password associated with the account.',
              children: []
            },
            {
              id: 'df-account-balance',
              type: 'data-field',
              title: 'Account Balance',
              description: 'The current balance of the account.',
              children: []
            }
          ]
        },
        {
          id: 'dr-accounts-file',
          type: 'data-resource',
          title: 'Accounts File',
          description: 'A persistent collection of bank accounts.',
          children: []
        }
      ]
    },
    {
      id: 'sec-c',
      type: 'constraints',
      title: 'Constraints',
      children: [
        {
          id: 'c-withdrawal-limit',
          type: 'constraint',
          title: 'Withdrawal Limit',
          description: 'Each withdrawal must not exceed 200,000 JPY.',
          children: []
        },
        {
          id: 'c-non-negative-balance',
          type: 'constraint',
          title: 'Non-negative Balance',
          description: 'The account balance cannot be less than 0.',
          children: []
        }
      ]
    }
  ]
}

export function sampleInformalSpecification() {
  return treeToSpec(SAMPLE_INFORMAL_TREE)
}

export function blankInformalMarkdown(title = 'Informal Specification', hybridTarget = './hybrid.asfl'): string {
  return serializeInformalSpec(
    treeToSpec({
      id: `spec-${Date.now().toString(36)}`,
      moduleId: 'project',
      version: 1,
      metadata: { title, hybridTarget, sourceFormat: 'markdown' },
      sections: [
        { id: 'sec-fn', type: 'functions', title: 'Functions', children: [] },
        { id: 'sec-dr', type: 'data-resources', title: 'Data Resources', children: [] },
        { id: 'sec-c', type: 'constraints', title: 'Constraints', children: [] }
      ]
    })
  )
}

export function sampleInformalMarkdown(): string {
  return serializeInformalSpec(sampleInformalSpecification())
}
