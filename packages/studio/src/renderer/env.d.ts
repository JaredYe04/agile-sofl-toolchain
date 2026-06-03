export {}

declare global {
  interface Window {
    studio?: {
      getLspStatus: () => Promise<{ running: boolean; message: string }>
      buildDocumentModel: (source: string) => Promise<{ modules: string[]; errorCount: number }>
    }
  }
}
