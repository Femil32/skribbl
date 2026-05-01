import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RouteErrorFallback } from "./RouteErrorFallback";

describe("RouteErrorFallback", () => {
  it("renders recovery actions without exposing error details", () => {
    const retry = vi.fn();
    render(<RouteErrorFallback unstable_retry={retry} />);
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeTruthy();
    expect(screen.queryByText(/digest/i)).toBeNull();
  });

  it("calls unstable_retry when Try again is clicked", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<RouteErrorFallback unstable_retry={retry} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("invokes reloadPage when Reload page is clicked", async () => {
    const user = userEvent.setup();
    const reloadPage = vi.fn();
    render(<RouteErrorFallback unstable_retry={vi.fn()} reloadPage={reloadPage} />);
    await user.click(screen.getByRole("button", { name: /reload page/i }));
    expect(reloadPage).toHaveBeenCalledOnce();
  });
});
