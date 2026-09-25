import { CircleQuestionMark } from "lucide-react";
import { EmptyState, LinkButton } from "../components/ui";

export function NotFound() {
  return (
    <EmptyState icon={<CircleQuestionMark />} title="Page not available">
      <p>This page couldn't be rendered.</p>
      <LinkButton href="/" className="mt-4">
        Back to the homepage
      </LinkButton>
    </EmptyState>
  );
}
