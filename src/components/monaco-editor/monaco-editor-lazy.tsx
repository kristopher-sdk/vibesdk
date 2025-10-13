import { lazy, Suspense } from 'react';
import type { MonacoEditorProps } from './monaco-editor';

// Lazy load the Monaco Editor component
const MonacoEditorComponent = lazy(() => import('./monaco-editor').then(module => ({
  default: module.MonacoEditor
})));

// Loading fallback for Monaco Editor
function MonacoLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/50">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        <p className="text-xs text-muted-foreground">Loading editor...</p>
      </div>
    </div>
  );
}

// Wrapper component that lazy loads Monaco Editor
export function MonacoEditor(props: MonacoEditorProps) {
  return (
    <Suspense fallback={<MonacoLoadingFallback />}>
      <MonacoEditorComponent {...props} />
    </Suspense>
  );
}