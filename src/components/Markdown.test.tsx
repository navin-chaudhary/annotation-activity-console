import { render } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown sanitization", () => {
  it("renders markdown but strips scripts and inline event handlers", () => {
    const untrusted =
      "## Heading\n\n" +
      '<img src=x onerror="alert(\'xss-img\')">\n\n' +
      "<script>alert('xss-script')</script>\n\n" +
      "Done.";

    const { container } = render(<Markdown content={untrusted} />);
    const html = container.innerHTML;

    // Markdown still renders.
    expect(container.querySelector("h2")?.textContent).toBe("Heading");
    // Dangerous bits are gone.
    expect(html).not.toContain("onerror");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(container.querySelector("script")).toBeNull();
    // <img> is forbidden entirely, so untrusted content triggers no requests.
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders fenced code blocks", () => {
    const { container } = render(
      <Markdown content={"```ts\nconst x = 1;\n```"} />,
    );
    expect(container.querySelector("pre code")).not.toBeNull();
  });
});
