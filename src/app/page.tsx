import { EditorShell } from "@/components/editor/editor-shell";

/**
 * The editor is one full-viewport surface, so the route is just the shell —
 * everything below it is a component.
 */
export default function Home() {
  return <EditorShell />;
}
