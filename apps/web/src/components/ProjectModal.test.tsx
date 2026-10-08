import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectModal } from "./ProjectModal.js";

describe("ProjectModal", () => {
  it("renders create project modal when open", () => {
    const html = renderToStaticMarkup(
      <ProjectModal
        isOpen={true}
        onClose={() => undefined}
        onSave={async () => undefined}
      />
    );

    expect(html).toContain("Create New Project");
    expect(html).toContain("Project Name");
    expect(html).toContain("Description");
    expect(html).toContain("Create Project");
  });

  it("renders edit project modal with delete option when initialProject is provided", () => {
    const html = renderToStaticMarkup(
      <ProjectModal
        isOpen={true}
        initialProject={{ id: "proj_123", name: "Checkout Web", description: "Regression pack" }}
        onClose={() => undefined}
        onSave={async () => undefined}
        onDelete={async () => undefined}
      />
    );

    expect(html).toContain("Edit Project");
    expect(html).toContain("Update Project");
    expect(html).toContain("Delete Project");
  });

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <ProjectModal
        isOpen={false}
        onClose={() => undefined}
        onSave={async () => undefined}
      />
    );

    expect(html).toBe("");
  });
});
