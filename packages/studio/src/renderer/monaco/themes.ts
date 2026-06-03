import type { editor } from 'monaco-editor'

export const agileSoflLightTheme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword.control.asfl', foreground: 'C586C0' },
    { token: 'keyword.control.system-prefix.asfl', foreground: 'D7BA7D', fontStyle: 'bold' },
    { token: 'keyword.control.fsf.asfl', foreground: 'DCDCAA', fontStyle: 'bold' },
    { token: 'keyword.declaration.asfl', foreground: '569CD6' },
    { token: 'keyword.modifier.rdwr.asfl', foreground: '4EC9B0' },
    { token: 'keyword.other.informal-marker.asfl', foreground: 'CE9178', fontStyle: 'italic' },
    { token: 'keyword.other.fsf.asfl', foreground: 'B5CEA8' },
    { token: 'keyword.other.fsf-branch.asfl', foreground: 'D7BA7D' },
    { token: 'keyword.operator.logical.asfl', foreground: 'D4D4D4' },
    { token: 'keyword.operator.comparison.asfl', foreground: 'D4D4D4' },
    { token: 'keyword.operator.word.asfl', foreground: 'D4D4D4' },
    { token: 'storage.type.asfl', foreground: '4EC9B0' },
    { token: 'entity.name.namespace.asfl', foreground: '4FC1FF' },
    { token: 'entity.name.function.asfl', foreground: 'DCDCAA' },
    { token: 'entity.name.type.asfl', foreground: '4EC9B0' },
    { token: 'entity.name.tag.asfl', foreground: '9CDCFE' },
    { token: 'variable.parameter.asfl', foreground: '9CDCFE' },
    { token: 'variable.other.asfl', foreground: '9CDCFE' },
    { token: 'string.unquoted.informal.asfl', foreground: 'CE9178' },
    { token: 'string.quoted.double.asfl', foreground: 'CE9178' },
    { token: 'constant.other.enum.asfl', foreground: 'D7BA7D' },
    { token: 'constant.numeric', foreground: 'B5CEA8' },
    { token: 'constant.language', foreground: '4EC9B0' },
    { token: 'comment.block.asfl', foreground: '6A9955' },
    { token: 'meta.fsf.asfl', foreground: 'D4D4D4' },
    { token: 'meta.comment.informal.asfl', foreground: 'CE9178' }
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1e1e1e'
  }
}

export const agileSoflDarkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword.control.asfl', foreground: 'C586C0' },
    { token: 'keyword.control.system-prefix.asfl', foreground: 'D7BA7D', fontStyle: 'bold' },
    { token: 'keyword.control.fsf.asfl', foreground: 'DCDCAA', fontStyle: 'bold' },
    { token: 'keyword.declaration.asfl', foreground: '569CD6' },
    { token: 'keyword.modifier.rdwr.asfl', foreground: '4EC9B0' },
    { token: 'keyword.other.informal-marker.asfl', foreground: 'CE9178', fontStyle: 'italic' },
    { token: 'keyword.other.fsf.asfl', foreground: 'B5CEA8' },
    { token: 'keyword.other.fsf-branch.asfl', foreground: 'D7BA7D' },
    { token: 'keyword.operator.logical.asfl', foreground: 'D4D4D4' },
    { token: 'keyword.operator.comparison.asfl', foreground: 'D4D4D4' },
    { token: 'keyword.operator.word.asfl', foreground: 'D4D4D4' },
    { token: 'storage.type.asfl', foreground: '4EC9B0' },
    { token: 'entity.name.namespace.asfl', foreground: '4FC1FF' },
    { token: 'entity.name.function.asfl', foreground: 'DCDCAA' },
    { token: 'entity.name.type.asfl', foreground: '4EC9B0' },
    { token: 'entity.name.tag.asfl', foreground: '9CDCFE' },
    { token: 'variable.parameter.asfl', foreground: '9CDCFE' },
    { token: 'variable.other.asfl', foreground: '9CDCFE' },
    { token: 'string.unquoted.informal.asfl', foreground: 'CE9178' },
    { token: 'string.quoted.double.asfl', foreground: 'CE9178' },
    { token: 'constant.other.enum.asfl', foreground: 'D7BA7D' },
    { token: 'constant.numeric', foreground: 'B5CEA8' },
    { token: 'constant.language', foreground: '4EC9B0' },
    { token: 'comment.block.asfl', foreground: '6A9955' },
    { token: 'meta.fsf.asfl', foreground: 'D4D4D4' },
    { token: 'meta.comment.informal.asfl', foreground: 'CE9178' }
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4'
  }
}
