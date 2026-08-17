import { ToastContainer } from "react-toastify";
import { useTheme } from "../../providers/ThemeProvider";

/**
 * Toastify keeps its own palette rather than reading our CSS variables, so it
 * needs the resolved theme handed to it explicitly. Split into its own
 * component because it has to sit inside ThemeProvider to call useTheme.
 */
const ThemedToastContainer = () => {
  const { theme } = useTheme();

  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      pauseOnHover
      draggable
      theme={theme}
    />
  );
};

export default ThemedToastContainer;
