import type { editor } from 'monaco-editor'

export const agileSoflLightTheme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword.control.asfl', foreground: 'C586C0' },
    { token: 'keyword.declaration.asfl', foreground: '569CD6' },
    { token: 'entity.name.namespace.asfl', foreground: '4FC1FF' },
    { token: 'entity.name.function.asfl', foreground: 'DCDCAA' },
    { token: 'entity.name.type.asfl', foreground: '4EC9B0' },
    { token: 'variable.parameter.asfl', foreground: '9CDCFE' },
    { token: 'string.quoted.double.asfl', foreground: 'CE9178' },
    { token: 'comment.block.asfl', foreground: '6A9955' },
    { token: 'constant.numeric', foreground: 'B5CEA8' }
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
    { token: 'keyword.declaration.asfl', foreground: '569CD6' },
    { token: 'entity.name.namespace.asfl', foreground: '4FC1FF' },
    { token: 'entity.name.function.asfl', foreground: 'DCDCAA' },
    { token: 'entity.name.type.asfl', foreground: '4EC9B0' },
    { token: 'variable.parameter.asfl', foreground: '9CDCFE' },
    { token: 'string.quoted.double.asfl', foreground: 'CE9178' },
    { token: 'comment.block.asfl', foreground: '6A9955' },
    { token: 'constant.numeric', foreground: 'B5CEA8' }
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4'
  }
}
