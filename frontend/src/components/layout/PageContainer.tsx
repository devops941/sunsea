import { Outlet } from "react-router-dom";

/**
 * Layout route for pages that used to be rendered inside a `*Tabs` wrapper.
 *
 * Those wrappers had stopped rendering a tab bar long ago — all they still did
 * was map the current pathname to a page component and wrap it in
 * `.inner-container` + a fluid Bootstrap container. Now that the router points
 * straight at the page components, this reproduces that shell in one place.
 *
 * The Bootstrap `Container fluid` that used to sit in here has been dropped:
 * its gutters stacked on top of `.inner-container`'s own padding and the
 * layout wrapper's, giving the table three nested gutters. Horizontal spacing
 * now comes solely from the max-w-[1600px] wrapper in BaseLayout.
 *
 * Only list/content pages sit under this route. Create/edit forms were never
 * inside a tab wrapper and stay full-width, exactly as before.
 */
const PageContainer = () => (
  <div className="w-full min-w-0 my-3">
    <Outlet />
  </div>
);

export default PageContainer;
